import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchHalls, raiseShiftRequest } from '../../lib/mcsp/db'
import type { Hall, ItemType } from '../../lib/mcsp/dbTypes'

export default function RaiseShiftRequestModal({
  itemType,
  itemId,
  currentHallId,
  onClose,
  onSaved,
}: {
  itemType: ItemType
  itemId: string
  currentHallId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [halls, setHalls] = useState<Hall[]>([])
  const [toHallId, setToHallId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHalls().then(setHalls)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!toHallId || !profile) {
      setError('Destination hall is required.')
      return
    }
    setSaving(true)
    try {
      await raiseShiftRequest({
        itemType,
        itemId,
        fromHallId: currentHallId,
        toHallId,
        requestedBy: profile.id,
        note: note.trim() || undefined,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise this request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">Raise Hall Shift Request</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Move to Hall</label>
            <select
              value={toHallId}
              onChange={(e) => setToHallId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            >
              <option value="">Select…</option>
              {halls.filter((h) => h.id !== currentHallId).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border text-text text-sm font-medium py-2 hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
