import { useEffect, useMemo, useRef, useState } from 'react'
import { Bold, ChevronDown, ChevronUp, Copy, EyeOff, Filter, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { addTaskRemark, fetchTaskRemarks, fetchUserNames } from '../../lib/coreManagement/db'
import { departmentLabel, formatShortDate, priorityLabel, statusLabel } from '../../lib/coreManagement/taskHelpers'
import { TASK_COLUMNS, columnWidthPercents, type TaskColumnDef, type TaskColumnKey } from '../../lib/coreManagement/columns'
import { ComboboxEditor, DateEditor, SelectEditor, TextareaEditor, applyFormat, renderRichText } from './EditableCell'
import type { Task, TaskRemark, TaskStatus } from '../../lib/coreManagement/dbTypes'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'on_hold', label: 'On hold' },
]

// Tasklist/Active Task/Delayed/Other — a single admin-set choice per task.
const PRIORITY_OPTIONS: { value: Task['priority']; label: string }[] = [
  { value: 'tasklist', label: 'Tasklist' },
  { value: 'active', label: 'Active Task' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'other', label: 'Other' },
]

interface NewTaskDraft {
  priority: Task['priority']
  department: string
  task_description: string
  responsible_user_id: string
  current_deadline: string | null
}

interface CellCoord {
  taskId: string
  colKey: TaskColumnKey
}

interface SortState {
  key: TaskColumnKey
  dir: 'asc' | 'desc'
}

type Direction = 'up' | 'down' | 'left' | 'right'

const MULTILINE_COLUMNS: TaskColumnKey[] = ['task_description', 'official_remarks']

// Which Task field a column edits — task_number has none (read-only).
const FIELD_BY_COLUMN: Partial<Record<TaskColumnKey, keyof Task>> = {
  department: 'department',
  task_description: 'task_description',
  responsible: 'responsible_user_id',
  added_at: 'added_at',
  initial_deadline: 'initial_deadline',
  current_deadline: 'current_deadline',
  official_remarks: 'official_remarks',
  status: 'status',
  priority: 'priority',
}

/** Plain-text value for a cell, used for sorting, filtering, and as the
 * seed/committed value for text-type editors. Not the same as the display
 * JSX (which additionally renders bold/italic for Task/Remarks) — this is
 * the underlying comparable string. */
function cellText(task: Task, key: TaskColumnKey, namesById: Map<string, string>, deptLabels: Map<string, string>): string {
  switch (key) {
    case 'task_number':
      return task.task_number
    case 'department':
      return departmentLabel(task.department, deptLabels)
    case 'task_description':
      return task.task_description
    case 'responsible':
      return namesById.get(task.responsible_user_id) ?? ''
    case 'added_at':
      return task.added_at ? formatShortDate(task.added_at.slice(0, 10)) : ''
    case 'initial_deadline':
      return formatShortDate(task.initial_deadline)
    case 'current_deadline':
      return formatShortDate(task.current_deadline)
    case 'official_remarks':
      return task.official_remarks ?? ''
    case 'status':
      return statusLabel(task.status)
    case 'priority':
      return priorityLabel(task.priority)
  }
}

/** Comparable value for sorting — same idea as cellText but lower-cased for
 * text columns and using raw ISO dates (which sort correctly as strings)
 * instead of the short display format, so "1 Jul" doesn't sort before
 * "10 Jun" alphabetically. */
function sortValue(task: Task, key: TaskColumnKey, namesById: Map<string, string>, deptLabels: Map<string, string>): string {
  switch (key) {
    case 'added_at':
      return task.added_at ?? ''
    case 'initial_deadline':
      return task.initial_deadline ?? ''
    case 'current_deadline':
      return task.current_deadline ?? ''
    default:
      return cellText(task, key, namesById, deptLabels).toLowerCase()
  }
}

function RemarksSubRow({ taskId, colSpan }: { taskId: string; colSpan: number }) {
  const { profile } = useAuth()
  const [remarks, setRemarks] = useState<TaskRemark[] | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [newRemark, setNewRemark] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchTaskRemarks(taskId).then(async (rows) => {
      setRemarks(rows)
      setNames(await fetchUserNames(rows.map((r) => r.author_user_id)))
    })
  }, [taskId])

  async function handlePost() {
    if (!profile || !newRemark.trim()) return
    await addTaskRemark(taskId, profile.id, newRemark.trim())
    setNewRemark('')
    const rows = await fetchTaskRemarks(taskId)
    setRemarks(rows)
    setNames(await fetchUserNames(rows.map((r) => r.author_user_id)))
  }

  return (
    <tr className="bg-surface-2">
      <td colSpan={colSpan} className="px-4 py-3 border border-border">
        <div className="max-w-2xl space-y-2">
          {remarks === null ? (
            <p className="text-xs text-text-secondary">Loading remarks…</p>
          ) : remarks.length === 0 ? (
            <p className="text-xs text-text-secondary">No remarks yet.</p>
          ) : (
            remarks.map((r) => (
              <div key={r.id} className="border-l-2 border-border pl-2.5">
                <p className="text-xs text-text-secondary">
                  {names.get(r.author_user_id) ?? '—'} · {new Date(r.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-text mt-0.5 whitespace-pre-wrap">{renderRichText(r.remark_text)}</p>
              </div>
            ))
          )}
          <div className="flex gap-2 pt-1 items-end">
            {/* This is a message-compose box, not a spreadsheet cell, so it
                deliberately keeps its own convention (Enter = newline,
                Ctrl/Cmd+Enter = submit) rather than the grid's Enter-commits
                behavior. */}
            <textarea
              ref={textareaRef}
              rows={2}
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handlePost()
                  return
                }
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                  e.preventDefault()
                  if (textareaRef.current) applyFormat(textareaRef.current, newRemark, setNewRemark, '**')
                  return
                }
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                  e.preventDefault()
                  if (textareaRef.current) applyFormat(textareaRef.current, newRemark, setNewRemark, '*')
                }
              }}
              placeholder="Add a remark… (Enter for a new line, Ctrl/Cmd+B bold, Ctrl/Cmd+I italic, Ctrl/Cmd+Enter or Post to submit)"
              className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              type="button"
              title="Bold (Ctrl/Cmd+B)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => textareaRef.current && applyFormat(textareaRef.current, newRemark, setNewRemark, '**')}
              className="rounded-md border border-border text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 transition-colors p-1.5 shrink-0"
            >
              <Bold size={14} strokeWidth={2} />
            </button>
            <button
              onClick={handlePost}
              className="rounded-md bg-accent text-white text-xs font-medium px-3 py-1.5 hover:bg-accent-hover active:bg-accent-hover transition-colors shrink-0"
            >
              Post
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Module-level components (not nested in TaskTable's own render body) — a
// component declared inside another component's render gets a new function
// identity every render, which makes React unmount/remount the whole
// subtree instead of reconciling it. That bug (fixed in an earlier pass) is
// exactly the kind of thing this rework must not reintroduce, so every piece
// below stays a real top-level component even as the interaction model gets
// much more stateful.
// ---------------------------------------------------------------------------

type Widths = ReturnType<typeof columnWidthPercents>

interface TableActions {
  selectCell: (coord: CellCoord) => void
  enterEdit: (coord: CellCoord, seedChar?: string) => void
  exitEdit: () => void
  moveSelection: (dir: Direction) => void
  commitCell: (coord: CellCoord, value: string) => void
  clearCell: (coord: CellCoord) => void
  onContextMenu: (e: React.MouseEvent, taskId: string) => void
  toggleRowSelect: (taskId: string, extend: 'ctrl' | 'shift' | null) => void
}

function Colgroup({ columns, widths }: { columns: TaskColumnDef[]; widths: Widths }) {
  return (
    <colgroup>
      <col style={{ width: `${widths.serial}%` }} />
      {columns.map((c, i) => (
        <col key={c.key} style={{ width: `${widths.cols[i]}%` }} />
      ))}
    </colgroup>
  )
}

function FilterDropdown({
  col,
  allValues,
  active,
  onApply,
  onClose,
}: {
  col: TaskColumnDef
  allValues: string[]
  active: Set<string> | undefined
  onApply: (values: Set<string> | null) => void
  onClose: () => void
}) {
  const distinct = useMemo(() => [...new Set(allValues)].sort((a, b) => a.localeCompare(b)), [allValues])
  const [draft, setDraft] = useState<Set<string>>(new Set(active ?? distinct))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [onClose])

  function toggle(v: string) {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-full mt-1 w-56 max-h-80 flex flex-col rounded-lg border border-border bg-bg shadow-sm z-50 text-left normal-case tracking-normal font-normal"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-text">Filter {col.label}</span>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
      <div className="flex gap-2 px-3 py-1.5 border-b border-border text-xs">
        <button onClick={() => setDraft(new Set(distinct))} className="text-accent hover:underline">
          Select all
        </button>
        <button onClick={() => setDraft(new Set())} className="text-accent hover:underline">
          Clear
        </button>
      </div>
      <div className="overflow-y-auto py-1">
        {distinct.length === 0 ? (
          <p className="px-3 py-2 text-xs text-text-secondary">No values.</p>
        ) : (
          distinct.map((v) => (
            <label key={v} className="flex items-center gap-2 px-3 py-1 text-sm text-text hover:bg-surface-2 cursor-pointer transition-colors">
              <input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} className="rounded border-border" />
              <span className="truncate">{v || '(blank)'}</span>
            </label>
          ))
        )}
      </div>
      <div className="p-2 border-t border-border">
        <button
          onClick={() => {
            onApply(draft.size === distinct.length ? null : draft)
            onClose()
          }}
          className="w-full rounded-md bg-accent text-white text-xs font-medium py-1.5 hover:bg-accent-hover active:bg-accent-hover transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

function Header({
  columns,
  sort,
  onToggleSort,
  onRenumber,
  filters,
  columnValues,
  openFilterCol,
  onOpenFilter,
  onApplyFilter,
  interactive,
}: {
  columns: TaskColumnDef[]
  sort: SortState | null
  onToggleSort: (key: TaskColumnKey) => void
  onRenumber: () => void
  filters: Map<TaskColumnKey, Set<string>>
  columnValues: Map<TaskColumnKey, string[]>
  openFilterCol: TaskColumnKey | null
  onOpenFilter: (key: TaskColumnKey | null) => void
  onApplyFilter: (key: TaskColumnKey, values: Set<string> | null) => void
  /** Sort/filter apply to the whole table, not per department group — when
   * grouped, only the first group's header actually drives them (renumber
   * too, since row numbers are also table-wide). Every group still shows
   * the same sort indicator/filter-active state, just not a second live
   * set of controls that would open a second copy of the same dropdown. */
  interactive: boolean
}) {
  return (
    <thead>
      <tr className="bg-accent/10 border-b-2 border-accent/30 text-left text-text">
        <th className="font-semibold px-1 py-2 text-xs border-r-2 border-accent/20 text-center">
          {interactive && (
            <button
              onClick={onRenumber}
              title="Resequence row numbers (always kept in sync automatically — this just confirms it)"
              className="text-text-secondary hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded p-0.5 transition-colors"
            >
              <RotateCcw size={12} strokeWidth={1.75} />
            </button>
          )}
        </th>
        {columns.map((col) => {
          const active = sort?.key === col.key
          const hasFilter = (filters.get(col.key)?.size ?? 0) > 0
          return (
            <th
              key={col.key}
              title={interactive ? 'Click to sort' : undefined}
              className={`relative font-semibold px-2 py-2 text-xs uppercase tracking-wide border-r border-accent/20 last:border-r-0 select-none transition-colors ${interactive ? 'hover:bg-accent/15' : ''} ${
                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
              }`}
            >
              <span
                className={`inline-flex items-center gap-1 ${interactive ? 'cursor-pointer' : ''}`}
                onClick={interactive ? () => onToggleSort(col.key) : undefined}
              >
                {col.label}
                {active && (sort!.dir === 'asc' ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />)}
              </span>
              {interactive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenFilter(openFilterCol === col.key ? null : col.key)
                  }}
                  title="Filter"
                  className={`ml-1 inline-flex align-middle rounded p-0.5 transition-colors hover:bg-accent/20 active:bg-accent/30 ${hasFilter ? 'text-accent' : 'text-text-secondary'}`}
                >
                  <Filter size={11} strokeWidth={2} />
                </button>
              )}
              {!interactive && hasFilter && (
                <Filter size={11} strokeWidth={2} className="ml-1 inline-flex align-middle text-accent" />
              )}
              {interactive && openFilterCol === col.key && (
                <FilterDropdown
                  col={col}
                  allValues={columnValues.get(col.key) ?? []}
                  active={filters.get(col.key)}
                  onApply={(values) => onApplyFilter(col.key, values)}
                  onClose={() => onOpenFilter(null)}
                />
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

function DisplayValue({ task, col, deptLabels, namesById }: { task: Task; col: TaskColumnDef; deptLabels: Map<string, string>; namesById: Map<string, string> }) {
  if (col.key === 'task_description' || col.key === 'official_remarks') {
    const text = col.key === 'task_description' ? task.task_description : (task.official_remarks ?? '')
    return <div className="whitespace-pre-wrap break-words">{renderRichText(text)}</div>
  }
  if (col.key === 'added_at' || col.key === 'initial_deadline' || col.key === 'current_deadline') {
    const raw = col.key === 'added_at' ? task.added_at?.slice(0, 10) ?? null : col.key === 'initial_deadline' ? task.initial_deadline : task.current_deadline
    return <span className={!raw ? 'text-text-muted' : ''}>{formatShortDate(raw)}</span>
  }
  return <span className="truncate block">{cellText(task, col.key, namesById, deptLabels)}</span>
}

function EditableTd({
  task,
  col,
  isSelected,
  isEditing,
  seedChar,
  departments,
  userOptions,
  namesById,
  deptLabels,
  actions,
  overrideClass,
}: {
  task: Task
  col: TaskColumnDef
  isSelected: boolean
  isEditing: boolean
  seedChar?: string
  departments: { key: string; label: string }[]
  userOptions: { value: string; label: string }[]
  namesById: Map<string, string>
  deptLabels: Map<string, string>
  actions: TableActions
  overrideClass?: string
}) {
  const coord: CellCoord = { taskId: task.id, colKey: col.key }
  const field = FIELD_BY_COLUMN[col.key]
  const [draft, setDraft] = useState('')
  const tdRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (isEditing) setDraft(seedChar ?? cellText(task, col.key, namesById, deptLabels))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  useEffect(() => {
    if (isSelected && !isEditing) tdRef.current?.focus({ preventScroll: true })
  }, [isSelected, isEditing])

  function commitText() {
    actions.commitCell(coord, draft)
  }

  function handleEditingKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      actions.exitEdit()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      commitText()
      actions.moveSelection(e.shiftKey ? 'left' : 'right')
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (MULTILINE_COLUMNS.includes(col.key)) e.preventDefault()
      commitText()
      actions.moveSelection('down')
    }
    // Shift+Enter on a multiline field: no handling needed, textarea inserts a newline by default.
  }

  function handleSelectedKeyDown(e: React.KeyboardEvent<HTMLTableCellElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      actions.moveSelection('up')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      actions.moveSelection('down')
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      actions.moveSelection('left')
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      actions.moveSelection('right')
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      actions.moveSelection(e.shiftKey ? 'left' : 'right')
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (field) actions.enterEdit(coord)
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && field) {
      e.preventDefault()
      actions.clearCell(coord)
      return
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && field && FIELD_BY_COLUMN[col.key]) {
      // Typing a character on a selected text-capable cell starts editing
      // with that character seeded, like a real spreadsheet. Only for the
      // two free-text columns — typing on a Select/Date/Combobox cell isn't
      // a natural way to set those, so it's a no-op there.
      if (MULTILINE_COLUMNS.includes(col.key)) {
        e.preventDefault()
        actions.enterEdit(coord, e.key)
      }
    }
  }

  let editorNode: React.ReactNode = null
  if (isEditing) {
    if (col.key === 'department') {
      editorNode = (
        <SelectEditor
          value={task.department}
          options={departments.map((d) => ({ value: d.key, label: d.label }))}
          onChange={(v) => {
            actions.commitCell(coord, v)
            actions.exitEdit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') actions.exitEdit()
          }}
        />
      )
    } else if (col.key === 'task_description' || col.key === 'official_remarks') {
      editorNode = <TextareaEditor value={draft} onChange={setDraft} onKeyDown={handleEditingKeyDown} />
    } else if (col.key === 'responsible') {
      editorNode = (
        <ComboboxEditor
          value={task.responsible_user_id}
          options={userOptions}
          onSelect={(v) => {
            actions.commitCell(coord, v)
            actions.exitEdit()
            actions.moveSelection('down')
          }}
          onCancel={actions.exitEdit}
        />
      )
    } else if (col.key === 'added_at' || col.key === 'initial_deadline' || col.key === 'current_deadline') {
      const raw = col.key === 'added_at' ? task.added_at?.slice(0, 10) ?? null : col.key === 'initial_deadline' ? task.initial_deadline : task.current_deadline
      editorNode = (
        <DateEditor
          value={raw}
          onChange={(v) => {
            actions.commitCell(coord, v)
            actions.exitEdit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') actions.exitEdit()
          }}
        />
      )
    } else if (col.key === 'status') {
      editorNode = (
        <SelectEditor
          value={task.status}
          options={STATUS_OPTIONS}
          align="center"
          onChange={(v) => {
            actions.commitCell(coord, v)
            actions.exitEdit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') actions.exitEdit()
          }}
        />
      )
    } else if (col.key === 'priority') {
      editorNode = (
        <SelectEditor
          value={task.priority}
          options={PRIORITY_OPTIONS}
          align="center"
          onChange={(v) => {
            actions.commitCell(coord, v)
            actions.exitEdit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') actions.exitEdit()
          }}
        />
      )
    } else if (col.key === 'task_number') {
      editorNode = <span className="text-text-secondary">{task.task_number}</span>
    }
  }

  return (
    <td
      ref={tdRef}
      tabIndex={isEditing ? -1 : 0}
      onClick={() => !isEditing && actions.selectCell(coord)}
      onDoubleClick={() => field && actions.enterEdit(coord)}
      onContextMenu={(e) => actions.onContextMenu(e, task.id)}
      onKeyDown={isEditing ? undefined : handleSelectedKeyDown}
      className={
        overrideClass ??
        `px-1 py-0.5 border-r border-border last:border-r-0 align-top outline-none ${
          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
        } ${isSelected ? 'ring-2 ring-inset ring-accent' : ''}`
      }
    >
      {isEditing ? editorNode : <DisplayValue task={task} col={col} deptLabels={deptLabels} namesById={namesById} />}
    </td>
  )
}

function Row({
  task,
  columns,
  serial,
  expanded,
  onToggleExpand,
  departments,
  userOptions,
  namesById,
  deptLabels,
  flash,
  colSpan,
  selected,
  editing,
  seedChar,
  actions,
  isRowSelected,
}: {
  task: Task
  columns: TaskColumnDef[]
  serial: number | undefined
  expanded: boolean
  onToggleExpand: (id: string) => void
  departments: { key: string; label: string }[]
  userOptions: { value: string; label: string }[]
  namesById: Map<string, string>
  deptLabels: Map<string, string>
  flash: boolean
  colSpan: number
  selected: CellCoord | null
  editing: CellCoord | null
  seedChar: string | undefined
  actions: TableActions
  isRowSelected: boolean
}) {
  return (
    <>
      <tr
        className={`border-b border-border last:border-0 hover:bg-surface transition-colors group ${isRowSelected ? 'bg-accent/10' : ''}`}
        onContextMenu={(e) => actions.onContextMenu(e, task.id)}
      >
        <td
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) actions.toggleRowSelect(task.id, 'ctrl')
            else if (e.shiftKey) actions.toggleRowSelect(task.id, 'shift')
            else onToggleExpand(task.id)
          }}
          title="Click to view/add remarks — Ctrl/Cmd or Shift+click to select rows for bulk actions"
          className={`px-2 py-1 text-xs text-right border-r-2 border-border cursor-pointer select-none transition-colors ${
            flash ? 'bg-accent/25' : ''
          } ${expanded ? 'text-accent font-medium' : 'text-text-muted hover:text-accent'}`}
        >
          {serial}
        </td>
        {columns.map((col) => (
          <EditableTd
            key={col.key}
            task={task}
            col={col}
            isSelected={!!selected && selected.taskId === task.id && selected.colKey === col.key}
            isEditing={!!editing && editing.taskId === task.id && editing.colKey === col.key}
            seedChar={editing && editing.taskId === task.id && editing.colKey === col.key ? seedChar : undefined}
            departments={departments}
            userOptions={userOptions}
            namesById={namesById}
            deptLabels={deptLabels}
            actions={actions}
          />
        ))}
      </tr>
      {expanded && <RemarksSubRow taskId={task.id} colSpan={colSpan} />}
    </>
  )
}

function AddRow({
  columns,
  departments,
  userOptions,
  defaultPriority,
  onAddTask,
}: {
  columns: TaskColumnDef[]
  departments: { key: string; label: string }[]
  userOptions: { value: string; label: string }[]
  defaultPriority: Task['priority']
  onAddTask: (draft: NewTaskDraft) => void
}) {
  const [priority, setPriority] = useState<Task['priority']>(defaultPriority)
  const [department, setDepartment] = useState(departments[0]?.key ?? '')
  const [description, setDescription] = useState('')
  const [responsible, setResponsible] = useState(userOptions[0]?.value ?? '')
  const [deadline, setDeadline] = useState('')

  // departments/userOptions load asynchronously (a real network fetch each
  // page does on mount) — on the very first render they're still empty
  // arrays, which seeded department/responsible to '' via the useState
  // initializers above. Since AddRow is now a stable module-level component
  // (fixed in an earlier pass specifically so it *wouldn't* remount and
  // lose in-progress input), that initial '' never had a chance to
  // self-correct once the real data arrived — and submit()'s own guard
  // silently no-ops when responsible is empty, which is exactly what "task
  // creation is broken" looked like from the outside: type a task, press
  // Enter, nothing happens, no error. Backfill the default only if the
  // field is still at its untouched empty state once real options exist.
  useEffect(() => {
    if (!department && departments[0]) setDepartment(departments[0].key)
  }, [department, departments])
  useEffect(() => {
    if (!responsible && userOptions[0]) setResponsible(userOptions[0].value)
  }, [responsible, userOptions])

  function submit() {
    if (!description.trim() || !responsible || !department) return
    onAddTask({
      priority,
      department,
      task_description: description.trim(),
      responsible_user_id: responsible,
      current_deadline: deadline || null,
    })
    setDescription('')
    setDeadline('')
  }

  return (
    <tr className="border-b border-border bg-surface-2/40">
      <td className="border-r-2 border-border text-center">
        <button
          onClick={submit}
          title="Add task"
          className="text-accent hover:text-accent-hover hover:bg-accent/10 active:bg-accent/20 rounded p-0.5 transition-colors"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </td>
      {columns.map((col) => {
        if (col.key === 'department')
          return (
            <td key={col.key} className="px-1 py-0.5 border-r border-border last:border-r-0">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-transparent border border-transparent rounded px-1 py-1 text-sm text-text outline-none hover:bg-surface-2 focus:border-accent focus:bg-bg transition-colors cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </td>
          )
        if (col.key === 'task_description')
          return (
            <td key={col.key} className="px-1 py-0.5 border-r border-border last:border-r-0">
              <input
                type="text"
                value={description}
                placeholder="New task — type and press Enter…"
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full bg-transparent border border-transparent rounded px-1.5 py-1 text-sm text-text outline-none hover:bg-surface-2 focus:border-accent focus:bg-bg transition-colors placeholder:text-text-muted"
              />
            </td>
          )
        if (col.key === 'responsible')
          return (
            <td key={col.key} className="px-1 py-0.5 border-r border-border last:border-r-0">
              <select
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full bg-transparent border border-transparent rounded px-1 py-1 text-sm text-text outline-none hover:bg-surface-2 focus:border-accent focus:bg-bg transition-colors cursor-pointer"
              >
                {userOptions.length === 0 && <option value="">Loading…</option>}
                {userOptions.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </td>
          )
        if (col.key === 'current_deadline')
          return (
            <td key={col.key} className="px-1 py-0.5 border-r border-border last:border-r-0">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-transparent border border-transparent rounded px-1 py-1 text-sm text-text text-right outline-none hover:bg-surface-2 focus:border-accent focus:bg-bg transition-colors"
              />
            </td>
          )
        if (col.key === 'priority')
          return (
            <td key={col.key} className="px-1 py-0.5 border-r border-border last:border-r-0">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task['priority'])}
                className="w-full bg-transparent border border-transparent rounded px-1 py-1 text-sm text-text text-center outline-none hover:bg-surface-2 focus:border-accent focus:bg-bg transition-colors cursor-pointer"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </td>
          )
        return <td key={col.key} className="px-1 py-0.5 border-r border-border last:border-r-0" />
      })}
    </tr>
  )
}

function ContextMenu({
  x,
  y,
  onHide,
  onDelete,
  onDuplicate,
  onClose,
  count,
}: {
  x: number
  y: number
  onHide: () => void
  onDelete: () => void
  onDuplicate: () => void
  onClose: () => void
  count: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  const itemClass =
    'w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-text hover:bg-surface-2 active:bg-border/60 transition-colors'

  // Clamp so the menu never renders off the right/bottom edge of the viewport.
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - 140),
  }

  return (
    <div ref={ref} style={style} className="w-44 rounded-md border border-border bg-bg shadow-sm z-[60] py-1 cm-no-print">
      <button onClick={onHide} className={itemClass}>
        <EyeOff size={13} strokeWidth={1.75} />
        Hide row{count > 1 ? `s (${count})` : ''}
      </button>
      {count === 1 && (
        <button onClick={onDuplicate} className={itemClass}>
          <Copy size={13} strokeWidth={1.75} />
          Duplicate row
        </button>
      )}
      <button onClick={onDelete} className={`${itemClass} text-red-600 hover:bg-red-50`}>
        <Trash2 size={13} strokeWidth={1.75} />
        Delete row{count > 1 ? `s (${count})` : ''}
      </button>
    </div>
  )
}

function HiddenRowsPanel({
  tasks,
  onUnhide,
  onClose,
}: {
  tasks: Task[]
  onUnhide: (id: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [onClose])

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 w-80 max-h-80 flex flex-col rounded-lg border border-border bg-bg shadow-sm z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-text">Hidden rows ({tasks.length})</span>
        <button onClick={onClose} className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors">
          <X size={13} />
        </button>
      </div>
      <div className="overflow-y-auto py-1">
        {tasks.length === 0 ? (
          <p className="px-3 py-2 text-xs text-text-secondary">Nothing hidden in this view.</p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-surface-2 transition-colors">
              <span className="truncate text-text" title={t.task_description}>
                {t.task_number} — {t.task_description}
              </span>
              <button onClick={() => onUnhide(t.id)} className="text-accent text-xs shrink-0 hover:underline">
                Unhide
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function TaskRowsTable(props: {
  rows: Task[]
  columns: TaskColumnDef[]
  widths: Widths
  sort: SortState | null
  onToggleSort: (key: TaskColumnKey) => void
  onRenumber: () => void
  filters: Map<TaskColumnKey, Set<string>>
  columnValues: Map<TaskColumnKey, string[]>
  openFilterCol: TaskColumnKey | null
  onOpenFilter: (key: TaskColumnKey | null) => void
  onApplyFilter: (key: TaskColumnKey, values: Set<string> | null) => void
  showAddRow: boolean
  departments: { key: string; label: string }[]
  userOptions: { value: string; label: string }[]
  defaultPriority: Task['priority']
  onAddTask: (draft: NewTaskDraft) => void
  expandedId: string | null
  onToggleExpand: (id: string) => void
  flash: boolean
  colSpan: number
  serials: Map<string, number>
  emptyMessage: string
  selected: CellCoord | null
  editing: CellCoord | null
  seedChar: string | undefined
  actions: TableActions
  namesById: Map<string, string>
  deptLabels: Map<string, string>
  selectedRowIds: Set<string>
  headerInteractive?: boolean
}) {
  const { rows, columns, widths } = props
  return (
    <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
      <Colgroup columns={columns} widths={widths} />
      <Header
        columns={columns}
        sort={props.sort}
        onToggleSort={props.onToggleSort}
        onRenumber={props.onRenumber}
        filters={props.filters}
        columnValues={props.columnValues}
        openFilterCol={props.openFilterCol}
        onOpenFilter={props.onOpenFilter}
        onApplyFilter={props.onApplyFilter}
        interactive={props.headerInteractive ?? true}
      />
      <tbody>
        {props.showAddRow && (
          <AddRow
            columns={columns}
            departments={props.departments}
            userOptions={props.userOptions}
            defaultPriority={props.defaultPriority}
            onAddTask={props.onAddTask}
          />
        )}
        {rows.length === 0 && !props.showAddRow ? (
          <tr>
            <td colSpan={props.colSpan} className="px-4 py-6 text-center text-text-secondary">
              {props.emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((t) => (
            <Row
              key={t.id}
              task={t}
              columns={columns}
              serial={props.serials.get(t.id)}
              expanded={props.expandedId === t.id}
              onToggleExpand={props.onToggleExpand}
              departments={props.departments}
              userOptions={props.userOptions}
              namesById={props.namesById}
              deptLabels={props.deptLabels}
              flash={props.flash}
              colSpan={props.colSpan}
              selected={props.selected}
              editing={props.editing}
              seedChar={props.seedChar}
              actions={props.actions}
              isRowSelected={props.selectedRowIds.has(t.id)}
            />
          ))
        )}
      </tbody>
    </table>
  )
}

export default function TaskTable({
  tasks,
  deptLabels,
  departments,
  users,
  visibleColumns,
  grouped,
  onUpdateTask,
  onAddTask,
  onDeleteTasks,
  showAddRow = true,
  defaultPriority = 'active',
  emptyMessage = 'No tasks.',
}: {
  tasks: Task[]
  deptLabels: Map<string, string>
  departments: { key: string; label: string }[]
  users: { id: string; label: string }[]
  visibleColumns: Set<TaskColumnKey>
  grouped?: boolean
  onUpdateTask: (id: string, changes: Partial<Task>) => void
  onAddTask: (draft: NewTaskDraft) => void
  onDeleteTasks: (tasks: Task[]) => void
  showAddRow?: boolean
  defaultPriority?: Task['priority']
  emptyMessage?: string
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)
  const [flash, setFlash] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [hiddenPanelOpen, setHiddenPanelOpen] = useState(false)
  const [selected, setSelected] = useState<CellCoord | null>(null)
  const [editing, setEditing] = useState<CellCoord | null>(null)
  const [seedChar, setSeedChar] = useState<string | undefined>(undefined)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [lastSelectedRow, setLastSelectedRow] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null)
  const [filters, setFilters] = useState<Map<TaskColumnKey, Set<string>>>(new Map())
  const [openFilterCol, setOpenFilterCol] = useState<TaskColumnKey | null>(null)

  const columns = TASK_COLUMNS.filter((c) => visibleColumns.has(c.key))
  const colSpan = columns.length + 1 // + serial(=remarks toggle)
  const userOptions = users.map((u) => ({ value: u.id, label: u.label }))
  const namesById = useMemo(() => new Map(users.map((u) => [u.id, u.label])), [users])
  const widths = columnWidthPercents(columns)

  const hiddenTasks = useMemo(() => tasks.filter((t) => hiddenIds.has(t.id)), [tasks, hiddenIds])
  const notHidden = useMemo(() => tasks.filter((t) => !hiddenIds.has(t.id)), [tasks, hiddenIds])

  const columnValues = useMemo(() => {
    const map = new Map<TaskColumnKey, string[]>()
    for (const col of columns) map.set(col.key, notHidden.map((t) => cellText(t, col.key, namesById, deptLabels)))
    return map
  }, [notHidden, columns, namesById, deptLabels])

  const filteredTasks = useMemo(() => {
    if (filters.size === 0) return notHidden
    return notHidden.filter((t) =>
      [...filters.entries()].every(([colKey, values]) => values.has(cellText(t, colKey, namesById, deptLabels))),
    )
  }, [notHidden, filters, namesById, deptLabels])

  const comparator = useMemo(() => {
    if (!sort) return null
    const factor = sort.dir === 'asc' ? 1 : -1
    return (a: Task, b: Task) => {
      const av = sortValue(a, sort.key, namesById, deptLabels)
      const bv = sortValue(b, sort.key, namesById, deptLabels)
      if (av < bv) return -1 * factor
      if (av > bv) return 1 * factor
      return 0
    }
  }, [sort, namesById, deptLabels])

  // Sorting only reorders rows within their current context — the flat list
  // when ungrouped, or within each department group when grouped — never
  // reshuffling which department group appears first, which would be a
  // confusing side effect of clicking, say, the Deadline header.
  const sortedFlatTasks = useMemo(
    () => (comparator ? [...filteredTasks].sort(comparator) : filteredTasks),
    [filteredTasks, comparator],
  )

  const groupedSorted = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of filteredTasks) {
      const list = map.get(t.department) ?? []
      list.push(t)
      map.set(t.department, list)
    }
    if (comparator) {
      for (const [key, list] of map) map.set(key, [...list].sort(comparator))
    }
    return map
  }, [filteredTasks, comparator])

  const serials = useMemo(() => {
    const order = grouped ? Array.from(groupedSorted.values()).flat() : sortedFlatTasks
    return new Map(order.map((t, i) => [t.id, i + 1]))
  }, [grouped, groupedSorted, sortedFlatTasks])

  // The flat, in-render-order list of every navigable cell coordinate —
  // recomputed whenever the visible rows/columns change. Arrow keys and
  // Tab walk this list rather than querying the DOM, so navigation always
  // matches what's actually on screen (including after a sort or filter).
  const navigableTasks = grouped ? Array.from(groupedSorted.values()).flat() : sortedFlatTasks
  const editableColumns = columns.filter((c) => FIELD_BY_COLUMN[c.key])

  function toggleSort(key: TaskColumnKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function applyFilter(key: TaskColumnKey, values: Set<string> | null) {
    setFilters((prev) => {
      const next = new Map(prev)
      if (values === null) next.delete(key)
      else next.set(key, values)
      return next
    })
  }

  function renumber() {
    setFlash(true)
    setTimeout(() => setFlash(false), 500)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function selectCell(coord: CellCoord) {
    setEditing(null)
    setSelected(coord)
  }

  function enterEdit(coord: CellCoord, seed?: string) {
    setSelected(coord)
    setSeedChar(seed)
    setEditing(coord)
  }

  function exitEdit() {
    setEditing(null)
    setSeedChar(undefined)
  }

  function commitCell(coord: CellCoord, value: string) {
    const field = FIELD_BY_COLUMN[coord.colKey]
    if (!field) return
    if (coord.colKey === 'status') onUpdateTask(coord.taskId, { status: value as TaskStatus })
    else if (coord.colKey === 'priority') onUpdateTask(coord.taskId, { priority: value as Task['priority'] })
    else onUpdateTask(coord.taskId, { [field]: value } as Partial<Task>)
  }

  function clearCell(coord: CellCoord) {
    if (MULTILINE_COLUMNS.includes(coord.colKey)) commitCell(coord, '')
  }

  function moveSelection(dir: Direction) {
    setEditing(null)
    setSelected((prev) => {
      const base = prev ?? { taskId: navigableTasks[0]?.id, colKey: editableColumns[0]?.key }
      if (!base.taskId || !base.colKey) return prev
      const rowIdx = navigableTasks.findIndex((t) => t.id === base.taskId)
      const colIdx = editableColumns.findIndex((c) => c.key === base.colKey)
      if (rowIdx === -1 || colIdx === -1) return prev
      let nextRow = rowIdx
      let nextCol = colIdx
      if (dir === 'up') nextRow = Math.max(0, rowIdx - 1)
      if (dir === 'down') nextRow = Math.min(navigableTasks.length - 1, rowIdx + 1)
      if (dir === 'left') nextCol = Math.max(0, colIdx - 1)
      if (dir === 'right') nextCol = Math.min(editableColumns.length - 1, colIdx + 1)
      const nextTask = navigableTasks[nextRow]
      const nextCoord2 = editableColumns[nextCol]
      if (!nextTask || !nextCoord2) return prev
      return { taskId: nextTask.id, colKey: nextCoord2.key }
    })
  }

  function toggleRowSelect(taskId: string, extend: 'ctrl' | 'shift' | null) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (extend === 'shift' && lastSelectedRow) {
        const ids = navigableTasks.map((t) => t.id)
        const a = ids.indexOf(lastSelectedRow)
        const b = ids.indexOf(taskId)
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          for (let i = lo; i <= hi; i++) next.add(ids[i])
          return next
        }
      }
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
    setLastSelectedRow(taskId)
  }

  function openContextMenu(e: React.MouseEvent, taskId: string) {
    e.preventDefault()
    if (!selectedRowIds.has(taskId)) setSelectedRowIds(new Set([taskId]))
    setContextMenu({ x: e.clientX, y: e.clientY, taskId })
  }

  function contextMenuTargets(): Task[] {
    if (!contextMenu) return []
    if (selectedRowIds.has(contextMenu.taskId) && selectedRowIds.size > 1) {
      return tasks.filter((t) => selectedRowIds.has(t.id))
    }
    const t = tasks.find((t) => t.id === contextMenu.taskId)
    return t ? [t] : []
  }

  function handleContextHide() {
    const targets = contextMenuTargets()
    setHiddenIds((prev) => {
      const next = new Set(prev)
      for (const t of targets) next.add(t.id)
      return next
    })
    setSelectedRowIds(new Set())
    setContextMenu(null)
  }

  function handleContextDelete() {
    const targets = contextMenuTargets()
    onDeleteTasks(targets)
    setSelectedRowIds(new Set())
    setContextMenu(null)
  }

  function handleContextDuplicate() {
    const targets = contextMenuTargets()
    const t = targets[0]
    if (t) {
      onAddTask({
        priority: t.priority,
        department: t.department,
        task_description: `${t.task_description} (copy)`,
        responsible_user_id: t.responsible_user_id,
        current_deadline: t.current_deadline,
      })
    }
    setContextMenu(null)
  }

  const actions: TableActions = {
    selectCell,
    enterEdit,
    exitEdit,
    moveSelection,
    commitCell,
    clearCell,
    onContextMenu: openContextMenu,
    toggleRowSelect,
  }

  const sharedProps = {
    columns,
    widths,
    sort,
    onToggleSort: toggleSort,
    onRenumber: renumber,
    filters,
    columnValues,
    openFilterCol,
    onOpenFilter: setOpenFilterCol,
    onApplyFilter: applyFilter,
    showAddRow,
    departments,
    userOptions,
    defaultPriority,
    onAddTask,
    expandedId,
    onToggleExpand: toggleExpand,
    flash,
    colSpan,
    serials,
    emptyMessage,
    selected,
    editing,
    seedChar,
    actions,
    namesById,
    deptLabels,
    selectedRowIds,
  }

  const controls = (
    <div className="flex items-center gap-3 mb-2 text-xs">
      <div className="relative">
        <button
          onClick={() => setHiddenPanelOpen((o) => !o)}
          className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${hiddenTasks.length > 0 ? 'text-accent hover:bg-accent/10' : 'text-text-muted hover:bg-surface-2'}`}
        >
          <EyeOff size={12} strokeWidth={1.75} />
          Hidden ({hiddenTasks.length})
        </button>
        {hiddenPanelOpen && (
          <HiddenRowsPanel
            tasks={hiddenTasks}
            onUnhide={(id) => setHiddenIds((prev) => { const n = new Set(prev); n.delete(id); return n })}
            onClose={() => setHiddenPanelOpen(false)}
          />
        )}
      </div>
      {selectedRowIds.size > 0 && (
        <span className="text-text-secondary">
          {selectedRowIds.size} row{selectedRowIds.size === 1 ? '' : 's'} selected — right-click for actions, or{' '}
          <button onClick={() => setSelectedRowIds(new Set())} className="text-accent hover:underline">
            clear
          </button>
        </span>
      )}
    </div>
  )

  const contextMenuNode = contextMenu && (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      count={contextMenuTargets().length}
      onHide={handleContextHide}
      onDelete={handleContextDelete}
      onDuplicate={handleContextDuplicate}
      onClose={() => setContextMenu(null)}
    />
  )

  if (!grouped) {
    return (
      <div>
        {controls}
        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <TaskRowsTable rows={sortedFlatTasks} {...sharedProps} />
        </div>
        {contextMenuNode}
      </div>
    )
  }

  return (
    <div>
      {controls}
      <div className="space-y-8">
        {filteredTasks.length === 0 && !showAddRow ? (
          <p className="text-sm text-text-secondary">{emptyMessage}</p>
        ) : (
          Array.from(groupedSorted.entries()).map(([dept, deptTasks], i) => (
            <div key={dept}>
              <p className="text-base font-bold uppercase tracking-wide text-text mb-2">{departmentLabel(dept, deptLabels)}</p>
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <TaskRowsTable rows={deptTasks} {...sharedProps} showAddRow={false} headerInteractive={i === 0} />
              </div>
            </div>
          ))
        )}
        {showAddRow && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <Colgroup columns={columns} widths={widths} />
              <tbody>
                <AddRow columns={columns} departments={departments} userOptions={userOptions} defaultPriority={defaultPriority} onAddTask={onAddTask} />
              </tbody>
            </table>
          </div>
        )}
      </div>
      {contextMenuNode}
    </div>
  )
}
