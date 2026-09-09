import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { getDepartment } from '../../../config/departments'
import type { AccessLevel } from '../../../config/modules'
import {
  assignRole,
  clearUserOverride,
  fetchAllRoleGrants,
  fetchEffectiveAccess,
  fetchModules,
  fetchRoles,
  fetchUserOverrides,
  fetchUserRoleIds,
  setUserOverride,
  unassignRole,
  type EffectiveAccessRow,
  type Module,
  type Role,
  type RoleGrant,
} from '../../../lib/admin/accessControl'

interface ManagedUser {
  id: string
  full_name: string | null
  email: string
  role: string
  departments: string[] | null
  department_admin_for: string[] | null
}

const LEVEL_LABEL: Record<AccessLevel, string> = {
  none: 'None', view: 'View', edit: 'Edit', approve: 'Approve', admin: 'Admin',
}
const SOURCE_LABEL: Record<string, string> = {
  global_admin: 'global admin',
  department_admin: 'department admin',
  override: 'per-user override',
  manager_baseline: 'manager (department member)',
  member_baseline: 'department member',
  none: '—',
}
function sourceText(s: string) {
  return s.startsWith('role:') ? `role “${s.slice(5)}”` : SOURCE_LABEL[s] ?? s
}

const OVERRIDE_OPTIONS: (AccessLevel | 'auto')[] = ['auto', 'none', 'view', 'edit', 'approve', 'admin']

export default function AccessUsersTab({
  globalAdmin,
  adminDepartments,
}: {
  globalAdmin: boolean
  adminDepartments: string[]
}) {
  const { profile } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [roleGrants, setRoleGrants] = useState<RoleGrant[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')

  const [effective, setEffective] = useState<EffectiveAccessRow[]>([])
  const [userRoleIds, setUserRoleIds] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Map<string, AccessLevel>>(new Map())
  const [showAll, setShowAll] = useState(false)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id, full_name, email, role, departments, department_admin_for').order('full_name'),
      fetchModules(),
      fetchRoles(),
      fetchAllRoleGrants(),
    ])
      .then(([usersRes, mods, rls, grants]) => {
        if (usersRes.error) throw usersRes.error
        setUsers((usersRes.data as ManagedUser[]) ?? [])
        setModules(mods)
        setRoles(rls)
        setRoleGrants(grants)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load access data.'))
      .finally(() => setLoading(false))
  }, [])

  async function loadUserAccess(userId: string) {
    setError(null)
    try {
      const [eff, roleIds, ovr] = await Promise.all([
        fetchEffectiveAccess(userId),
        fetchUserRoleIds(userId),
        fetchUserOverrides(userId),
      ])
      setEffective(eff)
      setUserRoleIds(roleIds)
      setOverrides(new Map(ovr.map((o) => [o.module_key, o.level])))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this user's access.")
    }
  }

  // A department admin can only inspect / manage users in one of their
  // departments who aren't global admins (effective_module_access enforces the
  // same server-side). Done at render so it tracks the props once profile loads.
  const scopedUsers = useMemo(
    () =>
      globalAdmin
        ? users
        : users.filter(
            (u) =>
              u.role !== 'admin' &&
              [...(u.departments ?? []), ...(u.department_admin_for ?? [])].some((d) =>
                adminDepartments.includes(d),
              ),
          ),
    [users, globalAdmin, adminDepartments],
  )

  useEffect(() => {
    if (!selectedId && scopedUsers.length) setSelectedId(scopedUsers[0].id)
  }, [scopedUsers, selectedId])

  useEffect(() => {
    if (selectedId) loadUserAccess(selectedId)
  }, [selectedId])

  const selectedUser = scopedUsers.find((u) => u.id === selectedId)

  const manageableModules = useMemo(
    () => modules.filter((m) => globalAdmin || adminDepartments.includes(m.department_key)),
    [modules, globalAdmin, adminDepartments],
  )
  const assignableRoles = useMemo(
    () =>
      roles.filter((r) =>
        globalAdmin ? true : r.department_key != null && adminDepartments.includes(r.department_key),
      ),
    [roles, globalAdmin, adminDepartments],
  )

  const filteredUsers = scopedUsers.filter((u) => {
    const q = search.trim().toLowerCase()
    return !q || (u.full_name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const effByDept = useMemo(() => {
    const map = new Map<string, EffectiveAccessRow[]>()
    for (const r of effective) {
      if (!showAll && r.level === 'none') continue
      map.set(r.department_key, [...(map.get(r.department_key) ?? []), r])
    }
    return map
  }, [effective, showAll])

  async function toggleRole(roleId: string, has: boolean) {
    if (!selectedId || !profile) return
    setBusy(true)
    setError(null)
    try {
      if (has) await unassignRole(selectedId, roleId)
      else await assignRole(selectedId, roleId, profile.id)
      await loadUserAccess(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update role assignment.')
    } finally {
      setBusy(false)
    }
  }

  async function changeOverride(moduleKey: string, choice: AccessLevel | 'auto') {
    if (!selectedId || !profile) return
    setBusy(true)
    setError(null)
    try {
      if (choice === 'auto') await clearUserOverride(selectedId, moduleKey)
      else await setUserOverride(selectedId, moduleKey, choice, profile.id)
      await loadUserAccess(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update override.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  return (
    <div className="max-w-3xl">
      <div className="flex gap-2 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="w-56 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
        />
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
        >
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {(u.full_name || u.email)} · {u.role}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-warning mb-4">{error}</p>}

      {selectedUser && (
        <>
          {selectedUser.role === 'admin' ? (
            <p className="text-sm text-text-secondary border border-border rounded-lg p-4">
              This is a global admin — full access to every module, everywhere. Roles and overrides don't apply.
            </p>
          ) : (
            <>
              {/* Effective access */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-medium text-text">Effective access</h2>
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="rounded border-border" />
                    show modules with no access
                  </label>
                </div>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {effByDept.size === 0 ? (
                    <p className="px-4 py-3 text-sm text-text-secondary">No access to any module.</p>
                  ) : (
                    [...effByDept.entries()].map(([dept, rows]) => (
                      <div key={dept} className="px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
                          {getDepartment(dept)?.label ?? dept}
                        </p>
                        <div className="space-y-1">
                          {rows.map((r) => (
                            <div key={r.module_key} className="flex items-center justify-between text-sm">
                              <span className={r.level === 'none' ? 'text-text-muted' : 'text-text'}>{r.label}</span>
                              <span className="text-text-secondary">
                                <span className={r.level === 'none' ? 'text-text-muted' : 'text-text'}>{LEVEL_LABEL[r.level]}</span>
                                {r.level !== 'none' && <span className="text-text-muted"> · {sourceText(r.source)}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Roles */}
              <section className="mb-8">
                <h2 className="text-sm font-medium text-text mb-2">Roles</h2>
                {assignableRoles.length === 0 ? (
                  <p className="text-sm text-text-secondary">No roles you can assign.</p>
                ) : (
                  <div className="space-y-1.5">
                    {assignableRoles.map((r) => {
                      const has = userRoleIds.has(r.id)
                      const grantCount = roleGrants.filter((g) => g.role_id === r.id).length
                      return (
                        <label key={r.id} className="flex items-start gap-2 text-sm text-text">
                          <input
                            type="checkbox"
                            checked={has}
                            disabled={busy}
                            onChange={() => toggleRole(r.id, has)}
                            className="rounded border-border mt-0.5"
                          />
                          <span>
                            {r.name}
                            <span className="text-text-muted">
                              {' '}· {r.department_key ? getDepartment(r.department_key)?.label ?? r.department_key : 'Global'}
                              {r.is_system_role ? ' · system' : ''} · {grantCount} module{grantCount === 1 ? '' : 's'}
                            </span>
                            {r.description && <span className="block text-xs text-text-secondary">{r.description}</span>}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Per-module overrides */}
              <section>
                <h2 className="text-sm font-medium text-text mb-1">Per-module overrides</h2>
                <p className="text-xs text-text-secondary mb-3">
                  “Auto” follows roles + department membership. Any other value is a hard per-user setting — “None” denies even if a role grants it.
                </p>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {manageableModules.map((m) => {
                    const current: AccessLevel | 'auto' = overrides.has(m.key) ? overrides.get(m.key)! : 'auto'
                    return (
                      <div key={m.key} className="flex items-center justify-between px-4 py-2.5 gap-3">
                        <span className="text-sm text-text">
                          {m.label}
                          <span className="text-text-muted"> · {getDepartment(m.department_key)?.label ?? m.department_key}</span>
                        </span>
                        <div className="inline-flex rounded-md border border-border overflow-hidden bg-bg shrink-0">
                          {OVERRIDE_OPTIONS.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={busy}
                              onClick={() => changeOverride(m.key, opt)}
                              className={`px-2.5 py-1 text-xs border-r border-border last:border-r-0 transition-colors ${
                                current === opt
                                  ? 'bg-accent text-white font-medium'
                                  : 'text-text-secondary hover:text-text hover:bg-surface-2'
                              } ${busy ? 'opacity-50' : ''}`}
                            >
                              {opt === 'auto' ? 'Auto' : LEVEL_LABEL[opt]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}

      <p className="text-xs text-text-muted mt-6">Changes save immediately. History is on the Audit Log tab.</p>
    </div>
  )
}
