import { useEffect, useState } from 'react'
import { listMovements } from '../../lib/mcsp/db'
import type { MovementWithRelations } from '../../lib/mcsp/dbTypes'

export default function Movements() {
  const [movements, setMovements] = useState<MovementWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMovements()
      .then(setMovements)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load movements.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium text-text">Movements</h1>
        <p className="text-sm text-text-secondary mt-0.5">Full checkout / return / forward history.</p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">BT Code</th>
              <th className="font-medium px-4 py-2.5">Picked By</th>
              <th className="font-medium px-4 py-2.5">Destination</th>
              <th className="font-medium px-4 py-2.5">Reason</th>
              <th className="font-medium px-4 py-2.5">Picked At</th>
              <th className="font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  No movements yet.
                </td>
              </tr>
            ) : (
              movements.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text font-mono">{m.sample?.bt_code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text">{m.picked_by_name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{m.destination}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{m.reason_other || m.reason}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{new Date(m.picked_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        m.status === 'returned' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {m.status === 'returned' ? 'Returned' : 'Out'}
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
