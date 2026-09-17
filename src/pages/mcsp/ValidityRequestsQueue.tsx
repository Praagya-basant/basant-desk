import { useEffect, useState } from 'react'
import { listValidityRequests, reviewValidityRequest } from '../../lib/mcsp/db'
import type { ValidityRequestWithRelations } from '../../lib/mcsp/dbTypes'

function ItemCell({ r }: { r: ValidityRequestWithRelations }) {
  if (!r.item) return <span className="text-text-secondary capitalize">{r.item_type}</span>
  return (
    <div>
      <span className="font-mono text-text">{r.item.code}</span>
      <span className="text-text-secondary"> · {r.item.name}</span>
      <span className="block text-xs text-text-muted">
        {[r.item.buyerName, r.item.hallName].filter(Boolean).join(' · ') || r.item_type}
      </span>
    </div>
  )
}

export default function ValidityRequestsQueue() {
  const [requests, setRequests] = useState<ValidityRequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRequests(await listValidityRequests())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load validity requests.')
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
      await reviewValidityRequest(id, approve)
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
        <h1 className="text-lg font-medium text-text">Validity Requests</h1>
        <p className="text-sm text-text-secondary mt-0.5">Extension requests raised for samples and panels, pending approval.</p>
      </div>

      {error && <p className="text-sm text-warning mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Item</th>
              <th className="font-medium px-4 py-2.5">Requested by</th>
              <th className="font-medium px-4 py-2.5">Extension</th>
              <th className="font-medium px-4 py-2.5">Reason</th>
              <th className="font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">Loading…</td></tr>
            ) : pending.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">No pending requests.</td></tr>
            ) : (
              pending.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5"><ItemCell r={r} /></td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.requester ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {r.requested_expiry_date ?? (r.requested_months ? `+${r.requested_months} months` : '—')}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.reason ?? '—'}</td>
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
              <th className="font-medium px-4 py-2.5">Status</th>
              <th className="font-medium px-4 py-2.5">Reason</th>
            </tr>
          </thead>
          <tbody>
            {decided.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-text-secondary">No history yet.</td></tr>
            ) : (
              decided.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5"><ItemCell r={r} /></td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {r.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.reason ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
