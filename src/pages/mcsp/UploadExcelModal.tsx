import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { fetchBuyers, uploadExcelImport } from '../../lib/mcsp/db'
import type { Buyer, ExcelImportResult, ItemType } from '../../lib/mcsp/dbTypes'

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

/**
 * Full server-side Excel import for MCSP — one upload parses the row data
 * AND extracts/uploads embedded images (see supabase/functions/
 * extract-excel-data). Works for either Samples or Panels; `defaultItemType`
 * just pre-selects the toggle for whichever page this was opened from.
 */
export default function UploadExcelModal({
  defaultItemType,
  onClose,
  onImported,
}: {
  defaultItemType: ItemType
  onClose: () => void
  onImported: () => void
}) {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [itemType, setItemType] = useState<ItemType>(defaultItemType)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExcelImportResult | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    fetchBuyers()
      .then((b) => {
        setBuyers(b)
        if (b.length === 1) setBuyerId(b[0].id)
      })
      .catch(() => {})
  }, [])

  function handleFile(f: File | null) {
    setFileError(null)
    if (f && !isAcceptedFile(f)) {
      setFile(null)
      setFileError('Unsupported file type. Upload a .xlsx or .xls file.')
      return
    }
    setFile(f)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!buyerId || !file) {
      setError('Buyer and an Excel file are required.')
      return
    }
    setUploading(true)
    try {
      const res = await uploadExcelImport({ file, buyerId, itemType })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleDone() {
    onImported()
    onClose()
  }

  const itemLabel = itemType === 'sample' ? 'Sample' : 'Panel'
  const codeLabel = itemType === 'sample' ? 'BT Code' : 'Panel Code'

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-lg bg-bg border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text">Upload Excel</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className="rounded-md border border-border bg-surface px-4 py-3">
              <p className="text-sm font-medium text-text">
                {result.imported} imported, {result.skipped} skipped (duplicates)
                {result.images_uploaded > 0 ? `, ${result.images_uploaded} image${result.images_uploaded === 1 ? '' : 's'} linked` : ''}
              </p>
            </div>

            {result.skipped_codes.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSkipped((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-text hover:text-accent transition-colors"
                >
                  {showSkipped ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  Skipped {codeLabel}s ({result.skipped_codes.length})
                </button>
                {showSkipped && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-md">
                    <ul className="divide-y divide-border">
                      {result.skipped_codes.map((code, i) => (
                        <li key={`${code}-${i}`} className="px-3 py-1.5 text-sm text-text-secondary font-mono">
                          {code}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowErrors((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-warning hover:opacity-80 transition-opacity"
                >
                  {showErrors ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  Rows not imported ({result.errors.length})
                </button>
                {showErrors && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-md">
                    <ul className="divide-y divide-border">
                      {result.errors.map((msg, i) => (
                        <li key={i} className="px-3 py-1.5 text-sm text-warning">
                          {msg}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleDone}
                className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:bg-accent-hover transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Import</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setItemType('sample')}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    itemType === 'sample' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary'
                  }`}
                >
                  Samples
                </button>
                <button
                  type="button"
                  onClick={() => setItemType('panel')}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    itemType === 'panel' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary'
                  }`}
                >
                  Panels
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Buyer</label>
              <select
                required
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
              <label className="block text-sm text-text-secondary mb-1.5">Excel File</label>
              <input
                type="file"
                required
                accept=".xlsx,.xls"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-text file:mr-3 file:rounded-md file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-sm file:text-text hover:file:bg-surface file:transition-colors"
              />
              {fileError && <p className="text-xs text-warning mt-1.5">{fileError}</p>}
              <p className="text-xs text-text-secondary mt-1.5">
                Column names are matched automatically (e.g. "{codeLabel}", "Product Name", "Hall") — headers don't need to
                match exactly. Embedded photos are matched to their row and uploaded automatically.
              </p>
            </div>

            {uploading && (
              <div className="rounded-md border border-border bg-surface px-3 py-2.5 flex items-center gap-2.5">
                <svg className="w-4 h-4 animate-spin text-text-secondary shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-sm text-text-secondary">
                  Uploading and importing {itemLabel.toLowerCase()}s — this can take a moment for files with photos…
                </span>
              </div>
            )}

            {error && <p className="text-sm text-warning">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="flex-1 rounded-md border border-border text-text text-sm font-medium py-2 hover:bg-surface transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !buyerId || !file}
                className="flex-1 rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
