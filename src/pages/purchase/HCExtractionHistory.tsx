import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchExtractions, fetchUserNames } from '../../lib/purchase/db'
import type { HCExtraction } from '../../lib/purchase/dbTypes'

export default function HCExtractionHistory() {
  const [extractions, setExtractions] = useState<HCExtraction[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchExtractions()
      .then(async (rows) => {
        setExtractions(rows)
        setNames(await fetchUserNames(rows.map((r) => r.created_by).filter((id): id is string => !!id)))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-medium text-text mb-1">HC Extraction History</h1>
      <p className="text-sm text-text-secondary mb-6">Past extractions, most recent first.</p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Date</th>
              <th className="font-medium px-4 py-2.5">Created by</th>
              <th className="font-medium px-4 py-2.5">Source</th>
              <th className="font-medium px-4 py-2.5 text-center">Rows</th>
              <th className="font-medium px-4 py-2.5 text-right">Total rate</th>
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
            ) : extractions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  No extractions yet.
                </td>
              </tr>
            ) : (
              extractions.map((ex) => (
                <tr key={ex.id} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                  <td className="px-4 py-2.5 text-text">
                    <Link to={`/purchase/hc-extraction/history/${ex.id}`} className="block">
                      {new Date(ex.created_at).toLocaleDateString()}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {ex.created_by ? names.get(ex.created_by) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary capitalize">{ex.source_type}</td>
                  <td className="px-4 py-2.5 text-center text-text">{ex.row_count}</td>
                  <td className="px-4 py-2.5 text-right text-text tabular-nums">{ex.total_rate.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-text-secondary capitalize">{ex.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
