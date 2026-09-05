import { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import { fetchBuyers, listMovements, listPanels, listSamples } from '../../../lib/mcsp/db'
import { getValidityStatus } from '../../../lib/mcsp/dbTypes'
import type { MovementWithRelations, SampleWithRelations } from '../../../lib/mcsp/dbTypes'

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
  const isMerchant = profile?.role === 'merchant'

  const [samples, setSamples] = useState<SampleWithRelations[]>([])
  const [movements, setMovements] = useState<MovementWithRelations[]>([])
  const [panelCount, setPanelCount] = useState(0)
  const [buyerCount, setBuyerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listSamples(), listMovements(), listPanels(), fetchBuyers()])
      .then(([s, m, p, b]) => {
        setSamples(s)
        setMovements(m)
        setPanelCount(p.length)
        setBuyerCount(b.length)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-text-secondary">Loading…</p>

  const inHall = samples.filter((s) => s.status === 'in_hall').length
  const issued = samples.filter((s) => s.status === 'checked_out').length
  const expiringSoon = samples.filter((s) => getValidityStatus(s.expiry_date) === 'expiring_soon').length
  const recentMovements = movements.slice(0, 8)

  const mySamples = isManager ? samples.filter((s) => s.hall?.name === profile?.hall) : samples
  const myIssued = mySamples.filter((s) => s.status === 'checked_out')

  const byHall = new Map<string, SampleWithRelations[]>()
  for (const s of samples) {
    const key = s.hall?.name ?? 'Unknown'
    byHall.set(key, [...(byHall.get(key) ?? []), s])
  }

  const byBuyer = new Map<string, SampleWithRelations[]>()
  for (const s of samples) {
    const key = s.buyer?.name ?? 'Unknown'
    byBuyer.set(key, [...(byBuyer.get(key) ?? []), s])
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-text mb-6">Dashboard</h1>

      {isAdmin && (
        <>
          <div className="grid grid-cols-5 gap-3 mb-8">
            <StatCard label="Total Samples" value={samples.length} />
            <StatCard label="Total Panels" value={panelCount} />
            <StatCard label="Total Buyers" value={buyerCount} />
            <StatCard label="Currently Issued" value={issued} />
            <StatCard label="Expiring Soon" value={expiringSoon} />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-medium text-text mb-3">Buyer-wise breakdown</h2>
              <div className="border border-border rounded-lg divide-y divide-border">
                {[...byBuyer.entries()].map(([name, rows]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-text">{name}</span>
                    <span className="text-text-secondary">{rows.length}</span>
                  </div>
                ))}
              </div>
            </div>
            <RecentMovements movements={recentMovements} />
          </div>
        </>
      )}

      {isManager && !isAdmin && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-8">
            <StatCard label="Total In Hall" value={mySamples.filter((s) => s.status === 'in_hall').length} />
            <StatCard label="Currently Issued" value={myIssued.length} />
            <StatCard label="Incoming (shift requests)" value={0} />
            <StatCard label="Expiring Soon" value={mySamples.filter((s) => getValidityStatus(s.expiry_date) === 'expiring_soon').length} />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-medium text-text mb-3">Currently Issued</h2>
              <div className="border border-border rounded-lg divide-y divide-border">
                {myIssued.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-text-secondary">Nothing currently issued.</p>
                ) : (
                  myIssued.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-text font-mono">{s.bt_code}</span>
                      <span className="text-text-secondary">{s.product_name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <RecentMovements movements={recentMovements} />
          </div>
        </>
      )}

      {isMerchant && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-8">
            <StatCard label="Total Samples" value={samples.length} />
            <StatCard label="In Hall" value={inHall} />
            <StatCard label="Issued" value={issued} />
            <StatCard label="Expiring Soon" value={expiringSoon} />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-medium text-text mb-3">By Hall</h2>
              <div className="border border-border rounded-lg divide-y divide-border">
                {[...byHall.entries()].map(([name, rows]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-text">{name}</span>
                    <span className="text-text-secondary">{rows.length}</span>
                  </div>
                ))}
              </div>
            </div>
            <RecentMovements movements={recentMovements} />
          </div>
        </>
      )}
    </div>
  )
}

function RecentMovements({ movements }: { movements: MovementWithRelations[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-text mb-3">Recent Movements</h2>
      <div className="border border-border rounded-lg divide-y divide-border">
        {movements.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-secondary">No movements yet.</p>
        ) : (
          movements.map((m) => (
            <div key={m.id} className="px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text font-mono">{m.sample?.bt_code ?? '—'}</span>
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
