import { useEffect, useState } from 'react'
import { listShiftRequests, reviewShiftRequest } from '../../lib/mcsp/db'
import type { ShiftRequestWithRelations } from '../../lib/mcsp/dbTypes'

function ItemCell({ r }: { r: ShiftRequestWithRelations }) {
  if (!r.item) return <span className="text-text-secondary capitalize">{r.item_type}</span>
  return (
    <div>
      <span className="font-mono text-text">{r.item.code}</span>
      <span className="text-text-secondary"> · {r.item.name}</span>
      {r.item.buyerName && <span className="block text-xs text-text-muted">{r.item.buyerName}</span>}
    </div>
  )
}

export default function ShiftRequestsQueue() {
  const [requests, setRequests] = useState<ShiftRequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRequests(await listShiftRequests())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load shift requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleReview(id: string, approve: boolean) {
    setActingId(id)
    try {
      await reviewShiftRequest(id, approve)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review this request.')
    } finally {
      setActingId(null)
    }
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium text-text">Hall Shift Requests</h1>
        <p className="text-sm text-text-secondary mt-0.5">Manager/merchant-raised requests to move an item's home hall.</p>
      </div>

      {error && <p className="text-sm text-warning mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Item</th>
              <th className="font-medium px-4 py-2.5">Requested by</th>
              <th className="font-medium px-4 py-2.5">From</th>
              <th className="font-medium px-4 py-2.5">To</th>
              <th className="font-medium px-4 py-2.5">Note</th>
              <th className="font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-text-secondary">Loading…</td></tr>
            ) : pending.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-text-secondary">No pending requests.</td></tr>
            ) : (
              pending.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5"><ItemCell r={r} /></td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.requester ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.from_hall?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.to_hall?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.note ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => handleReview(r.id, true)} disabled={actingId === r.id} className="text-xs text-accent hover:underline disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => handleReview(r.id, false)} disabled={actingId === r.id} className="text-xs text-warning hover:underline disabled:opacity-50">
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-medium text-text mb-3">History</h2>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Item</th>
              <th className="font-medium px-4 py-2.5">From</th>
              <th className="font-medium px-4 py-2.5">To</th>
              <th className="font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {decided.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">No history yet.</td></tr>
            ) : (
              decided.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5"><ItemCell r={r} /></td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.from_hall?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.to_hall?.name ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {r.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
