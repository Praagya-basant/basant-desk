import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useDepartments } from '../../hooks/useDepartments'
import { createTask } from '../../lib/coreManagement/db'
import type { Task, TaskPriority } from '../../lib/coreManagement/dbTypes'

interface UserOption {
  id: string
  label: string
}

/** Shared create form — used standalone (Active/All Tasks "New Task") and
 * pre-filled from a Today's Point via the onCreate override, which routes
 * through convertPointToTask instead of a plain createTask. Never automatic —
 * always requires this modal's explicit submit. */
export default function NewTaskModal({
  onClose,
  onSaved,
  initialDescription,
  onCreate,
}: {
  onClose: () => void
  onSaved: (task: Task) => void
  initialDescription?: string
  onCreate?: (draft: Parameters<typeof createTask>[0]) => Promise<Task>
}) {
  const { profile } = useAuth()
  const { departments } = useDepartments()
  const [priority, setPriority] = useState<TaskPriority>('active')
  const [department, setDepartment] = useState('')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [responsibleUserId, setResponsibleUserId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!department && departments.length > 0) setDepartment(departments[0].key)
  }, [departments, department])

  useEffect(() => {
    supabase
      .from('users')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => {
        const rows = (data as { id: string; full_name: string | null; email: string }[]) ?? []
        setUsers(rows.map((u) => ({ id: u.id, label: u.full_name || u.email })))
      })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || !responsibleUserId || !deadline) return
    setSaving(true)
    setError(null)

    const draft = {
      priority,
      department,
      task_description: description,
      responsible_user_id: responsibleUserId,
      current_deadline: deadline,
      created_by: profile.id,
    }

    try {
      const task = onCreate ? await onCreate(draft) : await createTask(draft)
      onSaved(task)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">New task</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            >
              <option value="tasklist">Tasklist</option>
              <option value="active">Active Task</option>
              <option value="delayed">Delayed</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            >
              {departments.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Description</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Responsible</label>
            <select
              required
              value={responsibleUserId}
              onChange={(e) => setResponsibleUserId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            >
              <option value="" disabled>
                Select a person
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Deadline</label>
            <input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border text-text text-sm font-medium py-2 hover:bg-surface-2 active:bg-border/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover active:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
