import type { UserProfile } from '../types'
import { DEPARTMENTS } from '../config/departments'

// The one place that defines "what counts as admin" — every other check in
// this module (and every guard/hook built on it) goes through here.
export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'admin'
}

// department_admin_for grants full admin-equivalent power, but scoped to
// just that one department (e.g. a Purchase department admin can manage
// Purchase users/price grid/data without being a global admin).
export function isDepartmentAdmin(profile: UserProfile | null, departmentKey: string): boolean {
  return profile?.department_admin_for?.includes(departmentKey) ?? false
}

export function isAdminOrDeptAdmin(profile: UserProfile | null, departmentKey: string): boolean {
  return isAdmin(profile) || isDepartmentAdmin(profile, departmentKey)
}

// What to show next to a user's name — distinguishes a true global Admin
// from someone who's only admin-equivalent within specific department(s),
// so the UI never implies broader access than the account actually has.
export function roleLabel(profile: UserProfile | null): string {
  if (!profile) return ''
  if (isAdmin(profile)) return 'Admin'
  const deptAdminFor = profile.department_admin_for ?? []
  if (deptAdminFor.length > 0) {
    const labels = deptAdminFor.map((key) => DEPARTMENTS.find((d) => d.key === key)?.label ?? key)
    return `${labels.join(' / ')} Admin`
  }
  return profile.role
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
 *   admin                          -> everything
 *   manager, in dept X             -> everything in dept X, no permission lookup needed
 *   department_admin_for X         -> everything in dept X, no permission lookup needed
 *   everyone else                  -> only what's explicitly granted in user_permissions
 */
export function hasAccess(
  profile: UserProfile | null,
  permissionKeys: Set<string>,
  permissionKey: string,
): boolean {
  if (!profile) return false
  const department = departmentOf(permissionKey)
  if (isAdmin(profile) || isDepartmentAdmin(profile, department)) return true
  if (profile.role === 'manager') {
    return profile.departments?.includes(department) ?? false
  }
  return permissionKeys.has(permissionKey)
}

export function canAccessDepartment(
  profile: UserProfile | null,
  permissionKeys: Set<string>,
  departmentKey: string,
): boolean {
  if (!profile) return false
  if (isAdmin(profile) || isDepartmentAdmin(profile, departmentKey)) return true
  if (profile.role === 'manager') {
    return profile.departments?.includes(departmentKey) ?? false
  }
  return grantedDepartments(permissionKeys).has(departmentKey)
}

export function accessibleDepartments(profile: UserProfile | null, permissionKeys: Set<string>) {
  if (!profile) return []
  if (isAdmin(profile)) return DEPARTMENTS
  const granted = grantedDepartments(permissionKeys)
  return DEPARTMENTS.filter(
    (d) =>
      isDepartmentAdmin(profile, d.key) ||
      (profile.role === 'manager' && (profile.departments?.includes(d.key) ?? false)) ||
      granted.has(d.key),
  )
}
