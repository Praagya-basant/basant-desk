import { useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { fetchHalls, createHall } from '../../lib/mcsp/db'
import type { Hall } from '../../lib/mcsp/dbTypes'

export default function Halls() {
  const [halls, setHalls] = useState<Hall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [hallNumber, setHallNumber] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setHalls(await fetchHalls())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load halls.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const num = Number(hallNumber)
    if (!num || !name.trim()) return
    setSaving(true)
    try {
      await createHall(num, name.trim())
      setHallNumber('')
      setName('')
      setAdding(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add hall.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text">Halls</h1>
          <p className="text-sm text-text-secondary mt-0.5">Sample halls samples are signed into.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-md bg-text text-bg text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={15} strokeWidth={2} />
          Add hall
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {adding && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            autoFocus
            type="number"
            value={hallNumber}
            onChange={(e) => setHallNumber(e.target.value)}
            placeholder="Hall no."
            className="w-28 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hall name"
            className="flex-1 max-w-xs rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-text text-bg text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setHallNumber('')
              setName('')
            }}
            className="rounded-md border border-border text-text text-sm px-3 py-2 hover:bg-surface transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Hall No.</th>
              <th className="font-medium px-4 py-2.5">Name</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : halls.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-text-secondary">
                  No halls yet.
                </td>
              </tr>
            ) : (
              halls.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">{h.hall_number}</td>
                  <td className="px-4 py-2.5 text-text">{h.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
