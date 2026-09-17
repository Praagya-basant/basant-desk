import { Link, NavLink, useLocation } from 'react-router-dom'
import { LogOut, ClipboardList, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin, roleLabel } from '../lib/access'
import { getDepartment } from '../config/departments'
import { useCoreManagementAdmin } from '../hooks/useCoreManagementAdmin'
import DepartmentNav from './sidebar/DepartmentNav'
import SalesNav from './sidebar/SalesNav'
import McspNav from './sidebar/McspNav'
import PurchaseNav from './sidebar/PurchaseNav'
import YaamyaNav from './sidebar/YaamyaNav'

/**
 * ONE sidebar, whole app. Its content swaps by route — department list on the
 * main dashboard, that department's modules once inside it, and a module's own
 * nav (e.g. MCS/MCP) once inside that. No second sidebar is ever rendered
 * alongside content — going back up a level is the breadcrumb in Layout.tsx,
 * not a nested nav panel. See docs/design-system.md navigation shell.
 */
function SidebarContent() {
  const location = useLocation()
  const dept = getDepartment(location.pathname.replace(/^\//, '').split('/')[0])

  if (!dept) return <DepartmentNav />

  switch (dept.key) {
    case 'sales':
      return location.pathname.startsWith('/sales/mcsp') ? <McspNav /> : <SalesNav />
    case 'purchase':
      return <PurchaseNav />
    case 'yaamya':
      return <YaamyaNav />
    default:
      // production, hr, admin — nothing built yet; department list is still
      // a meaningful "where am I" view rather than an empty panel.
      return <DepartmentNav />
  }
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const { allowed: coreManagementAllowed } = useCoreManagementAdmin()
  // Global admins reach Access Control via the "Admin" department link; a
  // department admin gets a direct link (their /admin area is just this page).
  const showAccessControlLink = !isAdmin(profile) && (profile?.department_admin_for?.length ?? 0) > 0

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col">
      <div className="px-5 py-5">
        <Link to="/" className="text-sm font-semibold tracking-tight text-text hover:opacity-80 transition-opacity" title="Dashboard">
          BASANT Desk
        </Link>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        <SidebarContent />
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
