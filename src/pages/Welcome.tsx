import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { accessibleDepartments } from '../lib/access'

// The actual "/" landing page — a department-card grid, per CLAUDE.md's
// navigation shell spec. Never auto-redirects into the first department:
// that's what caused every department but Purchase to "disappear" once the
// sidebar became context-aware (it used to always show the full department
// list regardless of route, which papered over the redirect; now that it
// swaps to the current department's own nav, this page is the only way back
// to a multi-department view, so it has to actually render).
export default function Welcome() {
  const { profile, moduleAccess } = useAuth()
  const departments = accessibleDepartments(profile, moduleAccess)

  return (
    <div>
      <h1 className="text-lg font-medium text-text mb-1">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        {departments.length > 0 ? 'Pick a department to get started.' : 'No departments assigned. Contact an admin to get access.'}
      </p>

      {departments.length > 0 && (
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          {departments.map((dept) => (
            <Link
              key={dept.key}
              to={dept.route}
              className="border border-border rounded-lg p-4 hover:bg-surface transition-colors"
            >
              <dept.icon size={18} strokeWidth={1.75} className="text-text-secondary mb-3" />
              <p className="text-sm font-medium text-text">{dept.label}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
