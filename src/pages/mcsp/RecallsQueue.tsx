import { useEffect, useState } from 'react'
import { listAllRecalls, updateRecallStatus } from '../../lib/mcsp/db'
import type { RecallRequestWithRelations } from '../../lib/mcsp/dbTypes'

const STATUS_TINT: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  acknowledged: 'bg-info/10 text-info',
  resolved: 'bg-success/10 text-success',
}

export default function RecallsQueue() {
  const [recalls, setRecalls] = useState<RecallRequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRecalls(await listAllRecalls())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recalls.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function act(id: string, status: 'acknowledged' | 'resolved') {
    setActingId(id)
    try {
      await updateRecallStatus(id, status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this recall.')
    } finally {
      setActingId(null)
    }
  }

  const open = recalls.filter((r) => r.status !== 'resolved')
  const resolved = recalls.filter((r) => r.status === 'resolved')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium text-text">Recalls</h1>
        <p className="text-sm text-text-secondary mt-0.5">Merchant-raised requests to pull a sample back to its hall.</p>
      </div>

      {error && <p className="text-sm text-warning mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Sample</th>
              <th className="font-medium px-4 py-2.5">Buyer</th>
              <th className="font-medium px-4 py-2.5">Hall</th>
              <th className="font-medium px-4 py-2.5">Raised by</th>
              <th className="font-medium px-4 py-2.5">Reason</th>
              <th className="font-medium px-4 py-2.5">Status</th>
              <th className="font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-text-secondary">Loading…</td></tr>
            ) : open.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-text-secondary">No open recalls.</td></tr>
            ) : (
              open.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">
                    <span className="font-mono">{r.sample?.bt_code ?? '—'}</span>
                    <span className="text-text-secondary"> · {r.sample?.product_name ?? ''}</span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.sample?.buyer?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.sample?.hall?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.requester ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.reason ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_TINT[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                    {r.status === 'pending' && (
                      <button onClick={() => act(r.id, 'acknowledged')} disabled={actingId === r.id} className="text-xs text-accent hover:underline disabled:opacity-50">
                        Acknowledge
                      </button>
                    )}
                    <button onClick={() => act(r.id, 'resolved')} disabled={actingId === r.id} className="text-xs text-accent hover:underline disabled:opacity-50">
                      Resolve
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-medium text-text mb-3">Resolved</h2>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Sample</th>
              <th className="font-medium px-4 py-2.5">Buyer</th>
              <th className="font-medium px-4 py-2.5">Raised by</th>
              <th className="font-medium px-4 py-2.5">Reason</th>
            </tr>
          </thead>
          <tbody>
            {resolved.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">Nothing resolved yet.</td></tr>
            ) : (
              resolved.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text font-mono">{r.sample?.bt_code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.sample?.buyer?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.requester ?? '—'}</td>
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
