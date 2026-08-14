import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile } = useAuth()

  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
