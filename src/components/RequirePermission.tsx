import type { ReactNode } from 'react'
import { useHasAccess } from '../hooks/useHasAccess'

export default function RequirePermission({
  permissionKey,
  children,
}: {
  permissionKey: string
  children: ReactNode
}) {
  const allowed = useHasAccess(permissionKey)

  if (!allowed) {
    return (
      <div className="max-w-lg">
        <h1 className="text-lg font-medium text-text mb-1">Not available</h1>
        <p className="text-sm text-text-secondary">
          You don't have access to this feature. Contact an admin to get access.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
