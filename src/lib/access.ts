import type { UserProfile } from '../types'
import { DEPARTMENTS } from '../config/departments'
import { ACCESS_LEVELS, MODULES, type AccessLevel } from '../config/modules'

export type { AccessLevel }

// ── Role predicates — unchanged, still the authority on "what counts as admin" ──

export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'admin'
}

// department_admin_for grants full admin-equivalent power, scoped to one
// department (resolution layer 2 — see docs/access-control.md).
export function isDepartmentAdmin(profile: UserProfile | null, departmentKey: string): boolean {
  return profile?.department_admin_for?.includes(departmentKey) ?? false
}

export function isAdminOrDeptAdmin(profile: UserProfile | null, departmentKey: string): boolean {
  return isAdmin(profile) || isDepartmentAdmin(profile, departmentKey)
}

// What to show next to a user's name.
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

// ── Module access ──
//
// `moduleAccess` is the map returned by core.my_module_access() (loaded once in
// AuthContext). The server-side resolver already accounts for global admin,
// department admin, roles, per-user overrides and department baselines — so on
// the client we only ever read this map. Missing key ⇒ 'none'.

export function meetsLevel(actual: AccessLevel, min: AccessLevel): boolean {
  return ACCESS_LEVELS.indexOf(actual) >= ACCESS_LEVELS.indexOf(min)
}

export function moduleLevel(moduleAccess: Map<string, AccessLevel>, moduleKey: string): AccessLevel {
  return moduleAccess.get(moduleKey) ?? 'none'
}

export function canModule(
  moduleAccess: Map<string, AccessLevel>,
  moduleKey: string,
  min: AccessLevel = 'view',
): boolean {
  return meetsLevel(moduleLevel(moduleAccess, moduleKey), min)
}

// ── Department-level access (for the nav + RequireDepartment) ──

export function canAccessDepartment(
  profile: UserProfile | null,
  moduleAccess: Map<string, AccessLevel>,
  departmentKey: string,
): boolean {
  if (!profile) return false
  if (isAdmin(profile) || isDepartmentAdmin(profile, departmentKey)) return true
  // Any module in the department the user can at least view.
  return MODULES.some(
    (m) => m.department === departmentKey && moduleLevel(moduleAccess, m.key) !== 'none',
  )
}

export function accessibleDepartments(
  profile: UserProfile | null,
  moduleAccess: Map<string, AccessLevel>,
) {
  if (!profile) return []
  if (isAdmin(profile)) return DEPARTMENTS
  return DEPARTMENTS.filter(
    (d) => d.key !== 'admin' && canAccessDepartment(profile, moduleAccess, d.key),
  )
}
