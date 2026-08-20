import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { accessibleDepartments, roleLabel } from '../lib/access'

export default function Dashboard() {
  const { profile, permissionKeys, signOut } = useAuth()
  const departments = accessibleDepartments(profile, permissionKeys)

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-14 flex items-center justify-between px-8 border-b border-border">
        <span className="text-sm font-semibold tracking-tight text-text">BASANT Desk</span>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs font-medium text-text shrink-0">
            {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text truncate leading-tight">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-text-secondary capitalize leading-tight">{roleLabel(profile)}</p>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="text-text-secondary hover:text-text transition-colors shrink-0 ml-1"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="px-8 py-8">
        <h1 className="text-lg font-medium text-text mb-1">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-sm text-text-secondary mb-6">Pick a department to get started.</p>

        {departments.length === 0 ? (
          <p className="text-sm text-text-secondary">No departments assigned. Contact an admin to get access.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departments.map((dept) => (
              <Link
                key={dept.key}
                to={dept.route}
                className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
              >
                <dept.icon size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
                <p className="text-sm font-medium text-text mb-0.5">{dept.label}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
