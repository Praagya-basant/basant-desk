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
  created_at: string
}

export interface Permission {
  id: string
  key: string
  label: string
  department: string
}
