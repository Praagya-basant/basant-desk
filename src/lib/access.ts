import type { UserProfile } from '../types'
import { DEPARTMENTS } from '../config/departments'

export function accessibleDepartments(profile: UserProfile | null) {
  if (!profile) return []
  if (profile.role === 'admin') return DEPARTMENTS
  return DEPARTMENTS.filter((d) => profile.departments?.includes(d.key))
}

export function canAccessDepartment(profile: UserProfile | null, key: string) {
  if (!profile) return false
  if (profile.role === 'admin') return true
  return profile.departments?.includes(key) ?? false
}
