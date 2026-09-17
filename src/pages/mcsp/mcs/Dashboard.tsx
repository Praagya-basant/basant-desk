import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import { fetchBuyers, listMovements, listPanels, listSamples, listShiftRequests } from '../../../lib/mcsp/db'
import { getValidityStatus } from '../../../lib/mcsp/dbTypes'
import type { MovementWithRelations, SampleWithRelations, ShiftRequestWithRelations } from '../../../lib/mcsp/dbTypes'

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

// `to` makes the card a link — used to jump straight to the filtered list a
// stat is counting (e.g. "Currently Issued" -> Samples with that status
// pre-applied). Cards without a sensible destination stay plain.
function StatCard({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <>
      <p className="text-2xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-secondary mt-1">{label}</p>
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className="block border border-border rounded-lg p-4 bg-surface hover:border-accent hover:bg-surface-2 transition-colors"
      >
        {body}
      </Link>
    )
  }
  return <div className="border border-border rounded-lg p-4 bg-surface">{body}</div>
}

export default function Dashboard() {
  const { profile } = useAuth()
  const isAdmin = isAdminOrDeptAdmin(profile, 'sales')
  const isManager = profile?.role === 'manager' && !isAdmin
  const isMerchant = profile?.role === 'merchant'

  const [samples, setSamples] = useState<SampleWithRelations[]>([])
  const [movements, setMovements] = useState<MovementWithRelations[]>([])
  const [shiftRequests, setShiftRequests] = useState<ShiftRequestWithRelations[]>([])
  const [panelCount, setPanelCount] = useState(0)
  const [buyerCount, setBuyerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [s, m, p, b, sr] = await Promise.all([
        listSamples(),
        listMovements(),
        listPanels(),
        fetchBuyers(),
        listShiftRequests().catch(() => [] as ShiftRequestWithRelations[]),
      ])
      setSamples(s)
      setMovements(m)
      setPanelCount(p.length)
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

  const inHall = samples.filter((s) => s.status === 'in_hall').length
  const issued = samples.filter((s) => s.status === 'checked_out').length
  const expiringSoon = samples.filter((s) => getValidityStatus(s.expiry_date) === 'expiring_soon').length
  const recentMovements = movements.slice(0, 8)

  const mySamples = isManager ? samples.filter((s) => norm(s.hall?.name) === norm(profile?.hall)) : samples
  const myIssued = mySamples.filter((s) => s.status === 'checked_out')
  const incoming = shiftRequests.filter(
    (r) => r.status === 'pending' && norm(r.to_hall?.name) === norm(profile?.hall),
  ).length

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
            <StatCard label="Total Samples" value={samples.length} to="/sales/mcsp/mcs/samples" />
            <StatCard label="Total Panels" value={panelCount} to="/sales/mcsp/mcp/panels" />
            <StatCard label="Total Buyers" value={buyerCount} to="/sales/mcsp/buyers" />
            <StatCard label="Currently Issued" value={issued} to="/sales/mcsp/mcs/samples?status=checked_out" />
            <StatCard label="Expiring Soon" value={expiringSoon} to="/sales/mcsp/mcs/samples?status=expiring_soon" />
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

      {isManager && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-8">
            <StatCard
              label="Total In Hall"
              value={mySamples.filter((s) => s.status === 'in_hall').length}
              to="/sales/mcsp/mcs/samples?status=in_hall"
            />
            <StatCard label="Currently Issued" value={myIssued.length} to="/sales/mcsp/mcs/samples?status=checked_out" />
            <StatCard label="Incoming (shift requests)" value={incoming} to="/sales/mcsp/shift-requests" />
            <StatCard
              label="Expiring Soon"
              value={mySamples.filter((s) => getValidityStatus(s.expiry_date) === 'expiring_soon').length}
              to="/sales/mcsp/mcs/samples?status=expiring_soon"
            />
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
            <StatCard label="Total Samples" value={samples.length} to="/sales/mcsp/mcs/samples" />
            <StatCard label="In Hall" value={inHall} to="/sales/mcsp/mcs/samples?status=in_hall" />
            <StatCard label="Issued" value={issued} to="/sales/mcsp/mcs/samples?status=checked_out" />
            <StatCard label="Expiring Soon" value={expiringSoon} to="/sales/mcsp/mcs/samples?status=expiring_soon" />
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
