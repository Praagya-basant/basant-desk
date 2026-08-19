import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  extractHCRows,
  getFlagReason,
  getDescriptionsFromPastedText,
  type ExtractionResult,
  type PriceGrid,
} from '../../lib/purchase/extractHCRows'
import { fetchSuppliers, fetchPriceGridForSupplier, saveExtraction, buildPriceGridRecord } from '../../lib/purchase/db'
import { parseExcelDescriptions } from '../../lib/purchase/parseExcel'
import { logActivity } from '../../lib/activityLog'
import ExtractionPreviewTable from '../../components/purchase/ExtractionPreviewTable'
import SummaryStrip from '../../components/purchase/SummaryStrip'
import Toast from '../../components/Toast'

type Mode = 'paste' | 'upload'

const DEFAULT_SUPPLIER = 'AB Craft'

export default function HCExtraction() {
  const { profile } = useAuth()

  const [mode, setMode] = useState<Mode>('paste')
  const [pasteText, setPasteText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileLines, setFileLines] = useState<string[] | null>(null)

  const [suppliers, setSuppliers] = useState<string[]>([])
  const [suppliersError, setSuppliersError] = useState<string | null>(null)
  const [supplier, setSupplier] = useState('')

  const [grid, setGrid] = useState<PriceGrid | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)

  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [savedExtractionId, setSavedExtractionId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSuppliers()
      .then((list) => {
        setSuppliers(list)
        // Pre-select AB Craft when it's present; otherwise leave the
        // dropdown for the user to choose explicitly.
        setSupplier((current) => current || (list.includes(DEFAULT_SUPPLIER) ? DEFAULT_SUPPLIER : current))
      })
      .catch((e) => setSuppliersError(e.message))
  }, [])

  useEffect(() => {
    if (!supplier) {
      setGrid(null)
      return
    }
    let cancelled = false
    setGridError(null)
    // Changing supplier invalidates any preview already on screen — its
    // rates were calculated against the previous supplier's numbers.
    setResult(null)
    fetchPriceGridForSupplier(supplier)
      .then((rows) => {
        if (!cancelled) setGrid(buildPriceGridRecord(rows))
      })
      .catch((e) => {
        if (!cancelled) setGridError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [supplier])

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)
    try {
      const lines = await parseExcelDescriptions(file)
      setFileLines(lines)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
      setFileLines(null)
    }
  }

  // Extraction and save are one action now — there's no separate "Save"
  // step to gate on flagged rows. A saved extraction with flagged/defaulted
  // rows is corrected afterward via the history detail page's edit flow
  // (Admin / department_admin_for('purchase') only), not before saving.
  function handleExtract() {
    if (!grid || !supplier) return
    setExtracting(true)
    setError(null)
    setResult(null)
    setSavedExtractionId(null)

    // Yield to the browser so the "Extracting…" state actually paints before
    // the (potentially heavy, synchronous) parsing work runs on large files.
    setTimeout(async () => {
      const lines = mode === 'paste' ? getDescriptionsFromPastedText(pasteText) : (fileLines ?? [])
      if (lines.length === 0) {
        setError(mode === 'paste' ? 'Paste some description rows first.' : 'Upload a file first.')
        setExtracting(false)
        return
      }

      const extracted = extractHCRows(lines, grid)
      setResult(extracted)
      setExtracting(false)

      if (extracted.rows.length === 0 || !profile) return

      setSaving(true)
      try {
        const id = await saveExtraction({
          createdBy: profile.id,
          sourceType: mode === 'paste' ? 'paste' : 'excel',
          supplier,
          rows: extracted.rows,
        })
        await logActivity(profile.id, 'purchase', 'hc_extraction.saved', {
          extraction_id: id,
          supplier,
          row_count: extracted.rows.length,
          total_rate: extracted.totalRate,
        })
        setSavedExtractionId(id)
        setSavedToast(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Extraction ran, but saving it failed.')
      } finally {
        setSaving(false)
      }
    }, 0)
  }

  const flaggedCount = result?.rows.filter((r) => getFlagReason(r) !== null).length ?? 0

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-medium text-text mb-1">HC Sheet Extraction</h1>
      <p className="text-sm text-text-secondary mb-6">
        Paste or upload honeycomb sheet product logs to extract structured rows.
      </p>

      <div className="mb-6">
        <label className="block text-sm text-text-secondary mb-1.5">Supplier</label>
        <select
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="w-full max-w-xs rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors"
        >
          <option value="">Select a supplier…</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {suppliersError && <p className="text-sm text-red-600 mt-1.5">Could not load suppliers: {suppliersError}</p>}
        {gridError && <p className="text-sm text-red-600 mt-1.5">Could not load the price grid: {gridError}</p>}
      </div>

      <div className="flex gap-1 mb-4 border border-border rounded-md p-1 w-fit bg-surface">
        <button
          onClick={() => setMode('paste')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            mode === 'paste' ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
          }`}
        >
          Paste text
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            mode === 'upload' ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
          }`}
        >
          Upload Excel
        </button>
      </div>

      {mode === 'paste' ? (
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={8}
          placeholder="Paste description rows, one per line…"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors font-mono mb-4"
        />
      ) : (
        <div className="mb-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="text-sm text-text-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-text file:transition-colors hover:file:bg-bg"
          />
          {fileName && (
            <p className="text-sm text-text-secondary mt-2">
              {fileName} — {fileLines?.length ?? 0} description row{fileLines?.length === 1 ? '' : 's'} found
            </p>
          )}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={handleExtract}
          disabled={extracting || saving || !supplier || !grid}
          className="flex items-center gap-2 rounded-md bg-text text-bg text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {(extracting || saving) && <Loader2 size={14} className="animate-spin" />}
          {extracting ? 'Extracting…' : saving ? 'Saving…' : 'Extract'}
        </button>
        {!supplier && <p className="text-sm text-text-secondary mt-2">Select a supplier to continue.</p>}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {result && (
        <div>
          <SummaryStrip
            rowCount={result.rows.length}
            totalRate={result.totalRate}
            flaggedCount={flaggedCount}
            supplier={supplier}
          />

          <ExtractionPreviewTable rows={result.rows} editable={false} />

          {savedExtractionId && (
            <p className="text-sm text-text-secondary mt-3">
              Saved.{' '}
              <Link to={`/purchase/honeycomb/history/${savedExtractionId}`} className="text-text underline hover:no-underline">
                View in history
              </Link>
              {flaggedCount > 0 && ' to correct flagged rows.'}
            </p>
          )}

          {result.unparsed.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-medium text-text mb-1">Not included in calculation</h2>
              <p className="text-sm text-text-secondary mb-3">
                {result.unparsed.length} description{result.unparsed.length === 1 ? '' : 's'} had no readable size
                and {result.unparsed.length === 1 ? 'was' : 'were'} skipped entirely.
              </p>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface border-b border-border text-left text-text-secondary">
                      <th className="font-medium px-4 py-2.5">Code</th>
                      <th className="font-medium px-4 py-2.5">Description</th>
                      <th className="font-medium px-4 py-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.unparsed.map((u, i) => (
                      <tr key={i} className="border-b border-border last:border-0 border-l-2 border-l-amber-400">
                        <td className="px-4 py-2.5 text-text">{u.code || '—'}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{u.description}</td>
                        <td className="px-4 py-2.5 text-text-secondary">
                          {u.reason === 'no-dimension-found' ? 'No size found' : 'No code found'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {savedToast && <Toast message="Extraction saved" onDismiss={() => setSavedToast(false)} />}
    </div>
  )
}
