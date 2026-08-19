import { Link, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { getDepartment } from '../config/departments'

export default function Layout() {
  const location = useLocation()
  const dept = getDepartment(location.pathname.replace(/^\//, '').split('/')[0])

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {dept && (
          <header className="h-14 shrink-0 flex items-center px-8 border-b border-border">
            <Link to={dept.route} className="text-sm text-text-secondary hover:text-text transition-colors">
              {dept.label}
            </Link>
          </header>
        )}
        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
