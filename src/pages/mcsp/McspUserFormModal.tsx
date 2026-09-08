import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { createUser } from '../../lib/admin/createUser'
import { logActivity } from '../../lib/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { fetchHalls } from '../../lib/mcsp/db'
import type { Hall } from '../../lib/mcsp/dbTypes'
import type { Role, UserProfile } from '../../types'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function McspUserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserProfile | null
  onClose: () => void
  onSaved: () => void
}) {
  const { profile: currentProfile } = useAuth()
  const isNew = user === null

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Exclude<Role, 'admin'>>(
    user?.role === 'admin' ? 'custom' : (user?.role ?? 'custom'),
  )
  const [isDeptAdmin, setIsDeptAdmin] = useState(user?.department_admin_for?.includes('sales') ?? false)
  const [hall, setHall] = useState(user?.hall ?? '')
  const [buyers, setBuyers] = useState(user?.buyers?.join(', ') ?? '')
  const [password, setPassword] = useState(() => (isNew ? generatePassword() : ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdNotice, setCreatedNotice] = useState<string | null>(null)
  const [halls, setHalls] = useState<Hall[]>([])

  useEffect(() => {
    fetchHalls().then(setHalls).catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const common = {
      full_name: fullName || null,
      email,
      role,
      hall: role === 'manager' ? hall.trim() || null : null,
      buyers: role === 'merchant' ? buyers.split(',').map((b) => b.trim()).filter(Boolean) : null,
    }

    // Only ever touch this user's SALES membership — never overwrite the
    // departments / department_admin_for they hold in other modules (Purchase,
    // Yaamya, …). Merge 'sales' in/out of whatever they already have.
    const existingDepartments = user?.departments ?? []
    const existingDeptAdmin = user?.department_admin_for ?? []
    const mergedDepartments = existingDepartments.includes('sales')
      ? existingDepartments
      : [...existingDepartments, 'sales']
    const mergedDeptAdmin = isDeptAdmin
      ? existingDeptAdmin.includes('sales')
        ? existingDeptAdmin
        : [...existingDeptAdmin, 'sales']
      : existingDeptAdmin.filter((d) => d !== 'sales')

    if (isNew) {
      try {
        await createUser({ ...common, password, departments: ['sales'], department_admin_for: isDeptAdmin ? ['sales'] : [] })
        setSaving(false)
        setCreatedNotice(`Account created. Share this password with them so they can sign in: ${password}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the account.')
        setSaving(false)
      }
      return
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ ...common, departments: mergedDepartments, department_admin_for: mergedDeptAdmin })
      .eq('id', user!.id)
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (currentProfile) {
      await logActivity(currentProfile.id, 'sales', 'mcsp_user.updated', {
        target_user_id: user!.id,
        role,
        department_admin_for: mergedDeptAdmin,
      })
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">{isNew ? 'Add MCSP user' : 'Edit MCSP user'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {createdNotice ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-text">{createdNotice}</p>
            <button
              onClick={onSaved}
              className="w-full rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                required
                disabled={!isNew}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors disabled:opacity-60"
              />
            </div>

            {isNew && (
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Password</label>
                <div className="flex gap-2">
                  <input
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text font-mono outline-none focus:border-text-secondary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    className="rounded-md border border-border text-text text-sm px-3 hover:bg-surface transition-colors"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1.5">At least 8 characters. Share this with the user so they can sign in.</p>
              </div>
            )}

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Exclude<Role, 'admin'>)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
              >
                <option value="manager">Manager (hall manager)</option>
                <option value="merchant">Merchant</option>
                <option value="custom">Custom</option>
              </select>
              <p className="text-xs text-text-secondary mt-1.5">
                Scoped to Sales (MCSP) only. To assign a global Admin role, use the main Admin &gt; Users page.
              </p>
            </div>

            {role === 'manager' && (
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Hall</label>
                <select
                  value={hall}
                  onChange={(e) => setHall(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
                >
                  <option value="">Select…</option>
                  {halls.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                  {hall && !halls.some((h) => h.name === hall) && <option value={hall}>{hall} (unknown — fix)</option>}
                </select>
                <p className="text-xs text-text-secondary mt-1.5">Pick from existing halls (manage them in MCSP &gt; Halls).</p>
              </div>
            )}

            {role === 'merchant' && (
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Buyers (comma-separated)</label>
                <input
                  value={buyers}
                  onChange={(e) => setBuyers(e.target.value)}
                  placeholder="MDM, Joon Loloi"
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
                />
                <p className="text-xs text-text-secondary mt-1.5">Must match buyer names exactly (see MCSP &gt; Buyers).</p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={isDeptAdmin}
                onChange={(e) => setIsDeptAdmin(e.target.checked)}
                className="rounded border-border"
              />
              Make this person a Sales department admin
            </label>
            <p className="text-xs text-text-secondary -mt-2">
              Full admin-equivalent power within Sales only — can manage buyers/halls, edit any sample or panel, and
              manage other Sales/MCSP users.
            </p>

            {error && <p className="text-sm text-warning">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-border text-text text-sm font-medium py-2 hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : isNew ? 'Create user' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
