import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  buildPriceGridRecord,
  fetchExtraction,
  fetchExtractionRows,
  fetchPriceGrid,
  fetchRowHistory,
  fetchUserNames,
  updateExtractionRow,
} from '../../lib/purchase/db'
import { getFlagReason, lookupRate, type PriceGrid } from '../../lib/purchase/extractHCRows'
import type { HCExtraction, HCExtractionRow, HCExtractionRowHistory } from '../../lib/purchase/dbTypes'
import SummaryStrip from '../../components/purchase/SummaryStrip'

const FIELD_LABELS: Record<string, string> = {
  code: 'Code',
  l: 'L',
  w: 'W',
  thickness_mm: 'Thickness',
  cell: 'Cell',
  sheet_qty: 'Sheet Qty',
  rate: 'Rate',
  flagged: 'Flagged',
  flag_reason: 'Flag reason',
}

function EditableRow({
  row,
  grid,
  editedBy,
  onSaved,
}: {
  row: HCExtractionRow
  grid: PriceGrid
  editedBy: string
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setDraft(row)
    setEditing(true)
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const l = draft.l
      const w = draft.w
      const rate =
        l !== null && w !== null && draft.thickness_mm !== null && draft.cell !== null
          ? lookupRate(l, w, draft.thickness_mm, draft.cell, draft.sheet_qty, grid)
          : null
      const flagReason = getFlagReason({
        l: l ?? NaN,
        w: w ?? NaN,
        thicknessMm: draft.thickness_mm,
        cell: draft.cell,
        rate,
      })

      await updateExtractionRow(
        row,
        {
          code: draft.code,
          l: draft.l,
          w: draft.w,
          thickness_mm: draft.thickness_mm,
          cell: draft.cell,
          sheet_qty: draft.sheet_qty,
          rate,
          flagged: flagReason !== null,
          flag_reason: flagReason,
        },
        editedBy,
      )
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this row.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <tr className={`border-b border-border last:border-0 ${row.flagged ? 'border-l-2 border-l-amber-400' : ''}`}>
        <td className="px-4 py-2.5 text-text">
          {row.code || '—'}
          {row.flagged && <p className="text-xs text-text-secondary mt-0.5">{row.flag_reason}</p>}
        </td>
        <td className="px-4 py-2.5 text-center text-text">{row.l ?? '—'}</td>
        <td className="px-4 py-2.5 text-center text-text">{row.w ?? '—'}</td>
        <td className="px-4 py-2.5 text-center text-text">{row.thickness_mm ?? '—'}</td>
        <td className="px-4 py-2.5 text-center text-text">{row.cell ?? '—'}</td>
        <td className="px-4 py-2.5 text-center text-text">{row.sheet_qty}</td>
        <td className="px-4 py-2.5 text-right text-text tabular-nums">{row.rate != null ? row.rate.toFixed(2) : '—'}</td>
        <td className="px-4 py-2.5 text-right">
          <button onClick={startEdit} className="text-xs text-text-secondary hover:text-text transition-colors">
            Edit
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border last:border-0 bg-surface">
      <td className="px-4 py-2.5">
        <input
          value={draft.code ?? ''}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })}
          className="w-full bg-transparent outline-none border-b border-border"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          value={draft.l ?? ''}
          onChange={(e) => setDraft({ ...draft, l: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-16 bg-transparent outline-none border-b border-border text-center"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          value={draft.w ?? ''}
          onChange={(e) => setDraft({ ...draft, w: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-16 bg-transparent outline-none border-b border-border text-center"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          value={draft.thickness_mm ?? ''}
          onChange={(e) => setDraft({ ...draft, thickness_mm: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-16 bg-transparent outline-none border-b border-border text-center"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          value={draft.cell ?? ''}
          onChange={(e) => setDraft({ ...draft, cell: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-16 bg-transparent outline-none border-b border-border text-center"
        />
      </td>
      <td className="px-4 py-2.5 text-center">
        <input
          value={draft.sheet_qty}
          onChange={(e) => setDraft({ ...draft, sheet_qty: e.target.value === '' ? 1 : Number(e.target.value) })}
          className="w-16 bg-transparent outline-none border-b border-border text-center"
        />
      </td>
      <td className="px-4 py-2.5 text-right text-text-secondary text-xs">recalculated on save</td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
        <button onClick={() => setEditing(false)} className="text-xs text-text-secondary hover:text-text mr-3">
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="text-xs text-text font-medium hover:opacity-70 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  )
}

export default function HCExtractionDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [extraction, setExtraction] = useState<HCExtraction | null>(null)
  const [rows, setRows] = useState<HCExtractionRow[]>([])
  const [history, setHistory] = useState<HCExtractionRowHistory[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [grid, setGrid] = useState<PriceGrid>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const [ex, exRows, exHistory, priceGrid] = await Promise.all([
        fetchExtraction(id),
        fetchExtractionRows(id),
        fetchRowHistory(id),
        fetchPriceGrid(),
      ])
      setExtraction(ex)
      setRows(exRows)
      setHistory(exHistory)
      setGrid(buildPriceGridRecord(priceGrid))

      const userIds = [ex.created_by, ...exHistory.map((h) => h.edited_by)].filter((v): v is string => !!v)
      setNames(await fetchUserNames(userIds))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this extraction.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const rowCodeById = new Map(rows.map((r) => [r.id, r.code || '—']))

  if (loading && !extraction) return <p className="text-sm text-text-secondary">Loading…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!extraction) return null

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-medium text-text mb-1">Extraction — {new Date(extraction.created_at).toLocaleString()}</h1>
      <p className="text-sm text-text-secondary mb-6">
        {extraction.created_by ? names.get(extraction.created_by) ?? 'Unknown' : 'Unknown'} · {extraction.source_type} ·{' '}
        <span className="capitalize">{extraction.status}</span>
      </p>

      <SummaryStrip
        rowCount={rows.length}
        totalRate={extraction.total_rate}
        flaggedCount={rows.filter((r) => r.flagged).length}
      />

      <div className="border border-border rounded-lg overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-text-secondary">
              <th className="font-medium px-4 py-2.5">Code</th>
              <th className="font-medium px-4 py-2.5 text-center">L</th>
              <th className="font-medium px-4 py-2.5 text-center">W</th>
              <th className="font-medium px-4 py-2.5 text-center">Thickness</th>
              <th className="font-medium px-4 py-2.5 text-center">Cell</th>
              <th className="font-medium px-4 py-2.5 text-center">Sheet Qty</th>
              <th className="font-medium px-4 py-2.5 text-right">Rate</th>
              {isAdmin && <th className="font-medium px-4 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              isAdmin ? (
                <EditableRow key={row.id} row={row} grid={grid} editedBy={profile!.id} onSaved={load} />
              ) : (
                <tr key={row.id} className={`border-b border-border last:border-0 ${row.flagged ? 'border-l-2 border-l-amber-400' : ''}`}>
                  <td className="px-4 py-2.5 text-text">
                    {row.code || '—'}
                    {row.flagged && <p className="text-xs text-text-secondary mt-0.5">{row.flag_reason}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-text">{row.l ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center text-text">{row.w ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center text-text">{row.thickness_mm ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center text-text">{row.cell ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center text-text">{row.sheet_qty}</td>
                  <td className="px-4 py-2.5 text-right text-text tabular-nums">{row.rate != null ? row.rate.toFixed(2) : '—'}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-text mb-3">Edit history</h2>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border text-left text-text-secondary">
                  <th className="font-medium px-4 py-2.5">Row</th>
                  <th className="font-medium px-4 py-2.5">Field</th>
                  <th className="font-medium px-4 py-2.5">Old value</th>
                  <th className="font-medium px-4 py-2.5">New value</th>
                  <th className="font-medium px-4 py-2.5">Edited by</th>
                  <th className="font-medium px-4 py-2.5">Edited at</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-text">{rowCodeById.get(h.row_id) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{FIELD_LABELS[h.field_changed] ?? h.field_changed}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{h.old_value ?? '—'}</td>
                    <td className="px-4 py-2.5 text-text">{h.new_value ?? '—'}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{h.edited_by ? names.get(h.edited_by) ?? '—' : '—'}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{new Date(h.edited_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
