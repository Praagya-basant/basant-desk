import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchExtractionRows, fetchExtractions, fetchUserNames } from '../../lib/purchase/db'
import type { HCExtraction, HCExtractionRow } from '../../lib/purchase/dbTypes'
import type { HCRow } from '../../lib/purchase/extractHCRows'
import ExtractionPreviewTable from '../../components/purchase/ExtractionPreviewTable'
import SummaryStrip from '../../components/purchase/SummaryStrip'

type Tab = 'summary' | 'detailed'

function toHCRow(row: HCExtractionRow): HCRow {
  return {
    code: row.code ?? '',
    l: row.l ?? NaN,
    w: row.w ?? NaN,
    thicknessMm: row.thickness_mm,
    cell: row.cell,
    sheetQty: row.sheet_qty,
    rate: row.rate,
    defaultedCell: row.defaulted_cell,
    sourceDescription: '',
  }
}

function DetailedLog({ extractions, names }: { extractions: HCExtraction[]; names: Map<string, string> }) {
  const [selectedId, setSelectedId] = useState(extractions[0]?.id ?? '')
  const [rows, setRows] = useState<HCExtractionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchExtractionRows(selectedId)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    // Ignore this request's result if selectedId changes again before it
    // resolves — otherwise an out-of-order response can overwrite newer data.
    return () => {
      cancelled = true
    }
  }, [selectedId])

  if (extractions.length === 0) {
    return <p className="text-sm text-text-secondary">No extractions yet.</p>
  }

  const selected = extractions.find((e) => e.id === selectedId)

  return (
    <div>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-secondary transition-colors mb-4"
      >
        {extractions.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {new Date(ex.created_at).toLocaleString()} · {ex.created_by ? names.get(ex.created_by) ?? 'Unknown' : 'Unknown'} ·{' '}
            {ex.source_type} · {ex.supplier}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : selected ? (
        <div>
          <SummaryStrip
            rowCount={rows.length}
            totalRate={selected.total_rate}
            flaggedCount={rows.filter((r) => r.flagged).length}
            supplier={selected.supplier}
          />
          <ExtractionPreviewTable rows={rows.map(toHCRow)} editable={false} />
        </div>
      ) : null}
    </div>
  )
}

export default function HCExtractionHistory() {
  const [tab, setTab] = useState<Tab>('summary')
  const [extractions, setExtractions] = useState<HCExtraction[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchExtractions()
      .then(async (rows) => {
        setExtractions(rows)
        setNames(await fetchUserNames(rows.map((r) => r.created_by).filter((id): id is string => !!id)))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-medium text-text mb-1">HC Extraction History</h1>
      <p className="text-sm text-text-secondary mb-6">Past extractions, most recent first.</p>

      <div className="flex gap-1 mb-4 border border-border rounded-md p-1 w-fit bg-surface">
        <button
          onClick={() => setTab('summary')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            tab === 'summary' ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setTab('detailed')}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            tab === 'detailed' ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
          }`}
        >
          Detailed Log
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : tab === 'summary' ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left text-text-secondary">
                <th className="font-medium px-4 py-2.5">Date</th>
                <th className="font-medium px-4 py-2.5">Created by</th>
                <th className="font-medium px-4 py-2.5">Source</th>
                <th className="font-medium px-4 py-2.5">Supplier</th>
                <th className="font-medium px-4 py-2.5 text-center">Rows</th>
                <th className="font-medium px-4 py-2.5 text-right">Total rate</th>
                <th className="font-medium px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {extractions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">
                    No extractions yet.
                  </td>
                </tr>
              ) : (
                extractions.map((ex) => (
                  <tr key={ex.id} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                    <td className="px-4 py-2.5 text-text">
                      <Link to={`/purchase/honeycomb/history/${ex.id}`} className="block">
                        {new Date(ex.created_at).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {ex.created_by ? names.get(ex.created_by) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary capitalize">{ex.source_type}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{ex.supplier}</td>
                    <td className="px-4 py-2.5 text-center text-text">{ex.row_count}</td>
                    <td className="px-4 py-2.5 text-right text-text tabular-nums">{ex.total_rate.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-text-secondary capitalize">{ex.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <DetailedLog extractions={extractions} names={names} />
      )}
    </div>
  )
}
