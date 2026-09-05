import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { createTask, fetchTasks, fetchUserNames, softDeleteTasks, updateTask } from '../../lib/coreManagement/db'
import { departmentLabel, formatShortDate, isAutoOverdue, priorityLabel, statusLabel } from '../../lib/coreManagement/taskHelpers'
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

export default function DelayedTasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [userOptions, setUserOptions] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { departments, labels: deptLabels } = useDepartments()
  const cols = useColumnVisibility('delayed', DEFAULT_VISIBLE_COLUMNS)

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

  // showAddRow is false on this page (it's a derived/filtered view, not a
  // natural place to create tasks) but the context menu's "Duplicate row"
  // still needs a real handler — without one, duplicating from here would
  // silently no-op.
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

  // "Manually flagged" used to read the separate is_delayed_manual boolean —
  // that flag was folded into priority ('delayed' now means what
  // is_delayed_manual used to). Auto-overdue stays independent of priority,
  // exactly as before: any task past its current_deadline and not done, from
  // any priority tier, still surfaces here too.
  const autoOverdue = useMemo(() => tasks.filter(isAutoOverdue), [tasks])
  const manuallyFlagged = useMemo(() => tasks.filter((t) => t.priority === 'delayed'), [tasks])

  // Baseline for the print-options dialog — the union of both sections
  // (a task can be in both, so dedupe by id), since the dialog prints a
  // single grouped-by-department table rather than reproducing the
  // auto-overdue/manually-flagged split. "Delayed tasks only" isn't offered
  // as a dialog scope here — every task on this page already is one.
  const combinedDelayed = useMemo(() => {
    const byId = new Map(autoOverdue.map((t) => [t.id, t]))
    for (const t of manuallyFlagged) byId.set(t.id, t)
    return [...byId.values()]
  }, [autoOverdue, manuallyFlagged])

  const toExportRows = (list: Task[]) =>
    list.map((t, i) => ({
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
    }))

  const exportColumns = [
    { key: 'serial', header: '#' },
    ...TASK_COLUMNS.filter((c) => cols.visible.has(c.key)).map((c) => ({ key: c.key, header: c.label, width: excelWidth(c.weight), pdfWidth: pdfCellWidth(c.weight) })),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4 cm-no-print">
        <h1 className="text-lg font-medium text-text">Delayed</h1>
        <div className="flex items-center gap-2">
          <ColumnsMenu visible={cols.visible} onToggle={cols.toggle} />
          <ReminderTrigger />
          <ExportButtons
            columns={exportColumns}
            rows={[...toExportRows(autoOverdue), ...toExportRows(manuallyFlagged)]}
            filename="delayed-tasks"
            title="Delayed Tasks"
            orientation="landscape"
            printSource={{
              tasks: combinedDelayed,
              departments,
              users: userOptions,
              deptLabels,
              names,
              visibleColumns: cols.visible,
              scopeOptions: ['current', 'department', 'person'],
            }}
          />
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

      <div className="cm-no-print space-y-8">
        {loading && tasks.length === 0 ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-medium text-text mb-1.5">Auto-overdue</h2>
              <TaskTable
                tasks={autoOverdue}
                deptLabels={deptLabels}
                departments={departments}
                users={userOptions}
                visibleColumns={cols.visible}
                onUpdateTask={handleUpdateTask}
                onAddTask={handleAddTask}
                onDeleteTasks={handleDeleteTasks}
                showAddRow={false}
                emptyMessage="None."
              />
            </div>
            <div>
              <h2 className="text-sm font-medium text-text mb-1.5">Manually flagged (Priority: Delayed)</h2>
              <TaskTable
                tasks={manuallyFlagged}
                deptLabels={deptLabels}
                departments={departments}
                users={userOptions}
                visibleColumns={cols.visible}
                onUpdateTask={handleUpdateTask}
                onAddTask={handleAddTask}
                onDeleteTasks={handleDeleteTasks}
                showAddRow={false}
                emptyMessage="None."
              />
            </div>
          </>
        )}
      </div>

      {pendingDelete && <DeleteUndoToast count={pendingDelete.length} onUndo={handleUndoDelete} />}
    </div>
  )
}
