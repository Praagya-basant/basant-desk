import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import { createPanel, fetchBuyers, fetchHalls, uploadImage } from '../../../lib/mcsp/db'
import type { Buyer, Hall } from '../../../lib/mcsp/dbTypes'

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export default function AddPanelModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth()
  const isManagerOnly = profile?.role === 'manager' && !isAdminOrDeptAdmin(profile, 'sales')
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [halls, setHalls] = useState<Hall[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [hallId, setHallId] = useState('')
  const [panelCode, setPanelCode] = useState('')
  const [panelName, setPanelName] = useState('')
  const [panelRef, setPanelRef] = useState('')
  const [panelFinish, setPanelFinish] = useState('')
  const [finishRecipe, setFinishRecipe] = useState('')
  const [isShared, setIsShared] = useState(false)
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

  const managerHall = useMemo(
    () => (isManagerOnly ? halls.find((h) => norm(h.name) === norm(profile?.hall)) ?? null : null),
    [isManagerOnly, halls, profile?.hall],
  )
  const hallOptions = isManagerOnly ? halls.filter((h) => h.id === managerHall?.id) : halls

  useEffect(() => {
    Promise.all([fetchBuyers(), fetchHalls()]).then(([b, h]) => {
      setBuyers(b)
      setHalls(h)
      if (b.length === 1) setBuyerId(b[0].id)
      if (h.length === 1) setHallId(h[0].id)
    })
  }, [])

  useEffect(() => {
    if (managerHall) setHallId(managerHall.id)
  }, [managerHall])

  function handleImage(file: File | null) {
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!buyerId || !hallId || !panelName.trim()) {
      setError('Buyer, hall and panel name are required.')
      return
    }
    setSaving(true)
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : undefined
      await createPanel({
        buyerId,
        hallId,
        panelCode: panelCode.trim() || undefined,
        panelName: panelName.trim(),
        panelRef: panelRef.trim() || undefined,
        panelFinish: panelFinish.trim() || undefined,
        finishRecipe: finishRecipe.trim() || undefined,
        isShared,
        collectionName: collectionName.trim() || undefined,
        signedBy: signedBy.trim() || undefined,
        signedDate: signedDate || undefined,
        validityMonths: validityMode === 'months' && validityMonths ? Number(validityMonths) : undefined,
        expiryDate: validityMode === 'date' && expiryDate ? expiryDate : undefined,
        imageUrl,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this panel.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">Add Panel</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Buyer</label>
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors">
                <option value="">Select…</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Hall</label>
              <select value={hallId} onChange={(e) => setHallId(e.target.value)} disabled={isManagerOnly} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors disabled:opacity-60">
                {!isManagerOnly && <option value="">Select…</option>}
                {hallOptions.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              {isManagerOnly && !managerHall && halls.length > 0 && (
                <p className="text-xs text-warning mt-1.5">Your assigned hall name doesn’t match any hall — ask an admin to fix it.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Panel Name</label>
            <input value={panelName} onChange={(e) => setPanelName(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Panel Code (optional)</label>
              <input value={panelCode} onChange={(e) => setPanelCode(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text font-mono outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Panel Ref</label>
              <input value={panelRef} onChange={(e) => setPanelRef(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Finish</label>
              <input value={panelFinish} onChange={(e) => setPanelFinish(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Finish Recipe</label>
              <input value={finishRecipe} onChange={(e) => setFinishRecipe(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="rounded border-border" />
            Shared across every merchant (not scoped to one buyer)
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Collection</label>
              <input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Signed By</label>
              <input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Signed Date</label>
            <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors" />
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

          {error && <p className="text-sm text-warning">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-md border border-border text-text text-sm font-medium py-2 hover:bg-surface transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
