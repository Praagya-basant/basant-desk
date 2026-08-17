import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  extractHCRows,
  lookupRate,
  getFlagReason,
  getDescriptionsFromPastedText,
  type ExtractionResult,
  type PriceGrid,
} from '../../lib/purchase/extractHCRows'
import { fetchPriceGrid, saveExtraction, buildPriceGridRecord } from '../../lib/purchase/db'
import { parseExcelDescriptions } from '../../lib/purchase/parseExcel'
import type { PreviewField } from '../../components/purchase/ExtractionPreviewTable'
import ExtractionPreviewTable from '../../components/purchase/ExtractionPreviewTable'
import SummaryStrip from '../../components/purchase/SummaryStrip'
import Toast from '../../components/Toast'

type Mode = 'paste' | 'upload'

export default function HCExtraction() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'

  const [mode, setMode] = useState<Mode>('paste')
  const [pasteText, setPasteText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileLines, setFileLines] = useState<string[] | null>(null)

  const [grid, setGrid] = useState<PriceGrid | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)

  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPriceGrid()
      .then((gridRows) => setGrid(buildPriceGridRecord(gridRows)))
      .catch((e) => setGridError(e.message))
  }, [])

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

  function handleExtract() {
    if (!grid) return
    setExtracting(true)
    setError(null)

    // Yield to the browser so the "Extracting…" state actually paints before
    // the (potentially heavy, synchronous) parsing work runs on large files.
    setTimeout(() => {
      const lines = mode === 'paste' ? getDescriptionsFromPastedText(pasteText) : (fileLines ?? [])
      if (lines.length === 0) {
        setError(mode === 'paste' ? 'Paste some description rows first.' : 'Upload a file first.')
        setExtracting(false)
        return
      }

      setResult(extractHCRows(lines, grid))
      setExtracting(false)
    }, 0)
  }

  function handleFieldChange(index: number, field: PreviewField, value: string) {
    if (!result || !grid) return
    const rows = [...result.rows]
    const row = { ...rows[index] }

    switch (field) {
      case 'code':
        row.code = value
        break
      case 'l':
      case 'w':
        row[field] = value === '' ? NaN : Number(value)
        break
      case 'sheetQty':
        row.sheetQty = value === '' ? 1 : Number(value)
        break
      case 'thicknessMm':
      case 'cell':
        row[field] = value === '' ? null : Number(value)
        break
    }

    row.rate =
      row.thicknessMm !== null && row.cell !== null && !Number.isNaN(row.l) && !Number.isNaN(row.w)
        ? lookupRate(row.l, row.w, row.thicknessMm, row.cell, row.sheetQty, grid)
        : null

    rows[index] = row
    const totalRate = rows.reduce((sum, r) => sum + (r.rate ?? 0), 0)
    setResult({ ...result, rows, totalRate: Math.round(totalRate * 100) / 100 })
  }

  const flaggedCount = result?.rows.filter((r) => getFlagReason(r) !== null).length ?? 0
  const canSave = result != null && result.rows.length > 0 && (isAdmin || flaggedCount === 0)

  async function handleSave() {
    if (!result || !profile) return
    setSaving(true)
    setError(null)
    try {
      const id = await saveExtraction({
        createdBy: profile.id,
        sourceType: mode === 'paste' ? 'paste' : 'excel',
        rows: result.rows,
      })
      setSaving(false)
      setSavedToast(true)
      // brief pause so the confirmation is actually seen before we navigate away
      setTimeout(() => navigate(`/purchase/hc-extraction/history/${id}`), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this extraction.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-medium text-text mb-1">HC Sheet Extraction</h1>
      <p className="text-sm text-text-secondary mb-6">
        Paste or upload honeycomb sheet product logs to extract structured rows.
      </p>

      {gridError && <p className="text-sm text-red-600 mb-4">Could not load the price grid: {gridError}</p>}

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

      <button
        onClick={handleExtract}
        disabled={extracting || !grid}
        className="flex items-center gap-2 rounded-md bg-text text-bg text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 mb-6"
      >
        {extracting && <Loader2 size={14} className="animate-spin" />}
        {extracting ? 'Extracting…' : 'Extract'}
      </button>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {result && (
        <div>
          <SummaryStrip rowCount={result.rows.length} totalRate={result.totalRate} flaggedCount={flaggedCount} />

          <ExtractionPreviewTable rows={result.rows} editable={isAdmin} onFieldChange={handleFieldChange} />

          {!isAdmin && flaggedCount > 0 && (
            <p className="text-sm text-text-secondary mt-3">
              {flaggedCount} row{flaggedCount === 1 ? '' : 's'} need admin correction before this can be saved — ask
              an admin to fix and save, or re-run extraction with corrected input.
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-2 mt-4 rounded-md bg-text text-bg text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save extraction'}
          </button>

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
