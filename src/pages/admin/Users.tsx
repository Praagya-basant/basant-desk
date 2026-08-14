import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { UserProfile } from '../../types'
import UserFormModal from './UserFormModal'

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserProfile | null | undefined>(undefined)

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text">Users</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage who has access to which departments.</p>
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
              <th className="font-medium px-4 py-2.5">Departments</th>
              <th className="font-medium px-4 py-2.5">Hall / Buyers</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setEditingUser(u)}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-surface transition-colors"
                >
                  <td className="px-4 py-2.5 text-text">{u.full_name || '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-2.5 text-text capitalize">{u.role}</td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {u.departments?.length ? u.departments.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {u.role === 'manager' ? u.hall || '—' : u.role === 'merchant' ? u.buyers?.join(', ') || '—' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingUser !== undefined && (
        <UserFormModal
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
