import { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import { fetchBuyers, listPanelMovements, listPanels, listShiftRequests } from '../../../lib/mcsp/db'
import { getValidityStatus } from '../../../lib/mcsp/dbTypes'
import type { PanelMovementWithRelations, PanelWithRelations, ShiftRequestWithRelations } from '../../../lib/mcsp/dbTypes'

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <p className="text-2xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-secondary mt-1">{label}</p>
    </div>
  )
}

function RecentMovements({ movements }: { movements: PanelMovementWithRelations[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-text mb-3">Recent Movements</h2>
      <div className="border border-border rounded-lg divide-y divide-border">
        {movements.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-secondary">No movements yet.</p>
        ) : (
          movements.slice(0, 8).map((m) => (
            <div key={m.id} className="px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text font-mono">{m.panel?.panel_code ?? '—'}</span>
                <span className="text-text-muted text-xs">{new Date(m.picked_at).toLocaleDateString()}</span>
              </div>
              <p className="text-text-secondary text-xs mt-0.5">
                {m.status === 'out' ? 'Issued' : 'Returned'} · {m.destination}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Breakdown({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-text mb-3">{title}</h2>
      <div className="border border-border rounded-lg divide-y divide-border">
        {entries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-secondary">Nothing yet.</p>
        ) : (
          entries.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-text">{name}</span>
              <span className="text-text-secondary">{count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const isAdmin = isAdminOrDeptAdmin(profile, 'sales')
  const isManager = profile?.role === 'manager' && !isAdmin
  const isMerchant = profile?.role === 'merchant'

  const [panels, setPanels] = useState<PanelWithRelations[]>([])
  const [movements, setMovements] = useState<PanelMovementWithRelations[]>([])
  const [shiftRequests, setShiftRequests] = useState<ShiftRequestWithRelations[]>([])
  const [buyerCount, setBuyerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [p, m, b, sr] = await Promise.all([
        listPanels(),
        listPanelMovements(),
        fetchBuyers(),
        listShiftRequests().catch(() => [] as ShiftRequestWithRelations[]),
      ])
      setPanels(p)
      setMovements(m)
      setBuyerCount(b.length)
      setShiftRequests(sr)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>
  if (error) {
    return (
      <div className="border border-border rounded-lg p-6 text-sm">
        <p className="text-warning font-medium">Failed to load dashboard data.</p>
        <p className="text-text-secondary mt-1">{error}</p>
        <button onClick={load} className="mt-3 rounded-md border border-border px-3 py-1.5 text-text hover:bg-surface transition-colors">
          Retry
        </button>
      </div>
    )
  }

  const active = panels.filter((p) => p.status !== 'retired')
  const scoped = isManager ? active.filter((p) => norm(p.hall?.name) === norm(profile?.hall)) : active
  const inHall = scoped.filter((p) => p.status === 'in_hall').length
  const issued = scoped.filter((p) => p.status === 'issued').length
  const expiringSoon = scoped.filter((p) => getValidityStatus(p.expiry_date) === 'expiring_soon').length
  const retired = panels.filter((p) => p.status === 'retired').length
  const incoming = shiftRequests.filter(
    (r) => r.status === 'pending' && norm(r.to_hall?.name) === norm(profile?.hall),
  ).length

  const groupCounts = (keyOf: (p: PanelWithRelations) => string): [string, number][] => {
    const map = new Map<string, number>()
    for (const p of scoped) map.set(keyOf(p), (map.get(keyOf(p)) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-text mb-6">Dashboard</h1>

      {(isAdmin || (!isManager && !isMerchant)) && (
        <>
          <div className="grid grid-cols-5 gap-3 mb-8">
            <StatCard label="Total Active Panels" value={active.length} />
            <StatCard label="In Hall" value={inHall} />
            <StatCard label="Issued" value={issued} />
            <StatCard label="Expiring Soon" value={expiringSoon} />
            <StatCard label="Total Buyers" value={buyerCount} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Breakdown title="Buyer-wise breakdown" entries={groupCounts((p) => p.buyer?.name ?? 'Unknown')} />
            <RecentMovements movements={movements} />
          </div>
        </>
      )}

      {isManager && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-8">
            <StatCard label="In Hall" value={inHall} />
            <StatCard label="Issued" value={issued} />
            <StatCard label="Incoming (shift requests)" value={incoming} />
            <StatCard label="Expiring Soon" value={expiringSoon} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-medium text-text mb-3">Currently Issued</h2>
              <div className="border border-border rounded-lg divide-y divide-border">
                {scoped.filter((p) => p.status === 'issued').length === 0 ? (
                  <p className="px-4 py-3 text-sm text-text-secondary">Nothing currently issued.</p>
                ) : (
                  scoped
                    .filter((p) => p.status === 'issued')
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-text font-mono">{p.panel_code ?? '—'}</span>
                        <span className="text-text-secondary">{p.panel_name}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
            <RecentMovements movements={movements} />
          </div>
        </>
      )}

      {isMerchant && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-8">
            <StatCard label="Total Panels" value={scoped.length} />
            <StatCard label="In Hall" value={inHall} />
            <StatCard label="Issued" value={issued} />
            <StatCard label="Expiring Soon" value={expiringSoon} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Breakdown title="By Hall" entries={groupCounts((p) => p.hall?.name ?? 'Unknown')} />
            <RecentMovements movements={movements} />
          </div>
        </>
      )}

      {isAdmin && retired > 0 && (
        <p className="text-xs text-text-muted mt-6">{retired} retired {retired === 1 ? 'panel' : 'panels'} not shown.</p>
      )}
    </div>
  )
}
