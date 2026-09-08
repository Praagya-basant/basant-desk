import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../lib/access'
import FullScreenLoader from '../../components/FullScreenLoader'

/** The validity / shift / recall review queues. Sales admins see everything;
 * a hall manager reaches them too but RLS limits the rows to their own hall. */
export default function RequireMcspReviewAccess({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  const isManager = profile?.role === 'manager' && (profile.departments?.includes('sales') ?? false)
  if (!isAdminOrDeptAdmin(profile, 'sales') && !isManager) {
    return <Navigate to="/sales/mcsp" replace />
  }

  return <>{children}</>
}
