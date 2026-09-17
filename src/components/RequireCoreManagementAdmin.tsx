import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoreManagementAdmin } from '../hooks/useCoreManagementAdmin'
import FullScreenLoader from './FullScreenLoader'

/** Frontend half of the "exactly Praagya + Amit" restriction — belt and
 * suspenders alongside RLS, which enforces the same core.core_management_admins
 * allowlist on every core_management.* table regardless of this guard. */
export default function RequireCoreManagementAdmin({ children }: { children: ReactNode }) {
  const { loading: authLoading } = useAuth()
  const { allowed, loading: checkLoading } = useCoreManagementAdmin()

  if (authLoading || checkLoading) return <FullScreenLoader />

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
