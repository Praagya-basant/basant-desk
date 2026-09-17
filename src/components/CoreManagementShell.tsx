import { Link, NavLink, Outlet } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSidebarCollapse } from '../hooks/useSidebarCollapse'
import NotificationBell from './NotificationBell'

// Deliberately a hardcoded list, not driven by a config file — this module
// has exactly 7 views and is never shown to anyone but its 2 admins, so a
// generic config layer would be pure indirection.
const VIEWS = [
  { key: 'active', label: 'Active Tasks', route: '/core-management' },
  { key: 'all', label: 'All Tasks', route: '/core-management/all' },
  { key: 'delayed', label: 'Delayed', route: '/core-management/delayed' },
  { key: 'points', label: "Today's Points", route: '/core-management/points' },
  { key: 'meetings', label: 'Meetings', route: '/core-management/meetings' },
  { key: 'scratch', label: 'Scratch Sheet', route: '/core-management/scratch' },
  { key: 'deleted', label: 'Deleted Tasks', route: '/core-management/deleted' },
]

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60'
  }`

export default function CoreManagementShell() {
  const { profile, signOut } = useAuth()
  const { collapsed, toggle } = useSidebarCollapse()

  return (
    <div className="flex min-h-screen bg-bg">
      {!collapsed && (
        <aside className="w-52 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col cm-no-print">
          <div className="px-4 py-4 flex items-center justify-between">
            <div>
              <Link to="/" className="text-sm font-semibold tracking-tight text-text">
                BASANT Desk
              </Link>
              <p className="text-xs text-text-secondary mt-0.5">Core Management</p>
            </div>
            <button
              onClick={toggle}
              title="Collapse sidebar (Ctrl/Cmd+B)"
              className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors shrink-0"
            >
              <PanelLeftClose size={16} strokeWidth={1.75} />
            </button>
          </div>

          <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto">
            {VIEWS.map((view) => (
              <NavLink key={view.key} to={view.route} end={view.route === '/core-management'} className={navItemClass}>
                {view.label}
              </NavLink>
            ))}
          </nav>

          <div className="px-2.5 py-3 border-t border-border">
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">
              <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs font-medium text-text shrink-0">
                {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text truncate">{profile?.full_name || profile?.email}</p>
                <p className="text-xs text-text-secondary">Core Management Admin</p>
              </div>
              <button
                onClick={() => signOut()}
                title="Sign out"
                className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors shrink-0"
              >
                <LogOut size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-border cm-no-print">
          {collapsed ? (
            <button
              onClick={toggle}
              title="Show sidebar (Ctrl/Cmd+B)"
              className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors"
            >
              <PanelLeftOpen size={16} strokeWidth={1.75} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 px-6 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
