import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { accessibleDepartments } from '../../lib/access'
import { navLinkClass } from './navLinkClass'

/** Top-level nav — the department switcher. Shown on the main dashboard, and
 * as the fallback for any department that doesn't have its own contextual nav
 * yet (Production, HR — not started). */
export default function DepartmentNav() {
  const { profile, moduleAccess } = useAuth()
  const departments = accessibleDepartments(profile, moduleAccess)

  return (
    <div className="space-y-0.5">
      {departments.map((dept) => (
        <NavLink key={dept.key} to={dept.route} className={navLinkClass}>
          <dept.icon size={16} strokeWidth={1.75} />
          {dept.label}
        </NavLink>
      ))}
    </div>
  )
}
