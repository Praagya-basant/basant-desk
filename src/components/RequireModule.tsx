import type { ReactNode } from 'react'
import { useCan } from '../hooks/useModuleAccess'
import type { AccessLevel } from '../config/modules'

/**
 * Route guard for a feature. `moduleKey` must be registered in core.modules +
 * src/config/modules.ts. `min` is the minimum level required (default 'view').
 *
 *   <RequireModule moduleKey="purchase.honeycomb" min="edit"><HCExtraction /></RequireModule>
 */
export default function RequireModule({
  moduleKey,
  min = 'view',
  children,
}: {
  moduleKey: string
  min?: AccessLevel
  children: ReactNode
}) {
  const allowed = useCan(moduleKey, min)

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
