import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { setUserActive } from '../../lib/admin/permissions'
import { logActivity } from '../../lib/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import type { UserProfile } from '../../types'
import PurchaseUserFormModal from './PurchaseUserFormModal'

export default function PurchaseUsers() {
  const { profile: currentProfile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserProfile | null | undefined>(undefined)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .contains('departments', ['purchase'])
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setUsers((data as UserProfile[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function toggleActive(u: UserProfile, e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentProfile) return
    setTogglingId(u.id)
    setError(null)
    try {
      await setUserActive(u.id, !u.is_active)
      await logActivity(currentProfile.id, 'purchase', u.is_active ? 'purchase_user.deactivated' : 'purchase_user.reactivated', {
        target_user_id: u.id,
        email: u.email,
      })
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this user.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text">Purchase Users</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage users scoped to the Purchase department.</p>
        </div>
        <button
          onClick={() => setEditingUser(null)}
          className="flex items-center gap-1.5 rounded-md bg-text text-bg text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={15} strokeWidth={2} />
          Add user
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Name</th>
              <th className="font-medium px-4 py-2.5">Email</th>
              <th className="font-medium px-4 py-2.5">Role</th>
              <th className="font-medium px-4 py-2.5">Dept admin</th>
              <th className="font-medium px-4 py-2.5">Status</th>
              <th className="font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  No Purchase users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setEditingUser(u)}
                  className={`border-b border-border last:border-0 cursor-pointer hover:bg-surface transition-colors ${
                    !u.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 text-text">{u.full_name || '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-2.5 text-text capitalize">{u.role}</td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {u.department_admin_for?.includes('purchase') ? 'Yes' : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{u.is_active ? 'Active' : 'Deactivated'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={(e) => toggleActive(u, e)}
                      disabled={togglingId === u.id}
                      className="text-xs text-text-secondary hover:text-text transition-colors disabled:opacity-50"
                    >
                      {togglingId === u.id ? '…' : u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingUser !== undefined && (
        <PurchaseUserFormModal
          user={editingUser}
          onClose={() => setEditingUser(undefined)}
          onSaved={() => {
            setEditingUser(undefined)
            loadUsers()
          }}
        />
      )}
    </div>
  )
}
