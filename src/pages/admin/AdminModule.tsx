import { NavLink, Routes, Route } from 'react-router-dom'
import AdminUsers from './Users'
import ManageAccess from './ManageAccess'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm rounded transition-colors ${
    isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
  }`

export default function AdminModule() {
  return (
    <div>
      <div className="flex gap-1 mb-6 border border-border rounded-md p-1 w-fit bg-surface">
        <NavLink to="/admin" end className={tabClass}>
          Users
        </NavLink>
        <NavLink to="/admin/access" className={tabClass}>
          Manage Access
        </NavLink>
      </div>

      <Routes>
        <Route index element={<AdminUsers />} />
        <Route path="access" element={<ManageAccess />} />
      </Routes>
    </div>
  )
}
