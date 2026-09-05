import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { raiseRecall } from '../../../lib/mcsp/db'

export default function RaiseRecallModal({
  sampleId,
  onClose,
  onSaved,
}: {
  sampleId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      await raiseRecall(sampleId, profile.id, reason.trim())
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise this recall.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-sm bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">Raise Recall</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
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
              {saving ? 'Submitting…' : 'Raise Recall'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
