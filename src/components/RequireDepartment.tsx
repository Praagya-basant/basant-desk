import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { canAccessDepartment } from '../lib/access'
import FullScreenLoader from './FullScreenLoader'

export default function RequireDepartment({
  deptKey,
  children,
}: {
  deptKey: string
  children: ReactNode
}) {
  const { profile, permissionKeys, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  if (!canAccessDepartment(profile, permissionKeys, deptKey)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
