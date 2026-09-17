import { Link, Outlet, useLocation } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import Sidebar from './Sidebar'
import { getDepartment } from '../config/departments'
import { getBreadcrumbTrail } from '../config/subModules'

/** Breadcrumb at the top of every department's content area — the way back
 * up, since the sidebar no longer keeps the department switcher visible once
 * you're inside a department (see Sidebar.tsx). Every level but the current
 * one is a link. */
export default function Layout() {
  const location = useLocation()
  const dept = getDepartment(location.pathname.replace(/^\//, '').split('/')[0])
  const trail = getBreadcrumbTrail(location.pathname)

  const crumbs = dept
    ? [{ label: dept.label, to: dept.route }, ...trail.map((m) => ({ label: m.label, to: m.route }))]
    : []

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {dept && (
          <header className="h-14 shrink-0 flex items-center gap-1.5 px-8 border-b border-border">
            <Link to="/" title="Dashboard" className="text-text-secondary hover:text-text transition-colors">
              <LayoutGrid size={15} strokeWidth={1.75} />
            </Link>
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1
              return (
                <span key={crumb.to} className="flex items-center gap-1.5 min-w-0">
                  <span className="text-border">/</span>
                  {isLast ? (
                    <span className="text-sm text-text truncate">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.to} className="text-sm text-text-secondary hover:text-text transition-colors truncate">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              )
            })}
          </header>
        )}
        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
