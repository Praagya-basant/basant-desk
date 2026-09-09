import { NavLink } from 'react-router-dom'
import { LogOut, ClipboardList, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { accessibleDepartments, isAdmin, roleLabel } from '../lib/access'
import { useCoreManagementAdmin } from '../hooks/useCoreManagementAdmin'

export default function Sidebar() {
  const { profile, moduleAccess, signOut } = useAuth()
  const departments = accessibleDepartments(profile, moduleAccess)
  const { allowed: coreManagementAllowed } = useCoreManagementAdmin()
  // Global admins reach Access Control via the "Admin" department link; a
  // department admin gets a direct link (their /admin area is just this page).
  const showAccessControlLink = !isAdmin(profile) && (profile?.department_admin_for?.length ?? 0) > 0

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
      </nav>

      {(showAccessControlLink || coreManagementAllowed) && (
        <div className="px-3 pb-3 space-y-0.5">
          {showAccessControlLink && (
            <NavLink
              to="/admin/access-control"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
                }`
              }
            >
              <ShieldCheck size={16} strokeWidth={1.75} />
              Access Control
            </NavLink>
          )}
          {coreManagementAllowed && (
            <NavLink
              to="/core-management"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-text-secondary hover:text-text transition-colors"
            >
              <ClipboardList size={16} strokeWidth={1.75} />
              Core Management
            </NavLink>
          )}
        </div>
      )}

      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs font-medium text-text shrink-0">
            {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text truncate">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-text-secondary capitalize">{roleLabel(profile)}</p>
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
