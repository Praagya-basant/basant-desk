export type Role = 'admin' | 'manager' | 'merchant' | 'custom'

export interface UserProfile {
  id: string
  full_name: string | null
  email: string
  role: Role
  departments: string[]
  hall: string | null
  buyers: string[] | null
  is_active: boolean
  /** departments where this user has full admin-equivalent power, scoped to that department only */
  department_admin_for: string[]
  created_at: string
}

export interface Permission {
  id: string
  key: string
  label: string
  department: string
}
