import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { checkoutSample, fetchHalls } from '../../lib/mcsp/db'
import { NON_HALL_DESTINATIONS, PURCHASER_OPTIONS, REASON_OPTIONS } from '../../lib/mcsp/dbTypes'
import type { Hall, SampleWithRelations } from '../../lib/mcsp/dbTypes'

export default function IssueSampleModal({
  sample,
  onClose,
  onSaved,
}: {
  sample: SampleWithRelations
  onClose: () => void
  onSaved: () => void
}) {
  const [halls, setHalls] = useState<Hall[]>([])
  const [destination, setDestination] = useState('')
  const [reason, setReason] = useState<string>(REASON_OPTIONS[0])
  const [reasonOther, setReasonOther] = useState('')
  const [pickedByName, setPickedByName] = useState('')
  const [purchaserName, setPurchaserName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHalls().then(setHalls)
  }, [])

  const destinationOptions = [
    ...halls.filter((h) => h.id !== sample.hall_id).map((h) => h.name),
    ...NON_HALL_DESTINATIONS,
  ]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!destination || !pickedByName.trim()) {
      setError('Destination and picker name are required.')
      return
    }
    setSaving(true)
    try {
      await checkoutSample({
        sampleId: sample.id,
        pickedByName: pickedByName.trim(),
        destination,
        reason,
        reasonOther: reason === 'Other' ? reasonOther.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
        purchaserName: destination === 'Supplier' ? purchaserName || undefined : undefined,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue this sample.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-medium text-text">Issue Sample</h2>
            <p className="text-xs text-text-secondary font-mono mt-0.5">{sample.bt_code}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Picked up by</label>
            <input
              value={pickedByName}
              onChange={(e) => setPickedByName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Destination</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
            >
              <option value="">Select…</option>
              {destinationOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {destination === 'Supplier' && (
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Purchaser</label>
              <select
                value={purchaserName}
                onChange={(e) => setPurchaserName(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
              >
                <option value="">Select…</option>
                {PURCHASER_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Reason (other)</label>
              <input
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors resize-none"
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
              className="flex-1 rounded-md bg-text text-bg text-sm font-medium py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Issuing…' : 'Issue Sample'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
