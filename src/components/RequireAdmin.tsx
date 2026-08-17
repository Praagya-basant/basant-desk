import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/access'
import FullScreenLoader from './FullScreenLoader'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  if (!isAdmin(profile)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
