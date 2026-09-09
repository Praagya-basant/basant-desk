import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdmin } from '../../../lib/access'
import AccessUsersTab from './AccessUsersTab'
import AccessRolesTab from './AccessRolesTab'
import AccessAuditTab from './AccessAuditTab'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm rounded transition-colors ${
    isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
  }`

export default function AccessControl() {
  const { profile } = useAuth()
  const globalAdmin = isAdmin(profile)
  // Departments this person can administer — [] + globalAdmin means "all".
  const adminDepartments = profile?.department_admin_for ?? []

  return (
    <div>
      <div className="mb-1">
        <h1 className="text-lg font-medium text-text">Access Control</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {globalAdmin
            ? 'Roles and per-module access across every department.'
            : `Roles and access for ${adminDepartments.join(', ')}.`}
        </p>
      </div>

      <div className="flex gap-1 my-6 border border-border rounded-md p-1 w-fit bg-surface">
        <NavLink to="/admin/access-control" end className={tabClass}>
          Users
        </NavLink>
        <NavLink to="/admin/access-control/roles" className={tabClass}>
          Roles
        </NavLink>
        <NavLink to="/admin/access-control/audit" className={tabClass}>
          Audit Log
        </NavLink>
      </div>

      <Routes>
        <Route
          index
          element={<AccessUsersTab globalAdmin={globalAdmin} adminDepartments={adminDepartments} />}
        />
        <Route
          path="roles"
          element={<AccessRolesTab globalAdmin={globalAdmin} adminDepartments={adminDepartments} />}
        />
        <Route path="audit" element={<AccessAuditTab />} />
        <Route path="*" element={<Navigate to="/admin/access-control" replace />} />
      </Routes>
    </div>
  )
}
