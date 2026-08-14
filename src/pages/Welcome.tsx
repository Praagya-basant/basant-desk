import { useAuth } from '../contexts/AuthContext'
import { accessibleDepartments } from '../lib/access'
import { Navigate } from 'react-router-dom'

export default function Welcome() {
  const { profile } = useAuth()
  const departments = accessibleDepartments(profile)

  if (departments.length > 0) {
    return <Navigate to={departments[0].route} replace />
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-medium text-text mb-1">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
      <p className="text-sm text-text-secondary">
        No departments assigned. Contact an admin to get access.
      </p>
    </div>
  )
}
