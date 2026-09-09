import { useAuth } from '../contexts/AuthContext'
import { canModule, moduleLevel } from '../lib/access'
import type { AccessLevel } from '../config/modules'

/**
 * The access check to use anywhere a feature is gated. Module keys are
 * `department.slug` (e.g. `purchase.honeycomb`, `sales.mcs`) and must be
 * registered in core.modules + src/config/modules.ts. See docs/access-control.md.
 *
 *   useModuleAccess('sales.mcs')            -> 'none' | 'view' | 'edit' | 'approve' | 'admin'
 *   useCan('sales.mcs', 'edit')             -> boolean
 */
export function useModuleAccess(moduleKey: string): AccessLevel {
  const { moduleAccess } = useAuth()
  return moduleLevel(moduleAccess, moduleKey)
}

export function useCan(moduleKey: string, min: AccessLevel = 'view'): boolean {
  const { moduleAccess } = useAuth()
  return canModule(moduleAccess, moduleKey, min)
}
