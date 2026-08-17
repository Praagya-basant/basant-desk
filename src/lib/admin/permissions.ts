import { supabase } from '../supabase'
import type { Permission } from '../../types'

export async function fetchPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase.from('permissions').select('*').order('department').order('label')
  if (error) throw error
  return data as Permission[]
}

export async function fetchUserPermissionIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('user_permissions').select('permission_id').eq('user_id', userId)
  if (error) throw error
  return new Set((data as { permission_id: string }[]).map((r) => r.permission_id))
}

export async function saveUserPermissions(userId: string, permissionIds: string[]): Promise<void> {
  const current = await fetchUserPermissionIds(userId)
  const next = new Set(permissionIds)

  const toAdd = permissionIds.filter((id) => !current.has(id))
  const toRemove = Array.from(current).filter((id) => !next.has(id))

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('user_permissions')
      .insert(toAdd.map((permission_id) => ({ user_id: userId, permission_id })))
    if (error) throw error
  }

  if (toRemove.length > 0) {
    const { error } = await supabase.from('user_permissions').delete().eq('user_id', userId).in('permission_id', toRemove)
    if (error) throw error
  }
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ is_active: isActive }).eq('id', userId)
  if (error) throw error
}
