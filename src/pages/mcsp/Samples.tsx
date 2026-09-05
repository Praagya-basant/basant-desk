import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { getOpenMovement, listSamples, returnSample } from '../../lib/mcsp/db'
import type { SampleWithRelations } from '../../lib/mcsp/dbTypes'
import AddSampleModal from './AddSampleModal'
import IssueSampleModal from './IssueSampleModal'

type StatusFilter = 'all' | 'in_hall' | 'checked_out'

export default function Samples() {
  const [samples, setSamples] = useState<SampleWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [issuing, setIssuing] = useState<SampleWithRelations | null>(null)
  const [returningId, setReturningId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setSamples(await listSamples())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load samples.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleReturn(sample: SampleWithRelations) {
    setReturningId(sample.id)
    setError(null)
    try {
      const movement = await getOpenMovement(sample.id)
      if (!movement) throw new Error('No open movement found for this sample.')
      await returnSample(movement.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not return this sample.')
    } finally {
      setReturningId(null)
    }
  }

  const filtered = samples.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (
        s.bt_code.toLowerCase().includes(q) ||
        s.product_name.toLowerCase().includes(q) ||
        (s.buyer?.name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text">Samples</h1>
          <p className="text-sm text-text-secondary mt-0.5">Signed samples across every hall.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-md bg-text text-bg text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={15} strokeWidth={2} />
          Add Sample
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search BT code, product or buyer…"
          className="w-72 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
        />
        <div className="flex gap-1 border border-border rounded-md p-1 bg-surface">
          {(['all', 'in_hall', 'checked_out'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === f ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
              }`}
            >
              {f === 'all' ? 'All' : f === 'in_hall' ? 'In Hall' : 'Issued'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">BT Code</th>
              <th className="font-medium px-4 py-2.5">Product</th>
              <th className="font-medium px-4 py-2.5">Buyer</th>
              <th className="font-medium px-4 py-2.5">Hall</th>
              <th className="font-medium px-4 py-2.5">Status</th>
              <th className="font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  No samples found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text font-mono">{s.bt_code}</td>
                  <td className="px-4 py-2.5 text-text">{s.product_name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{s.buyer?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{s.hall?.name ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === 'in_hall' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {s.status === 'in_hall' ? 'In Hall' : 'Issued'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {s.status === 'in_hall' ? (
                      <button
                        onClick={() => setIssuing(s)}
                        className="text-xs text-text-secondary hover:text-text transition-colors"
                      >
                        Issue
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReturn(s)}
                        disabled={returningId === s.id}
                        className="text-xs text-text-secondary hover:text-text transition-colors disabled:opacity-50"
                      >
                        {returningId === s.id ? '…' : 'Return'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <AddSampleModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            load()
          }}
        />
      )}

      {issuing && (
        <IssueSampleModal
          sample={issuing}
          onClose={() => setIssuing(null)}
          onSaved={() => {
            setIssuing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
