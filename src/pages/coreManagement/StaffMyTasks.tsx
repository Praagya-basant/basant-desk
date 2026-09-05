import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  addOwnRemark,
  fetchOwnTaskRemarks,
  fetchStaffOwnTasks,
  fetchUserNames,
  updateOwnDeadline,
} from '../../lib/coreManagement/db'
import type { StaffOwnTask, TaskRemark } from '../../lib/coreManagement/dbTypes'
import { departmentLabel } from '../../lib/coreManagement/taskHelpers'
import { useDepartments } from '../../hooks/useDepartments'

/** The narrow staff surface, separate from the admin module entirely — read-only
 * on every field except current_deadline, plus a remarks compose box. Staff
 * never see status/official_remarks/priority: the view this reads from
 * (staff_own_tasks_view) doesn't select those columns at all, and never sees
 * a soft-deleted task either — the view's WHERE clause excludes is_deleted
 * rows outright rather than exposing the flag for the frontend to filter. */
export default function StaffMyTasks() {
  const { profile, signOut } = useAuth()
  const { labels: deptLabels } = useDepartments()
  const [tasks, setTasks] = useState<StaffOwnTask[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<TaskRemark[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [newRemark, setNewRemark] = useState('')

  async function load() {
    setLoading(true)
    setTasks(await fetchStaffOwnTasks())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleExpand(task: StaffOwnTask) {
    if (expandedId === task.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(task.id)
    const r = await fetchOwnTaskRemarks(task.id)
    setRemarks(r)
    setNames(await fetchUserNames(r.map((x) => x.author_user_id)))
  }

  async function handleDeadlineChange(taskId: string, value: string) {
    await updateOwnDeadline(taskId, value)
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, current_deadline: value } : t)))
  }

  async function handlePostRemark(taskId: string) {
    if (!profile || !newRemark.trim()) return
    await addOwnRemark(taskId, profile.id, newRemark.trim())
    setNewRemark('')
    const r = await fetchOwnTaskRemarks(taskId)
    setRemarks(r)
    setNames(await fetchUserNames(r.map((x) => x.author_user_id)))
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-14 flex items-center justify-between px-8 border-b border-border">
        <span className="text-sm font-semibold tracking-tight text-text">My Tasks</span>
        <button onClick={() => signOut()} className="text-text-secondary hover:text-text transition-colors">
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-text-secondary">No tasks assigned to you.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <div key={t.id} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between cursor-pointer" onClick={() => toggleExpand(t)}>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">
                      {t.task_number} · {departmentLabel(t.department, deptLabels)}
                    </p>
                    <p className="text-sm text-text">{t.task_description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <label className="text-xs text-text-secondary">Deadline</label>
                  <input
                    type="date"
                    value={t.current_deadline ?? ''}
                    onChange={(e) => handleDeadlineChange(t.id, e.target.value)}
                    className="text-sm text-text bg-transparent outline-none border-b border-border"
                  />
                </div>

                {expandedId === t.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="space-y-2 mb-3">
                      {remarks.length === 0 ? (
                        <p className="text-xs text-text-secondary">No remarks yet.</p>
                      ) : (
                        remarks.map((r) => (
                          <div key={r.id} className="border-l-2 border-border pl-3">
                            <p className="text-xs text-text-secondary">
                              {names.get(r.author_user_id) ?? '—'} · {new Date(r.created_at).toLocaleString()}
                            </p>
                            <p className="text-sm text-text mt-0.5 whitespace-pre-wrap">{r.remark_text}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={newRemark}
                        onChange={(e) => setNewRemark(e.target.value)}
                        placeholder="Add an update…"
                        className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
                      />
                      <button
                        onClick={() => handlePostRemark(t.id)}
                        className="self-end rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover active:bg-accent-hover transition-colors"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
