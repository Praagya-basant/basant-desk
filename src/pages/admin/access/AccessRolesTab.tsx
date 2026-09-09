import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getDepartment } from '../../../config/departments'
import { type AccessLevel } from '../../../config/modules'
import {
  createRole,
  deleteRole,
  fetchAllRoleGrants,
  fetchModules,
  fetchRoles,
  setRoleGrant,
  updateRole,
  type Module,
  type Role,
  type RoleGrant,
} from '../../../lib/admin/accessControl'
import LevelSelect from './LevelSelect'

export default function AccessRolesTab({
  globalAdmin,
  adminDepartments,
}: {
  globalAdmin: boolean
  adminDepartments: string[]
}) {
  const { profile } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [grants, setGrants] = useState<RoleGrant[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDept, setNewDept] = useState<string>(globalAdmin ? '' : (adminDepartments[0] ?? ''))
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [rls, mods, grs] = await Promise.all([fetchRoles(), fetchModules(), fetchAllRoleGrants()])
      setRoles(rls)
      setModules(mods)
      setGrants(grs)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load roles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const selected = roles.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (selected) {
      setEditName(selected.name)
      setEditDesc(selected.description ?? '')
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const canEditRole = (r: Role) =>
    globalAdmin || (!r.is_system_role && r.department_key != null && adminDepartments.includes(r.department_key))

  // Modules shown in a role's grant grid: the role's own department, or every
  // department the actor administers for a global role.
  const gridModules = useMemo(() => {
    if (!selected) return []
    if (selected.department_key) return modules.filter((m) => m.department_key === selected.department_key)
    return globalAdmin ? modules : modules.filter((m) => adminDepartments.includes(m.department_key))
  }, [selected, modules, globalAdmin, adminDepartments])

  const grantFor = (moduleKey: string): AccessLevel =>
    grants.find((g) => g.role_id === selectedId && g.module_key === moduleKey)?.level ?? 'none'

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !profile) return
    setBusy(true)
    setError(null)
    try {
      const role = await createRole({
        name: newName.trim(),
        description: newDesc.trim() || null,
        departmentKey: newDept || null,
        createdBy: profile.id,
      })
      setNewName('')
      setNewDesc('')
      setCreating(false)
      await load()
      setSelectedId(role.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create role.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRename() {
    if (!selected || !editName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await updateRole(selected.id, { name: editName.trim(), description: editDesc.trim() || null })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update role.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (!window.confirm(`Delete role “${selected.name}”? Users assigned to it lose its grants.`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteRole(selected.id)
      setSelectedId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete role.')
    } finally {
      setBusy(false)
    }
  }

  async function changeGrant(moduleKey: string, level: AccessLevel) {
    if (!selectedId) return
    setBusy(true)
    setError(null)
    try {
      await setRoleGrant(selectedId, moduleKey, level)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update grant.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  const assignableDeptOptions = globalAdmin
    ? [{ key: '', label: 'Global (all departments)' }, ...['purchase', 'production', 'sales', 'hr', 'yaamya'].map((k) => ({ key: k, label: getDepartment(k)?.label ?? k }))]
    : adminDepartments.map((k) => ({ key: k, label: getDepartment(k)?.label ?? k }))

  return (
    <div className="flex gap-8 max-w-4xl">
      {/* list */}
      <div className="w-64 shrink-0">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 mb-3 hover:bg-accent-hover transition-colors"
        >
          <Plus size={14} strokeWidth={2} />
          New role
        </button>
        <div className="border border-border rounded-lg divide-y divide-border">
          {roles.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-secondary">No roles.</p>
          ) : (
            roles.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedId(r.id); setCreating(false) }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  selectedId === r.id ? 'bg-surface-2 text-text' : 'text-text-secondary hover:text-text'
                }`}
              >
                {r.name}
                <span className="block text-xs text-text-muted">
                  {r.department_key ? getDepartment(r.department_key)?.label ?? r.department_key : 'Global'}
                  {r.is_system_role ? ' · system' : ''} · {grants.filter((g) => g.role_id === r.id).length} modules
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* detail */}
      <div className="flex-1 min-w-0">
        {error && <p className="text-sm text-warning mb-4">{error}</p>}

        {creating ? (
          <form onSubmit={handleCreate} className="space-y-3 max-w-md">
            <h2 className="text-sm font-medium text-text">New role</h2>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Description</label>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Scope</label>
              <select value={newDept} onChange={(e) => setNewDept(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent">
                {assignableDeptOptions.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy || !newName.trim()} className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:bg-accent-hover transition-colors disabled:opacity-50">
                Create
              </button>
              <button type="button" onClick={() => setCreating(false)} className="rounded-md border border-border text-text text-sm px-4 py-2 hover:bg-surface transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : selected ? (
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <input
                  value={editName}
                  disabled={!canEditRole(selected) || busy}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleRename}
                  className="text-base font-medium text-text bg-transparent border-b border-transparent focus:border-border outline-none w-full disabled:opacity-100"
                />
                <input
                  value={editDesc}
                  disabled={!canEditRole(selected) || busy}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onBlur={handleRename}
                  placeholder="No description"
                  className="text-sm text-text-secondary bg-transparent border-b border-transparent focus:border-border outline-none w-full mt-1"
                />
                <p className="text-xs text-text-muted mt-1">
                  {selected.department_key ? getDepartment(selected.department_key)?.label ?? selected.department_key : 'Global'}
                  {selected.is_system_role ? ' · system role' : ''}
                </p>
              </div>
              {canEditRole(selected) && !selected.is_system_role && (
                <button onClick={handleDelete} disabled={busy} className="rounded-md border border-red-300 text-red-600 text-xs px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50">
                  Delete
                </button>
              )}
            </div>

            {!canEditRole(selected) && (
              <p className="text-xs text-text-secondary mb-3">Read-only — you can't edit this role.</p>
            )}

            <div className="border border-border rounded-lg divide-y divide-border">
              {gridModules.map((m) => (
                <div key={m.key} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <span className="text-sm text-text">
                    {m.label}
                    {!selected.department_key && (
                      <span className="text-text-muted"> · {getDepartment(m.department_key)?.label ?? m.department_key}</span>
                    )}
                  </span>
                  <LevelSelect
                    value={grantFor(m.key)}
                    disabled={!canEditRole(selected) || busy}
                    onChange={(lvl) => changeGrant(m.key, lvl)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Select a role, or create one.</p>
        )}
      </div>
    </div>
  )
}
