import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../lib/access'
import AdminUsers from './Users'
import AccessControl from './access/AccessControl'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm rounded transition-colors ${
    isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
  }`

export default function AdminModule() {
  const { profile } = useAuth()
  const globalAdmin = isAdmin(profile)

  return (
    <div>
      {globalAdmin && (
        <div className="flex gap-1 mb-6 border border-border rounded-md p-1 w-fit bg-surface">
          <NavLink to="/admin" end className={tabClass}>
            Users
          </NavLink>
          <NavLink to="/admin/access-control" className={tabClass}>
            Access Control
          </NavLink>
        </div>
      )}

      <Routes>
        <Route
          index
          element={globalAdmin ? <AdminUsers /> : <Navigate to="/admin/access-control" replace />}
        />
        {/* old bookmark */}
        <Route path="access" element={<Navigate to="/admin/access-control" replace />} />
        <Route path="access-control/*" element={<AccessControl />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  )
}
