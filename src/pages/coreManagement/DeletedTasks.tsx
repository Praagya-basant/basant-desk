import { useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { fetchDeletedTasks, fetchUserNames, purgeTask, restoreTask } from '../../lib/coreManagement/db'
import { departmentLabel, formatShortDate, priorityLabel } from '../../lib/coreManagement/taskHelpers'
import { useDepartments } from '../../hooks/useDepartments'
import type { Task } from '../../lib/coreManagement/dbTypes'

/** Admin-only view of soft-deleted tasks (is_deleted = true) — the other
 * half of the soft-delete flow started by TaskTable's delete action /
 * useUndoableDelete's 5s grace window. Deliberately a plain read-only list,
 * not the full editable TaskTable: a deleted task shouldn't be edited in
 * place, only restored (back to normal, editable again from wherever it
 * came from) or permanently purged. */
export default function DeletedTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { labels: deptLabels } = useDepartments()

  async function load() {
    setLoading(true)
    const rows = await fetchDeletedTasks()
    setTasks(rows)
    setNames(await fetchUserNames(rows.map((t) => t.responsible_user_id)))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRestore(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    try {
      await restoreTask(task.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore task.')
      load()
    }
  }

  async function handlePurge(task: Task) {
    if (!window.confirm(`Permanently delete task ${task.task_number}? This removes it from the database entirely and cannot be undone.`)) {
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    try {
      await purgeTask(task.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge task.')
      load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-text">Deleted Tasks</h1>
        <p className="text-xs text-text-secondary">Restore a task, or purge it permanently — purging cannot be undone.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">
          {error}{' '}
          <button onClick={() => setError(null)} className="underline hover:text-red-700 active:text-red-800 transition-colors">
            dismiss
          </button>
        </p>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-text-secondary">No deleted tasks.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '34%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr className="bg-accent/10 border-b-2 border-accent/30 text-left text-text">
                <th className="font-semibold px-2 py-2 text-xs uppercase tracking-wide border-r border-accent/20">Task #</th>
                <th className="font-semibold px-2 py-2 text-xs uppercase tracking-wide border-r border-accent/20">Department</th>
                <th className="font-semibold px-2 py-2 text-xs uppercase tracking-wide border-r border-accent/20">Task</th>
                <th className="font-semibold px-2 py-2 text-xs uppercase tracking-wide border-r border-accent/20">Responsible</th>
                <th className="font-semibold px-2 py-2 text-xs uppercase tracking-wide border-r border-accent/20 text-center">Priority</th>
                <th className="font-semibold px-2 py-2 text-xs uppercase tracking-wide border-r border-accent/20 text-right">Deleted</th>
                <th className="font-semibold px-2 py-2 text-xs uppercase tracking-wide text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                  <td className="px-2 py-1.5 border-r border-border text-text-secondary">{t.task_number}</td>
                  <td className="px-2 py-1.5 border-r border-border">{departmentLabel(t.department, deptLabels)}</td>
                  <td className="px-2 py-1.5 border-r border-border align-top">{t.task_description}</td>
                  <td className="px-2 py-1.5 border-r border-border">{names.get(t.responsible_user_id) ?? '—'}</td>
                  <td className="px-2 py-1.5 border-r border-border text-center">{priorityLabel(t.priority)}</td>
                  <td className="px-2 py-1.5 border-r border-border text-right text-text-secondary">
                    {t.deleted_at ? formatShortDate(t.deleted_at.slice(0, 10)) : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleRestore(t)}
                        title="Restore task"
                        className="text-text-muted hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded p-1 transition-colors"
                      >
                        <RotateCcw size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => handlePurge(t)}
                        title="Purge permanently"
                        className="text-text-muted hover:text-red-600 hover:bg-red-50 active:bg-red-100 rounded p-1 transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
