import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/access'
import FullScreenLoader from './FullScreenLoader'

/**
 * The /admin area. Global admins get everything; a department admin gets in too
 * (AdminModule shows them only Access Control, scoped to their department).
 */
export default function RequireAdminArea({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  const canEnter = isAdmin(profile) || (profile?.department_admin_for?.length ?? 0) > 0
  if (!canEnter) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
