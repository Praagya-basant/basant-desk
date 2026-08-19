import { Link, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { getDepartment } from '../config/departments'
import { getSubModule } from '../config/subModules'

export default function Layout() {
  const location = useLocation()
  const dept = getDepartment(location.pathname.replace(/^\//, '').split('/')[0])
  const subModule = getSubModule(location.pathname)

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {dept && (
          <header className="h-14 shrink-0 flex items-center px-8 border-b border-border">
            <Link to={dept.route} className="text-sm text-text-secondary hover:text-text transition-colors">
              {dept.label}
            </Link>
            {subModule && (
              <>
                <span className="mx-1.5 text-border">/</span>
                <Link
                  to={subModule.route}
                  className="text-sm text-text-secondary hover:text-text transition-colors"
                >
                  {subModule.label}
                </Link>
              </>
            )}
          </header>
        )}
        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
