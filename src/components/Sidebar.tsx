import { NavLink } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { accessibleDepartments } from '../lib/access'

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const departments = accessibleDepartments(profile)

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col">
      <div className="px-5 py-5">
        <span className="text-sm font-semibold tracking-tight text-text">BASANT Desk</span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {departments.map((dept) => (
          <NavLink
            key={dept.key}
            to={dept.route}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-bg text-text border border-border'
                  : 'text-text-secondary hover:text-text'
              }`
            }
          >
            <dept.icon size={16} strokeWidth={1.75} />
            {dept.label}
          </NavLink>
        ))}

        {profile?.role === 'admin' && (
          <>
            <div className="h-px bg-border my-2 mx-3" />
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-bg text-text border border-border'
                    : 'text-text-secondary hover:text-text'
                }`
              }
            >
              <ShieldCheck size={16} strokeWidth={1.75} />
              Users
            </NavLink>
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs font-medium text-text shrink-0">
            {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text truncate">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-text-secondary capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="text-text-secondary hover:text-text transition-colors shrink-0"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  )
}
