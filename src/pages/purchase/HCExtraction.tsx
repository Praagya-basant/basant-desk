import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { extractHCRows } from '../../lib/purchase/extractHCRows'
import { rateRows, rateRow, buildPriceGridLookup } from '../../lib/purchase/calculateRate'
import { fetchPriceGrid, saveExtraction } from '../../lib/purchase/db'
import { parseExcelDescriptions } from '../../lib/purchase/parseExcel'
import type { PriceGridEntry, RatedRow } from '../../lib/purchase/types'
import type { PreviewField } from '../../components/purchase/ExtractionPreviewTable'
import ExtractionPreviewTable from '../../components/purchase/ExtractionPreviewTable'
import SummaryStrip from '../../components/purchase/SummaryStrip'

type Mode = 'paste' | 'upload'

export default function HCExtraction() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'

  const [mode, setMode] = useState<Mode>('paste')
  const [pasteText, setPasteText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileLines, setFileLines] = useState<string[] | null>(null)

  const [grid, setGrid] = useState<PriceGridEntry[] | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)

  const [rows, setRows] = useState<RatedRow[] | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPriceGrid()
      .then((gridRows) => setGrid(gridRows.map((g) => ({ thicknessMm: g.thickness_mm, cell: g.cell, pricePerM2: g.price_per_m2 }))))
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

    const lines = mode === 'paste' ? pasteText.split('\n') : (fileLines ?? [])
    if (lines.filter((l) => l.trim()).length === 0) {
      setError(mode === 'paste' ? 'Paste some description rows first.' : 'Upload a file first.')
      setExtracting(false)
      return
    }

    const extracted = extractHCRows(lines)
    setRows(rateRows(extracted, grid))
    setExtracting(false)
  }

  function handleFieldChange(index: number, field: PreviewField, value: string) {
    if (!rows || !grid) return
    const next = [...rows]
    const row = { ...next[index] }

    switch (field) {
      case 'code':
        row.code = value
        break
      case 'sheetQty':
        row.sheetQty = value === '' ? 1 : Number(value)
        break
      case 'l':
      case 'w':
      case 'thicknessMm':
      case 'cell':
        row[field] = value === '' ? null : Number(value)
        break
    }

    next[index] = rateRow(row, buildPriceGridLookup(grid))
    setRows(next)
  }

  const flaggedCount = rows?.filter((r) => r.flagged).length ?? 0
  const canSave = rows != null && rows.length > 0 && (isAdmin || flaggedCount === 0)

  async function handleSave() {
    if (!rows || !profile) return
    setSaving(true)
    setError(null)
    try {
      const id = await saveExtraction({
        createdBy: profile.id,
        sourceType: mode === 'paste' ? 'paste' : 'excel',
        rows,
      })
      navigate(`/purchase/hc-extraction/history/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this extraction.')
    } finally {
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
            className="text-sm text-text-secondary"
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
        className="rounded-md bg-text text-bg text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 mb-6"
      >
        Extract
      </button>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {rows && (
        <div>
          <SummaryStrip rowCount={rows.length} totalRate={rows.reduce((s, r) => s + (r.rate ?? 0), 0)} flaggedCount={flaggedCount} />

          <ExtractionPreviewTable rows={rows} editable={isAdmin} onFieldChange={handleFieldChange} />

          {!isAdmin && flaggedCount > 0 && (
            <p className="text-sm text-text-secondary mt-3">
              {flaggedCount} row{flaggedCount === 1 ? '' : 's'} need admin correction before this can be saved — ask
              an admin to fix and save, or re-run extraction with corrected input.
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="mt-4 rounded-md bg-text text-bg text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save extraction'}
          </button>
        </div>
      )}
    </div>
  )
}
