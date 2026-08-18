import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../lib/access'
import FullScreenLoader from './FullScreenLoader'

export default function RequireAdminOrDeptAdmin({
  departmentKey,
  children,
}: {
  departmentKey: string
  children: ReactNode
}) {
  const { profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  if (!isAdminOrDeptAdmin(profile, departmentKey)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
