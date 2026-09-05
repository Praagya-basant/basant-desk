import { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import { fetchBuyers, listPanelMovements, listPanels } from '../../../lib/mcsp/db'
import { getValidityStatus } from '../../../lib/mcsp/dbTypes'
import type { PanelMovementWithRelations, PanelWithRelations } from '../../../lib/mcsp/dbTypes'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <p className="text-2xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-secondary mt-1">{label}</p>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const isAdmin = isAdminOrDeptAdmin(profile, 'sales')
  const isManager = profile?.role === 'manager'

  const [panels, setPanels] = useState<PanelWithRelations[]>([])
  const [movements, setMovements] = useState<PanelMovementWithRelations[]>([])
  const [buyerCount, setBuyerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listPanels(), listPanelMovements(), fetchBuyers()])
      .then(([p, m, b]) => {
        setPanels(p)
        setMovements(m)
        setBuyerCount(b.length)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  const active = panels.filter((p) => p.status !== 'retired')
  const scoped = isManager && !isAdmin ? active.filter((p) => p.hall?.name === profile?.hall) : active
  const inHall = scoped.filter((p) => p.status === 'in_hall').length
  const issued = scoped.filter((p) => p.status === 'issued').length
  const expiringSoon = scoped.filter((p) => getValidityStatus(p.expiry_date) === 'expiring_soon').length
  const retired = panels.filter((p) => p.status === 'retired').length

  return (
    <div>
      <h1 className="text-lg font-medium text-text mb-6">Dashboard</h1>

      <div className="grid grid-cols-5 gap-3 mb-8">
        <StatCard label="Total Active Panels" value={scoped.length} />
        <StatCard label="In Hall" value={inHall} />
        <StatCard label="Issued" value={issued} />
        <StatCard label="Expiring Soon" value={expiringSoon} />
        {isAdmin ? <StatCard label="Total Buyers" value={buyerCount} /> : <StatCard label="Retired" value={retired} />}
      </div>

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
