import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { createSample, fetchBuyers, fetchHalls, uploadImage } from '../../../lib/mcsp/db'
import type { Buyer, Hall } from '../../../lib/mcsp/dbTypes'

export default function AddSampleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [halls, setHalls] = useState<Hall[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [hallId, setHallId] = useState('')
  const [btCode, setBtCode] = useState('')
  const [productName, setProductName] = useState('')
  const [productRef, setProductRef] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [signedBy, setSignedBy] = useState('')
  const [signedDate, setSignedDate] = useState('')
  const [validityMode, setValidityMode] = useState<'months' | 'date'>('months')
  const [validityMonths, setValidityMonths] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchBuyers(), fetchHalls()]).then(([b, h]) => {
      setBuyers(b)
      setHalls(h)
      if (b.length === 1) setBuyerId(b[0].id)
      if (h.length === 1) setHallId(h[0].id)
    })
  }, [])

  function handleImage(file: File | null) {
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!buyerId || !hallId || !btCode.trim() || !productName.trim()) {
      setError('Buyer, hall, BT code and product name are required.')
      return
    }
    setSaving(true)
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : undefined
      await createSample({
        buyerId,
        hallId,
        btCode: btCode.trim(),
        productName: productName.trim(),
        productRef: productRef.trim() || undefined,
        collectionName: collectionName.trim() || undefined,
        signedBy: signedBy.trim() || undefined,
        signedDate: signedDate || undefined,
        validityMonths: validityMode === 'months' && validityMonths ? Number(validityMonths) : undefined,
        expiryDate: validityMode === 'date' && expiryDate ? expiryDate : undefined,
        imageUrl,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this sample.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">Add Sample</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Buyer</label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              >
                <option value="">Select…</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Hall</label>
              <select
                value={hallId}
                onChange={(e) => setHallId(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              >
                <option value="">Select…</option>
                {halls.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">BT Code</label>
            <input
              value={btCode}
              onChange={(e) => setBtCode(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text font-mono outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Product Name</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Product Ref</label>
              <input
                value={productRef}
                onChange={(e) => setProductRef(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Collection</label>
              <input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Signed By</label>
              <input
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Signed Date</label>
              <input
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Validity</label>
            <div className="flex gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setValidityMode('months')}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  validityMode === 'months' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary'
                }`}
              >
                Months
              </button>
              <button
                type="button"
                onClick={() => setValidityMode('date')}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  validityMode === 'date' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary'
                }`}
              >
                Expiry Date
              </button>
            </div>
            {validityMode === 'months' ? (
              <input
                type="number"
                value={validityMonths}
                onChange={(e) => setValidityMonths(e.target.value)}
                placeholder="e.g. 12"
                className="w-32 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
            ) : (
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
            )}
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Image</label>
            <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0] ?? null)} className="w-full text-sm text-text" />
            {imagePreview && <img src={imagePreview} alt="" className="mt-2 w-24 h-24 object-cover rounded-md border border-border" />}
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
              {saving ? 'Saving…' : 'Add Sample'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
