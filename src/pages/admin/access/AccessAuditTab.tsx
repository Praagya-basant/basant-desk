import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fetchAuditLog, type AccessChangeLogEntry } from '../../../lib/admin/accessControl'

const TYPE_LABEL: Record<string, string> = {
  role_assigned: 'Role assigned',
  role_unassigned: 'Role unassigned',
  module_override_set: 'Override set',
  module_override_cleared: 'Override cleared',
  role_created: 'Role created',
  role_updated: 'Role updated',
  role_deleted: 'Role deleted',
  role_grant_changed: 'Role grant changed',
  department_admin_granted: 'Department admin granted',
  department_admin_revoked: 'Department admin revoked',
}

function detail(e: AccessChangeLogEntry): string {
  const nv = e.new_value as Record<string, unknown> | null
  const ov = e.old_value as Record<string, unknown> | null
  if (e.change_type === 'module_override_set' && nv?.level) {
    return `${e.scope} → ${ov?.level ? `${ov.level} → ` : ''}${nv.level}`
  }
  if (e.change_type === 'module_override_cleared') return `${e.scope} (back to auto)`
  if (e.change_type === 'role_grant_changed') {
    return `${e.scope}: ${ov?.level ?? '—'} → ${nv?.level ?? '—'}`
  }
  if (e.change_type.startsWith('role_')) return String(nv?.name ?? ov?.name ?? e.scope ?? '')
  return e.scope ?? ''
}

export default function AccessAuditTab() {
  const [entries, setEntries] = useState<AccessChangeLogEntry[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    fetchAuditLog()
      .then(async (rows) => {
        setEntries(rows)
        const ids = [...new Set(rows.flatMap((r) => [r.changed_by, r.target_user]).filter(Boolean))] as string[]
        if (ids.length) {
          const { data } = await supabase.from('users').select('id, full_name, email').in('id', ids)
          setNames(new Map(((data as { id: string; full_name: string | null; email: string }[]) ?? []).map((u) => [u.id, u.full_name || u.email])))
        }
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the audit log.'))
      .finally(() => setLoading(false))
  }, [])

  const name = (id: string | null) => (id ? names.get(id) ?? 'unknown' : 'system')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (typeFilter && e.change_type !== typeFilter) return false
      if (!q) return true
      return (
        (e.scope ?? '').toLowerCase().includes(q) ||
        e.change_type.toLowerCase().includes(q) ||
        name(e.changed_by).toLowerCase().includes(q) ||
        name(e.target_user).toLowerCase().includes(q)
      )
    })
  }, [entries, search, typeFilter, names]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  return (
    <div className="max-w-3xl">
      <div className="flex gap-2 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user, role, module…"
          className="w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
        >
          <option value="">All change types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-warning mb-4">{error}</p>}

      <div className="border border-border rounded-lg divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-secondary text-center">No matching changes.</p>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text">
                  <span className="font-medium">{name(e.changed_by)}</span>
                  {e.target_user && e.target_user !== e.changed_by && (
                    <span className="text-text-secondary"> → {name(e.target_user)}</span>
                  )}
                </span>
                <span className="text-xs text-text-muted shrink-0">{new Date(e.changed_at).toLocaleString()}</span>
              </div>
              <p className="text-text-secondary text-xs mt-0.5">
                {TYPE_LABEL[e.change_type] ?? e.change_type}
                {detail(e) ? ` · ${detail(e)}` : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
