import { useEffect, useState, type FormEvent } from 'react'
import { X, ImageOff } from 'lucide-react'
import { checkoutSample, fetchHalls, uploadImage } from '../../../lib/mcsp/db'
import { NON_HALL_DESTINATIONS, PURCHASER_OPTIONS, REASON_OPTIONS } from '../../../lib/mcsp/dbTypes'
import type { Hall, SampleWithRelations } from '../../../lib/mcsp/dbTypes'

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
  const [supplierName, setSupplierName] = useState('')
  const [purchaserName, setPurchaserName] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHalls().then(setHalls)
  }, [])

  const destinationOptions = [...halls.filter((h) => h.id !== sample.hall_id).map((h) => h.name), ...NON_HALL_DESTINATIONS]

  function handlePhoto(file: File | null) {
    setPhotoFile(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!destination || !pickedByName.trim()) {
      setError('Destination and "Issued To" are required.')
      return
    }
    setSaving(true)
    try {
      // Photo upload happens before the RPC call so the movement row can be
      // written with its final photo_url in one shot — optimistic on the
      // caller's side otherwise: the modal closes immediately on success and
      // the parent's onChanged() re-fetches, so a slow upload only delays
      // this one submit, never blocks the rest of the UI.
      const photoUrl = photoFile ? await uploadImage(photoFile) : undefined
      await checkoutSample({
        sampleId: sample.id,
        pickedByName: pickedByName.trim(),
        destination,
        reason,
        reasonOther: reason === 'Other' ? reasonOther.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
        supplierName: destination === 'Supplier' ? supplierName.trim() || undefined : undefined,
        purchaserName: destination === 'Supplier' ? purchaserName || undefined : undefined,
        photoUrl,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue this sample.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">Issue Sample</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Sample context */}
        <div className="flex items-center gap-3 px-5 py-3 bg-surface border-b border-border">
          <div className="w-12 h-12 rounded-md bg-surface-2 shrink-0 flex items-center justify-center overflow-hidden">
            {sample.image_url ? (
              <img src={sample.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageOff size={16} strokeWidth={1.5} className="text-text-muted" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">{sample.product_name}</p>
            <p className="text-xs text-text-secondary font-mono">{sample.bt_code}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Issued To</label>
            <input
              value={pickedByName}
              onChange={(e) => setPickedByName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Destination</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
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
            <>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Supplier Name</label>
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Purchaser</label>
                <select
                  value={purchaserName}
                  onChange={(e) => setPurchaserName(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
                >
                  <option value="">Select…</option>
                  {PURCHASER_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-text-secondary mb-2">Reason</label>
            <div className="flex flex-wrap gap-1.5">
              {REASON_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    reason === r ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:text-text'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Reason (other)</label>
              <input
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Photo (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)} className="w-full text-sm text-text" />
            {photoPreview && <img src={photoPreview} alt="" className="mt-2 w-20 h-20 object-cover rounded-md border border-border" />}
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
              {saving ? 'Issuing…' : 'Issue Sample'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
