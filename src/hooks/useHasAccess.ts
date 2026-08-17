import { useAuth } from '../contexts/AuthContext'
import { hasAccess } from '../lib/access'

/**
 * The one access check to use anywhere in the app that gates a feature:
 *   admin              -> true
 *   manager, in dept X -> true for any "X.*" permission key
 *   everyone else      -> true only if explicitly granted in user_permissions
 *
 * permissionKey follows "department.feature", e.g. "purchase.hc_extraction".
 */
export function useHasAccess(permissionKey: string): boolean {
  const { profile, permissionKeys } = useAuth()
  return hasAccess(profile, permissionKeys, permissionKey)
}
