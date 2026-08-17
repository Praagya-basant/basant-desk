import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { getDepartment } from '../config/departments'

export default function Layout() {
  const location = useLocation()
  const dept = getDepartment(location.pathname.replace(/^\//, '').split('/')[0])
  const title = dept?.label

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {title && (
          <header className="h-14 shrink-0 flex items-center px-8 border-b border-border">
            <span className="text-sm text-text-secondary">{title}</span>
          </header>
        )}
        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
