import { useState } from 'react'
import { Bell, ChevronLeft, X } from 'lucide-react'
import { useDepartments } from '../../hooks/useDepartments'
import { sendReminders } from '../../lib/coreManagement/db'
import { supabase } from '../../lib/supabase'

/** Manual, on-demand reminder sends — "Send to all", by department, or by
 * individual — reusing the same digest edge function the daily cron job
 * calls, just triggered explicitly instead of waiting for the schedule.
 * Lives in each task view's own action bar (left of Print/Export), not
 * tucked into the shell header as a bare icon — this is meant to be a
 * primary, easy-to-reach action, not a secondary one.
 *
 * Opens as a centered modal, not an anchored dropdown — a dropdown stacked
 * above/below the trigger button was clipping awkwardly at the edge of the
 * action bar once a submenu (department/individual) was open, per the
 * reported screenshot. Matches NewTaskModal's overlay pattern for
 * consistency with the rest of the module. */
export default function ReminderTrigger() {
  const { departments } = useDepartments()
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<'department' | 'user' | null>(null)
  const [users, setUsers] = useState<{ id: string; label: string }[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function openUserSubmenu() {
    setSubmenu('user')
    if (users.length === 0) {
      const { data } = await supabase.from('users').select('id, full_name, email').eq('is_active', true).order('full_name')
      const rows = (data as { id: string; full_name: string | null; email: string }[]) ?? []
      setUsers(rows.map((u) => ({ id: u.id, label: u.full_name || u.email })))
    }
  }

  async function trigger(params: Parameters<typeof sendReminders>[0]) {
    setSending(true)
    setResult(null)
    try {
      const res = await sendReminders(params)
      setResult(res.remindersSent ? `Sent ${res.remindersSent} reminder(s).` : 'Nothing due to send.')
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Failed to send reminders.')
    } finally {
      setSending(false)
    }
  }

  function close() {
    setOpen(false)
    setSubmenu(null)
    setResult(null)
  }

  const itemClass =
    'w-full flex items-center justify-between rounded-md px-3 py-2 text-sm text-text hover:bg-surface-2 active:bg-border/60 transition-colors disabled:opacity-50 disabled:pointer-events-none'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Send reminders now"
        className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 text-accent text-sm font-medium px-3 py-2 hover:bg-accent/20 active:bg-accent/30 transition-colors cm-no-print"
      >
        <Bell size={14} strokeWidth={1.75} />
        Send Reminder
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4 cm-no-print" onClick={close}>
          <div
            className="w-full max-w-sm bg-bg border border-border rounded-lg shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-1.5">
                {submenu !== null && (
                  <button
                    onClick={() => setSubmenu(null)}
                    title="Back"
                    className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors -ml-1"
                  >
                    <ChevronLeft size={16} strokeWidth={1.75} />
                  </button>
                )}
                <h2 className="text-sm font-medium text-text">
                  {submenu === 'department' ? 'Send by department' : submenu === 'user' ? 'Send by individual' : 'Send Reminders'}
                </h2>
              </div>
              <button
                onClick={close}
                className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="p-3">
              {result && <p className="px-2 pb-2 text-sm text-text-secondary">{result}</p>}

              {submenu === null && (
                <>
                  <button
                    disabled={sending}
                    onClick={() => trigger({ scope: 'all' })}
                    className={itemClass}
                  >
                    Send to all
                  </button>
                  <button onClick={() => setSubmenu('department')} className={itemClass}>
                    By department
                  </button>
                  <button onClick={openUserSubmenu} className={itemClass}>
                    By individual
                  </button>
                </>
              )}

              {submenu === 'department' && (
                <div className="max-h-72 overflow-y-auto">
                  {departments.map((d) => (
                    <button
                      key={d.key}
                      disabled={sending}
                      onClick={() => trigger({ scope: 'department', departmentKey: d.key })}
                      className={itemClass}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}

              {submenu === 'user' && (
                <div className="max-h-72 overflow-y-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      disabled={sending}
                      onClick={() => trigger({ scope: 'user', userId: u.id })}
                      className={itemClass}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
