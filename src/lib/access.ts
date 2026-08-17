import type { UserProfile } from '../types'
import { DEPARTMENTS } from '../config/departments'

// The one place that defines "what counts as admin" — every other check in
// this module (and every guard/hook built on it) goes through here.
export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'admin'
}

// permissionKeys are stored as "department.feature" (e.g. "purchase.hc_extraction").
function departmentOf(permissionKey: string): string {
  return permissionKey.split('.')[0]
}

function grantedDepartments(permissionKeys: Set<string>): Set<string> {
  return new Set(Array.from(permissionKeys, departmentOf))
}

/**
 * The single access rule for the whole app:
 *   admin              -> everything
 *   manager, in dept X -> everything in dept X, no permission lookup needed
 *   everyone else      -> only what's explicitly granted in user_permissions
 */
export function hasAccess(
  profile: UserProfile | null,
  permissionKeys: Set<string>,
  permissionKey: string,
): boolean {
  if (!profile) return false
  if (isAdmin(profile)) return true
  if (profile.role === 'manager') {
    return profile.departments?.includes(departmentOf(permissionKey)) ?? false
  }
  return permissionKeys.has(permissionKey)
}

export function canAccessDepartment(
  profile: UserProfile | null,
  permissionKeys: Set<string>,
  departmentKey: string,
): boolean {
  if (!profile) return false
  if (isAdmin(profile)) return true
  if (profile.role === 'manager') {
    return profile.departments?.includes(departmentKey) ?? false
  }
  return grantedDepartments(permissionKeys).has(departmentKey)
}

export function accessibleDepartments(profile: UserProfile | null, permissionKeys: Set<string>) {
  if (!profile) return []
  if (isAdmin(profile)) return DEPARTMENTS
  if (profile.role === 'manager') {
    return DEPARTMENTS.filter((d) => profile.departments?.includes(d.key))
  }
  const granted = grantedDepartments(permissionKeys)
  return DEPARTMENTS.filter((d) => granted.has(d.key))
}
