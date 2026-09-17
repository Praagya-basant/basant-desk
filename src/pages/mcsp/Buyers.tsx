import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { fetchBuyers, createBuyer, updateBuyer, deleteBuyer } from '../../lib/mcsp/db'
import type { Buyer } from '../../lib/mcsp/dbTypes'

function friendlyError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback
  if (/duplicate key|unique/i.test(msg)) return 'A buyer with that name already exists.'
  return msg
}

export default function Buyers() {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function load() {
    setLoading(true)
    try {
      setBuyers(await fetchBuyers())
      setError(null)
    } catch (err) {
      setError(friendlyError(err, 'Could not load buyers.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createBuyer(newName.trim())
      setNewName('')
      setAdding(false)
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Could not add buyer.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateBuyer(id, editName.trim())
      setEditingId(null)
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Could not rename buyer.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(b: Buyer) {
    if (!window.confirm(`Delete buyer "${b.name}"? This can't be undone.`)) return
    setError(null)
    try {
      await deleteBuyer(b.id)
      await load()
    } catch (err) {
      setError(friendlyError(err, 'Could not delete buyer.'))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text">Buyers</h1>
          <p className="text-sm text-text-secondary mt-0.5">Companies whose samples are signed in to MCSP.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover transition-colors"
        >
          <Plus size={15} strokeWidth={2} />
          Add buyer
        </button>
      </div>

      {error && <p className="text-sm text-warning mb-4">{error}</p>}

      {adding && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Buyer name"
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
              setNewName('')
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
              <th className="font-medium px-4 py-2.5">Name</th>
              <th className="font-medium px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-text-secondary">Loading…</td>
              </tr>
            ) : buyers.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-text-secondary">No buyers yet.</td>
              </tr>
            ) : (
              buyers.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">
                    {editingId === b.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(b.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-full max-w-xs rounded-md border border-border bg-bg px-2 py-1 text-sm text-text outline-none focus:border-accent"
                      />
                    ) : (
                      b.name
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {editingId === b.id ? (
                      <>
                        <button onClick={() => handleSaveEdit(b.id)} disabled={saving} className="text-xs text-accent hover:underline disabled:opacity-50">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-text-secondary hover:text-text ml-3">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(b.id)
                            setEditName(b.name)
                          }}
                          className="text-text-secondary hover:text-text transition-colors"
                          title="Rename"
                        >
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
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
    </div>
  )
}
