import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { adminUpdateValidity, raiseValidityRequest } from '../../lib/mcsp/db'
import type { ItemType } from '../../lib/mcsp/dbTypes'

/** Admin/Sales Admin: directly extend or pre-expire, with reason (logged to
 * validity_changes). Everyone else (manager/merchant): raise a
 * validity_requests row, pending admin (or the item's own hall manager)
 * approval. Same component either way — only the submit action differs. */
export default function ManageValidityModal({
  itemType,
  itemId,
  currentExpiry,
  isAdmin,
  onClose,
  onSaved,
}: {
  itemType: ItemType
  itemId: string
  currentExpiry: string | null
  isAdmin: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [newExpiry, setNewExpiry] = useState(currentExpiry ?? '')
  const [months, setMonths] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (isAdmin) {
        if (!newExpiry) throw new Error('New expiry date is required.')
        await adminUpdateValidity(itemType, itemId, newExpiry, reason)
      } else {
        if (!profile) throw new Error('Not signed in.')
        await raiseValidityRequest({
          itemType,
          itemId,
          requestedBy: profile.id,
          requestedMonths: months ? Number(months) : undefined,
          requestedExpiryDate: newExpiry || undefined,
          reason,
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">{isAdmin ? 'Manage Validity' : 'Request Extension'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isAdmin ? (
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">New Expiry Date</label>
              <input
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
              <p className="text-xs text-text-secondary mt-1.5">
                A date before today pre-expires the item; a later date extends it.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Extend by (months)</label>
                <input
                  type="number"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Or a specific new expiry date</label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
              {saving ? 'Saving…' : isAdmin ? 'Save' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
