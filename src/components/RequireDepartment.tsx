import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { canAccessDepartment } from '../lib/access'

export default function RequireDepartment({
  deptKey,
  children,
}: {
  deptKey: string
  children: ReactNode
}) {
  const { profile } = useAuth()

  if (!canAccessDepartment(profile, deptKey)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
