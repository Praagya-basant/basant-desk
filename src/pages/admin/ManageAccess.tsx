import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchPermissions, fetchUserPermissionIds, saveUserPermissions } from '../../lib/admin/permissions'
import { logActivity } from '../../lib/activityLog'
import { getDepartment } from '../../config/departments'
import type { Permission, UserProfile } from '../../types'

export default function ManageAccess() {
  const { profile } = useAuth()

  const [users, setUsers] = useState<UserProfile[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [initialChecked, setInitialChecked] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState(true)
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('*').order('full_name'),
      fetchPermissions(),
    ])
      .then(([usersRes, perms]) => {
        if (usersRes.error) throw usersRes.error
        const allUsers = (usersRes.data as UserProfile[]) ?? []
        setUsers(allUsers)
        setPermissions(perms)
        if (allUsers.length > 0) setSelectedUserId(allUsers[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load users or permissions.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedUserId) return
    let cancelled = false
    setLoadingGrants(true)
    setError(null)
    setSaved(false)
    fetchUserPermissionIds(selectedUserId)
      .then((ids) => {
        if (cancelled) return
        setChecked(ids)
        setInitialChecked(ids)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this user\'s permissions.')
      })
      .finally(() => {
        if (!cancelled) setLoadingGrants(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedUserId])

  const selectedUser = users.find((u) => u.id === selectedUserId)
  const hasFullAccess = selectedUser?.role === 'admin' || selectedUser?.role === 'manager'

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    ;(acc[p.department] ??= []).push(p)
    return acc
  }, {})

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dirty =
    checked.size !== initialChecked.size || Array.from(checked).some((id) => !initialChecked.has(id))

  async function handleSave() {
    if (!selectedUserId || !profile) return
    setSaving(true)
    setError(null)
    try {
      await saveUserPermissions(selectedUserId, Array.from(checked))
      setInitialChecked(new Set(checked))
      setSaved(true)
      await logActivity(profile.id, 'admin', 'permissions.updated', {
        target_user_id: selectedUserId,
        granted: Array.from(checked),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save permissions.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-text mb-1">Manage Access</h1>
      <p className="text-sm text-text-secondary mb-6">
        Grant specific users access to individual features, across any department.
      </p>

      <div className="mb-6">
        <label className="block text-sm text-text-secondary mb-1.5">User</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email} · {u.role}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loadingGrants ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : hasFullAccess ? (
        <p className="text-sm text-text-secondary">
          {selectedUser?.role === 'admin' ? 'Admins' : 'Managers'} already have full access — permissions aren't
          needed for this user.
        </p>
      ) : (
        <div>
          <div className="space-y-6">
            {Object.entries(grouped).map(([deptKey, perms]) => (
              <div key={deptKey}>
                <h2 className="text-sm font-medium text-text mb-2">{getDepartment(deptKey)?.label ?? deptKey}</h2>
                <div className="space-y-1.5">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={checked.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="rounded border-border"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {permissions.length === 0 && (
              <p className="text-sm text-text-secondary">No permissions have been registered yet.</p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-md bg-text text-bg text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && !dirty && <span className="text-sm text-text-secondary">Saved.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
