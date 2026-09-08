import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { fetchHalls, createHall, updateHall, deleteHall } from '../../lib/mcsp/db'
import type { Hall } from '../../lib/mcsp/dbTypes'

function friendlyError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback
  if (/duplicate key|unique/i.test(msg)) return 'A hall with that name or number already exists.'
  return msg
}

export default function Halls() {
  const [halls, setHalls] = useState<Hall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [hallNumber, setHallNumber] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNumber, setEditNumber] = useState('')
  const [editName, setEditName] = useState('')

  async function load() {
    setLoading(true)
    try {
      setHalls(await fetchHalls())
      setError(null)
    } catch (err) {
      setError(friendlyError(err, 'Could not load halls.'))
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
    setError(null)
    try {
      await createHall(num, name.trim())
      setHallNumber('')
      setName('')
      setAdding(false)
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Could not add hall.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const num = Number(editNumber)
    if (!num || !editName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateHall(id, num, editName.trim())
      setEditingId(null)
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Could not update hall.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(h: Hall) {
    if (!window.confirm(`Delete "${h.name}"? This can't be undone.`)) return
    setError(null)
    try {
      await deleteHall(h.id)
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Could not delete hall.'))
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
          className="flex items-center gap-1.5 rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover transition-colors"
        >
          <Plus size={15} strokeWidth={2} />
          Add hall
        </button>
      </div>

      {error && <p className="text-sm text-warning mb-4">{error}</p>}

      {adding && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            autoFocus
            type="number"
            value={hallNumber}
            onChange={(e) => setHallNumber(e.target.value)}
            placeholder="Hall no."
            className="w-28 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hall name"
            className="flex-1 max-w-xs rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
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
            <tr className="bg-surface-2 border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5 w-28">Hall No.</th>
              <th className="font-medium px-4 py-2.5">Name</th>
              <th className="font-medium px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-text-secondary">Loading…</td>
              </tr>
            ) : halls.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-text-secondary">No halls yet.</td>
              </tr>
            ) : (
              halls.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">
                    {editingId === h.id ? (
                      <input
                        type="number"
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                        className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-accent"
                      />
                    ) : (
                      h.hall_number
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text">
                    {editingId === h.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(h.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-full max-w-xs rounded-md border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-accent"
                      />
                    ) : (
                      h.name
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {editingId === h.id ? (
                      <>
                        <button onClick={() => handleSaveEdit(h.id)} disabled={saving} className="text-xs text-accent hover:underline disabled:opacity-50">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-text-secondary hover:text-text ml-3">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(h.id)
                            setEditNumber(String(h.hall_number))
                            setEditName(h.name)
                          }}
                          className="text-text-secondary hover:text-text transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => handleDelete(h)}
                          className="text-text-secondary hover:text-warning transition-colors ml-3"
                          title="Delete"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted mt-3">
        Renaming a hall also updates which one a manager is matched to — their <span className="font-mono">hall</span> field
        matches by name (case-insensitive).
      </p>
    </div>
  )
}
