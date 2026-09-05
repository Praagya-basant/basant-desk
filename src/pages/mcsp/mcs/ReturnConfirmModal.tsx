import { useState } from 'react'
import { X } from 'lucide-react'
import { uploadImage } from '../../../lib/mcsp/db'

export default function ReturnConfirmModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (photoUrl?: string) => Promise<void>
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file: File | null) {
    setPhotoFile(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const photoUrl = photoFile ? await uploadImage(photoFile) : undefined
      await onConfirm(photoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not return this item.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-sm bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">Confirm Return</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-text-secondary">Mark this item as returned to its hall?</p>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Condition photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-text"
            />
            {preview && <img src={preview} alt="" className="mt-2 w-24 h-24 object-cover rounded-md border border-border" />}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-border text-text text-sm font-medium py-2 hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Returning…' : 'Confirm Return'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
