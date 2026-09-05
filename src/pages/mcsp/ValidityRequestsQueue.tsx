import { useEffect, useState } from 'react'
import { listValidityRequests, reviewValidityRequest } from '../../lib/mcsp/db'
import type { ValidityRequest } from '../../lib/mcsp/dbTypes'

export default function ValidityRequestsQueue() {
  const [requests, setRequests] = useState<ValidityRequest[]>([])
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
        <p className="text-sm text-text-secondary mt-0.5">Merchant-raised extension requests, pending approval.</p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Item</th>
              <th className="font-medium px-4 py-2.5">Requested</th>
              <th className="font-medium px-4 py-2.5">Reason</th>
              <th className="font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">Loading…</td></tr>
            ) : pending.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">No pending requests.</td></tr>
            ) : (
              pending.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text capitalize">{r.item_type}</td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {r.requested_expiry_date ?? (r.requested_months ? `+${r.requested_months} months` : '—')}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.reason ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right space-x-2">
                    <button
                      onClick={() => handleReview(r.id, true)}
                      disabled={actingId === r.id}
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(r.id, false)}
                      disabled={actingId === r.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
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
                  <td className="px-4 py-2.5 text-text capitalize">{r.item_type}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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
