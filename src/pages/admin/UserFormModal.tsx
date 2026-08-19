import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { createUser } from '../../lib/admin/createUser'
import { logActivity } from '../../lib/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { DEPARTMENTS } from '../../config/departments'
import type { Role, UserProfile } from '../../types'

// The "Admin" entry in DEPARTMENTS is the global admin section itself, not a
// real business department — it never makes sense to assign someone as a
// member or department-admin "of Admin" (that's just the role field).
const ASSIGNABLE_DEPARTMENTS = DEPARTMENTS.filter((d) => d.key !== 'admin')

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function UserFormModal({
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
  const [role, setRole] = useState<Role>(user?.role ?? 'custom')
  const [departments, setDepartments] = useState<string[]>(user?.departments ?? [])
  const [departmentAdminFor, setDepartmentAdminFor] = useState<string[]>(user?.department_admin_for ?? [])
  const [hall, setHall] = useState(user?.hall ?? '')
  const [buyers, setBuyers] = useState(user?.buyers?.join(', ') ?? '')
  const [password, setPassword] = useState(() => (isNew ? generatePassword() : ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdNotice, setCreatedNotice] = useState<string | null>(null)

  function toggleDept(key: string) {
    setDepartments((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]))
  }

  function toggleDeptAdmin(key: string) {
    setDepartmentAdminFor((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      full_name: fullName || null,
      email,
      role,
      departments,
      hall: role === 'manager' ? hall || null : null,
      buyers: role === 'merchant' ? (buyers.split(',').map((b) => b.trim()).filter(Boolean)) : null,
      department_admin_for: role === 'admin' ? [] : departmentAdminFor,
    }

    if (isNew) {
      try {
        await createUser({ ...payload, password })
        setSaving(false)
        setCreatedNotice(`Account created. Share this password with them so they can sign in: ${password}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the account.')
        setSaving(false)
      }
      return
    }

    const { error: updateError } = await supabase.from('users').update(payload).eq('id', user!.id)
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (currentProfile) {
      await logActivity(currentProfile.id, 'admin', 'user.updated', {
        target_user_id: user!.id,
        role,
        departments,
        department_admin_for: payload.department_admin_for,
      })
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">{isNew ? 'Add user' : 'Edit user'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {createdNotice ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-text">{createdNotice}</p>
            <button
              onClick={onSaved}
              className="w-full rounded-md bg-text text-bg text-sm font-medium py-2 hover:opacity-90 transition-opacity"
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
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="merchant">Merchant</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {role === 'manager' && (
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Hall</label>
                <input
                  value={hall}
                  onChange={(e) => setHall(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
                />
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
              </div>
            )}

            {role === 'admin' || role === 'manager' ? (
              <div>
                <label className="block text-sm text-text-secondary mb-2">Departments</label>
                <div className="space-y-1.5">
                  {ASSIGNABLE_DEPARTMENTS.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={departments.includes(d.key)}
                        onChange={() => toggleDept(d.key)}
                        className="rounded border-border"
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-text-secondary mt-1.5">
                  {role === 'admin'
                    ? 'Admins see every department regardless of this list.'
                    : 'Managers get full access to everything in each department checked here.'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-secondary">
                Feature access for Custom and Merchant users is granted from Manage Access, not here.
              </p>
            )}

            {role !== 'admin' && (
              <div>
                <label className="block text-sm text-text-secondary mb-2">Department admin for</label>
                <div className="space-y-1.5">
                  {ASSIGNABLE_DEPARTMENTS.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={departmentAdminFor.includes(d.key)}
                        onChange={() => toggleDeptAdmin(d.key)}
                        className="rounded border-border"
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-text-secondary mt-1.5">
                  Full admin-equivalent power, scoped to just that department — can manage its price grid, edit
                  saved data, and manage its users.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

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
                className="flex-1 rounded-md bg-text text-bg text-sm font-medium py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
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
