import { supabase } from '../supabase'
import type { AccessLevel } from '../../config/modules'

// ── Types (mirror core.* tables from migration 0018) ──

export interface Module {
  key: string
  department_key: string
  label: string
  description: string | null
  parent_module_key: string | null
  route: string | null
  sort_order: number
  member_baseline: AccessLevel
  manager_baseline: AccessLevel
  is_active: boolean
}

export interface Role {
  id: string
  name: string
  description: string | null
  department_key: string | null
  is_system_role: boolean
}

export interface RoleGrant {
  role_id: string
  module_key: string
  level: AccessLevel
}

export interface UserModuleOverride {
  user_id: string
  module_key: string
  level: AccessLevel
  note: string | null
}

export interface EffectiveAccessRow {
  module_key: string
  department_key: string
  label: string
  level: AccessLevel
  source: string
}

export interface AccessChangeLogEntry {
  id: number
  changed_by: string | null
  target_user: string | null
  change_type: string
  scope: string | null
  old_value: unknown
  new_value: unknown
  changed_at: string
}

// ── Reads ──

export async function fetchModules(): Promise<Module[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('is_active', true)
    .order('department_key')
    .order('sort_order')
  if (error) throw error
  return (data as Module[]) ?? []
}

export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('department_key', { nullsFirst: true })
    .order('name')
  if (error) throw error
  return (data as Role[]) ?? []
}

export async function fetchAllRoleGrants(): Promise<RoleGrant[]> {
  const { data, error } = await supabase.from('role_module_access').select('*')
  if (error) throw error
  return (data as RoleGrant[]) ?? []
}

export async function fetchUserRoleIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_role_assignments')
    .select('role_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set((data as { role_id: string }[]).map((r) => r.role_id))
}

export async function fetchUserOverrides(userId: string): Promise<UserModuleOverride[]> {
  const { data, error } = await supabase.from('user_module_access').select('*').eq('user_id', userId)
  if (error) throw error
  return (data as UserModuleOverride[]) ?? []
}

export async function fetchEffectiveAccess(userId: string): Promise<EffectiveAccessRow[]> {
  const { data, error } = await supabase.rpc('effective_module_access', { p_user: userId })
  if (error) throw error
  return (data as EffectiveAccessRow[]) ?? []
}

export async function fetchAuditLog(limit = 200): Promise<AccessChangeLogEntry[]> {
  const { data, error } = await supabase
    .from('access_change_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as AccessChangeLogEntry[]) ?? []
}

// ── Writes (each is immediate; the DB triggers write the audit log) ──

export async function assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
  const { error } = await supabase
    .from('user_role_assignments')
    .insert({ user_id: userId, role_id: roleId, assigned_by: assignedBy })
  if (error) throw error
}

export async function unassignRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabase
    .from('user_role_assignments')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId)
  if (error) throw error
}

export async function setUserOverride(
  userId: string,
  moduleKey: string,
  level: AccessLevel,
  grantedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_module_access')
    .upsert(
      { user_id: userId, module_key: moduleKey, level, granted_by: grantedBy },
      { onConflict: 'user_id,module_key' },
    )
  if (error) throw error
}

export async function clearUserOverride(userId: string, moduleKey: string): Promise<void> {
  const { error } = await supabase
    .from('user_module_access')
    .delete()
    .eq('user_id', userId)
    .eq('module_key', moduleKey)
  if (error) throw error
}

export async function createRole(params: {
  name: string
  description: string | null
  departmentKey: string | null
  createdBy: string
}): Promise<Role> {
  const { data, error } = await supabase
    .from('roles')
    .insert({
      name: params.name,
      description: params.description,
      department_key: params.departmentKey,
      is_system_role: false,
      created_by: params.createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Role
}

export async function updateRole(
  id: string,
  params: { name: string; description: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('roles')
    .update({ name: params.name, description: params.description })
    .eq('id', id)
  if (error) throw error
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', id)
  if (error) throw error
}

export async function setRoleGrant(
  roleId: string,
  moduleKey: string,
  level: AccessLevel,
): Promise<void> {
  if (level === 'none') {
    const { error } = await supabase
      .from('role_module_access')
      .delete()
      .eq('role_id', roleId)
      .eq('module_key', moduleKey)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('role_module_access')
    .upsert({ role_id: roleId, module_key: moduleKey, level }, { onConflict: 'role_id,module_key' })
  if (error) throw error
}
