import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { createTask, fetchTasks, fetchUserNames, softDeleteTasks, updateTask } from '../../lib/coreManagement/db'
import { departmentLabel, formatShortDate, priorityLabel, statusLabel } from '../../lib/coreManagement/taskHelpers'
import { useCoreManagementRealtime } from '../../hooks/useCoreManagementRealtime'
import { useDepartments } from '../../hooks/useDepartments'
import { useColumnVisibility } from '../../hooks/useColumnVisibility'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { DEFAULT_VISIBLE_COLUMNS, TASK_COLUMNS, excelWidth, pdfCellWidth } from '../../lib/coreManagement/columns'
import type { Task } from '../../lib/coreManagement/dbTypes'
import ExportButtons from '../../components/ExportButtons'
import ColumnsMenu from '../../components/coreManagement/ColumnsMenu'
import TaskTable from '../../components/coreManagement/TaskTable'
import ReminderTrigger from '../../components/coreManagement/ReminderTrigger'
import DeleteUndoToast from '../../components/coreManagement/DeleteUndoToast'
import AIExtractModal from './AIExtractModal'

export default function AllTasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [userOptions, setUserOptions] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'grouped' | 'flat'>('grouped')
  const [filterDept, setFilterDept] = useState('')
  const [showAIExtract, setShowAIExtract] = useState(false)
  const { departments, labels: deptLabels } = useDepartments()
  const cols = useColumnVisibility('all', DEFAULT_VISIBLE_COLUMNS)

  async function load() {
    setLoading(true)
    const [rows, usersRes] = await Promise.all([
      fetchTasks(),
      supabase.from('users').select('id, full_name, email').eq('is_active', true).order('full_name'),
    ])
    setTasks(rows)
    setNames(await fetchUserNames(rows.map((t) => t.responsible_user_id)))
    const rawUsers = (usersRes.data as { id: string; full_name: string | null; email: string }[]) ?? []
    setUserOptions(rawUsers.map((u) => ({ id: u.id, label: u.full_name || u.email })))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useCoreManagementRealtime({
    onTaskChange: ({ eventType, row, oldId }) => {
      setTasks((prev) => {
        if (eventType === 'DELETE' || row.is_deleted) return prev.filter((t) => t.id !== (oldId ?? row.id))
        const exists = prev.some((t) => t.id === row.id)
        return exists ? prev.map((t) => (t.id === row.id ? row : t)) : [row, ...prev]
      })
    },
  })

  async function handleUpdateTask(id: string, changes: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)))
    try {
      await updateTask(id, changes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save change.')
      load()
    }
  }

  async function handleAddTask(draft: {
    priority: Task['priority']
    department: string
    task_description: string
    responsible_user_id: string
    current_deadline: string | null
  }) {
    if (!profile) return
    try {
      const task = await createTask({
        priority: draft.priority,
        department: draft.department,
        task_description: draft.task_description,
        responsible_user_id: draft.responsible_user_id,
        current_deadline: draft.current_deadline ?? '',
        created_by: profile.id,
      })
      setTasks((prev) => [task, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task.')
    }
  }

  const { pendingDelete, requestDelete, undo } = useUndoableDelete<Task>(async (deleted) => {
    try {
      await softDeleteTasks(deleted.map((t) => t.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task.')
      load()
    }
  })

  function handleDeleteTasks(targets: Task[]) {
    const ids = new Set(targets.map((t) => t.id))
    setTasks((prev) => prev.filter((t) => !ids.has(t.id)))
    requestDelete(targets)
  }

  function handleUndoDelete() {
    if (!pendingDelete) return
    setTasks((prev) => [...pendingDelete, ...prev])
    undo()
  }

  const filtered = useMemo(
    () => (filterDept ? tasks.filter((t) => t.department === filterDept) : tasks),
    [tasks, filterDept],
  )

  const exportRows = useMemo(
    () =>
      filtered.map((t, i) => ({
        serial: i + 1,
        task_number: t.task_number,
        department: departmentLabel(t.department, deptLabels),
        task_description: t.task_description,
        responsible: names.get(t.responsible_user_id) ?? '—',
        added_at: formatShortDate(t.added_at.slice(0, 10)),
        initial_deadline: formatShortDate(t.initial_deadline),
        current_deadline: formatShortDate(t.current_deadline),
        official_remarks: t.official_remarks ?? '',
        status: statusLabel(t.status),
        priority: priorityLabel(t.priority),
      })),
    [filtered, names, deptLabels],
  )

  const exportColumns = [
    { key: 'serial', header: '#' },
    ...TASK_COLUMNS.filter((c) => cols.visible.has(c.key)).map((c) => ({ key: c.key, header: c.label, width: excelWidth(c.weight), pdfWidth: pdfCellWidth(c.weight) })),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3 cm-no-print">
        <h1 className="text-lg font-medium text-text">All Tasks</h1>
        <div className="flex items-center gap-2">
          <ColumnsMenu visible={cols.visible} onToggle={cols.toggle} />
          <ReminderTrigger />
          <ExportButtons
            columns={exportColumns}
            rows={exportRows}
            filename="all-tasks"
            title="All Tasks"
            orientation="landscape"
            printSource={{
              tasks: filtered,
              departments,
              users: userOptions,
              deptLabels,
              names,
              visibleColumns: cols.visible,
            }}
          />
          <button
            onClick={() => setShowAIExtract(true)}
            className="flex items-center gap-1.5 rounded-md border border-border text-text text-sm px-3 py-2 hover:bg-surface-2 active:bg-border/60 transition-colors"
          >
            <Sparkles size={14} strokeWidth={1.75} className="text-accent" />
            Add via AI
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3 cm-no-print">
          {error}{' '}
          <button onClick={() => setError(null)} className="underline hover:text-red-700 active:text-red-800 transition-colors">
            dismiss
          </button>
        </p>
      )}

      {showAIExtract && (
        <AIExtractModal
          departments={departments}
          users={userOptions}
          onClose={() => setShowAIExtract(false)}
          onSaved={() => {
            setShowAIExtract(false)
            load()
          }}
        />
      )}

      <div className="flex items-center gap-2 mb-3 cm-no-print">
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setMode('grouped')}
            className={`px-3 py-1.5 text-sm transition-colors ${mode === 'grouped' ? 'bg-text text-bg' : 'text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60'}`}
          >
            Department wise
          </button>
          <button
            onClick={() => setMode('flat')}
            className={`px-3 py-1.5 text-sm transition-colors ${mode === 'flat' ? 'bg-text text-bg' : 'text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60'}`}
          >
            All Tasks
          </button>
        </div>

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none hover:bg-surface-2 focus:border-accent transition-colors cursor-pointer"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="cm-no-print">
        {loading && tasks.length === 0 ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <TaskTable
            tasks={filtered}
            deptLabels={deptLabels}
            departments={departments}
            users={userOptions}
            visibleColumns={cols.visible}
            grouped={mode === 'grouped'}
            onUpdateTask={handleUpdateTask}
            onAddTask={handleAddTask}
            onDeleteTasks={handleDeleteTasks}
            defaultPriority="tasklist"
            emptyMessage="No tasks."
          />
        )}
      </div>

      {pendingDelete && <DeleteUndoToast count={pendingDelete.length} onUndo={handleUndoDelete} />}
    </div>
  )
}
