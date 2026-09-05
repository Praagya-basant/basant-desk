import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import FullScreenLoader from './FullScreenLoader'

/** Any authenticated, active user can see their own tasks — RequireAuth
 * already covers the auth check app-wide; this just confirms a profile
 * loaded, and exists as the single named place to extend later if this
 * surface's access rule ever needs to change. */
export default function RequireStaffTaskAccess({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
