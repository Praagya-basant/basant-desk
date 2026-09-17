import { useMemo, useState, type ReactNode } from 'react'
import { useWoodMeasurements } from '../../hooks/useWoodMeasurements'
import { getTodayLocalISO } from '../../lib/yaamya/db'
import { exportToExcel } from '../../lib/yaamya/exportToExcel'
import { LOCATIONS, QUALITIES, WOOD_CONDITIONS, WOOD_TYPES } from '../../lib/yaamya/dbTypes'
import type { WoodMeasurement } from '../../lib/yaamya/dbTypes'

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors'

function sumCft(rows: WoodMeasurement[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.total_cft) || 0), 0)
}

function formatCft(value: number): string {
  return `${value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} Cft`
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b))
}

interface Filters {
  dateFrom: string
  dateTo: string
  supplier: string
  woodType: string
  location: string
  woodCondition: string
  quality: string
}

function emptyFilters(): Filters {
  return { dateFrom: '', dateTo: '', supplier: '', woodType: '', location: '', woodCondition: '', quality: '' }
}

function StatTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${accent ? 'text-accent' : 'text-text'}`}>{value}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-text-secondary">{children}</h2>
}

const DETAIL_COLUMNS = [
  'Date',
  'Time',
  'Bill No',
  'Location',
  'Wood Type',
  'Condition',
  'Source',
  'Supplier',
  'Batch Code',
  'Checker',
  'Height (in)',
  'Length (ft)',
  'Width (in)',
  'Pieces',
  'Cft',
  'Quality',
]

export default function InwardLog() {
  const { entries, loading, error, reload } = useWoodMeasurements()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const today = getTodayLocalISO()

  function updateFilter(field: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  // Today's stat cards are always "today", independent of the filters below
  // (which default to full history).
  const todayEntries = useMemo(() => entries.filter((e) => e.entry_date === today), [entries, today])
  const todayStats = useMemo(() => {
    const goodCft = sumCft(todayEntries.filter((e) => e.quality === 'Good'))
    const badCft = sumCft(todayEntries.filter((e) => e.quality === 'Bad'))
    return { totalCft: goodCft + badCft, goodCft, badCft, pieces: todayEntries.length }
  }, [todayEntries])

  const supplierOptions = useMemo(() => uniqueSorted(entries.map((e) => e.supplier_name)), [entries])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.dateFrom && e.entry_date < filters.dateFrom) return false
      if (filters.dateTo && e.entry_date > filters.dateTo) return false
      if (filters.supplier && e.supplier_name !== filters.supplier) return false
      if (filters.woodType && e.wood_type !== filters.woodType) return false
      if (filters.location && e.location !== filters.location) return false
      if (filters.woodCondition && e.wood_condition !== filters.woodCondition) return false
      if (filters.quality && e.quality !== filters.quality) return false
      return true
    })
  }, [entries, filters])

  const billSummary = useMemo(() => {
    const map = new Map<
      string,
      { billNo: string; supplier: string | null; goodCft: number; badCft: number; pieces: number }
    >()
    for (const e of filtered) {
      const key = e.bill_no || 'Unknown'
      if (!map.has(key)) {
        map.set(key, { billNo: key, supplier: e.supplier_name, goodCft: 0, badCft: 0, pieces: 0 })
      }
      const agg = map.get(key)!
      if (e.quality === 'Good') agg.goodCft += Number(e.total_cft) || 0
      else agg.badCft += Number(e.total_cft) || 0
      agg.pieces += 1
    }
    return [...map.values()].sort((a, b) => a.billNo.localeCompare(b.billNo))
  }, [filtered])

  const supplierSummary = useMemo(() => {
    const map = new Map<string, { supplier: string; totalCft: number; pieces: number }>()
    for (const e of filtered) {
      const key = e.supplier_name || e.source || 'Unknown'
      if (!map.has(key)) map.set(key, { supplier: key, totalCft: 0, pieces: 0 })
      const agg = map.get(key)!
      agg.totalCft += Number(e.total_cft) || 0
      agg.pieces += 1
    }
    return [...map.values()].sort((a, b) => b.totalCft - a.totalCft)
  }, [filtered])

  const detailRows = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const billCompare = (a.bill_no || '').localeCompare(b.bill_no || '')
      if (billCompare !== 0) return billCompare
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filtered])

  function handleExport() {
    exportToExcel(
      detailRows.map((e) => ({
        Date: e.entry_date,
        Time: e.entry_time,
        'Bill No': e.bill_no ?? '',
        Location: e.location,
        'Wood Type': e.wood_type,
        Condition: e.wood_condition,
        Source: e.source ?? '',
        Supplier: e.supplier_name ?? '',
        'Batch Code': e.batch_code ?? '',
        Checker: e.checker_name ?? '',
        'Height (in)': e.height_inches ?? '',
        'Length (ft)': e.length_ft,
        'Width (in)': e.width_inches,
        Pieces: e.pieces,
        Cft: Number(e.total_cft),
        Quality: e.quality,
      })),
      `inward-log-${filters.dateFrom || 'all'}-to-${filters.dateTo || 'all'}.xlsx`,
      'Inward Log',
    )
  }

  const hasActiveFilters = Object.values(filters).some(Boolean)

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-text">Inward Log</h1>
          <p className="text-sm text-text-secondary">Full wood receiving history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border border-border px-3 py-2 text-sm text-text transition-colors hover:bg-surface-2"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Export to Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Today Total Cft" value={formatCft(todayStats.totalCft)} accent />
        <StatTile label="Today Good Cft" value={formatCft(todayStats.goodCft)} />
        <StatTile label="Today Bad Cft" value={formatCft(todayStats.badCft)} />
        <StatTile label="Today Pieces" value={todayStats.pieces.toLocaleString('en-IN')} />
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Filters</SectionLabel>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters())}
              className="text-xs font-medium text-text-secondary underline underline-offset-2 hover:text-text"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className={inputClass}
            aria-label="From date"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className={inputClass}
            aria-label="To date"
          />
          <select
            value={filters.supplier}
            onChange={(e) => updateFilter('supplier', e.target.value)}
            className={inputClass}
          >
            <option value="">All Suppliers</option>
            {supplierOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filters.woodType}
            onChange={(e) => updateFilter('woodType', e.target.value)}
            className={inputClass}
          >
            <option value="">All Wood Types</option>
            {WOOD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filters.location}
            onChange={(e) => updateFilter('location', e.target.value)}
            className={inputClass}
          >
            <option value="">All Locations</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={filters.woodCondition}
            onChange={(e) => updateFilter('woodCondition', e.target.value)}
            className={inputClass}
          >
            <option value="">All Conditions</option>
            {WOOD_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filters.quality}
            onChange={(e) => updateFilter('quality', e.target.value)}
            className={inputClass}
          >
            <option value="">All Quality</option>
            {QUALITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="mb-8">
        <SectionLabel>Bill-wise summary</SectionLabel>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : billSummary.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
            No entries match these filters
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2">Bill No</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2 text-right">Good Cft</th>
                  <th className="px-3 py-2 text-right">Bad Cft</th>
                  <th className="px-3 py-2 text-right">Total Cft</th>
                  <th className="px-3 py-2 text-right">Pieces</th>
                </tr>
              </thead>
              <tbody>
                {billSummary.map((b) => (
                  <tr key={b.billNo} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-text">{b.billNo}</td>
                    <td className="px-3 py-2">{b.supplier ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.goodCft.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.badCft.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-text">
                      {(b.goodCft + b.badCft).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.pieces}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionLabel>Supplier-wise totals</SectionLabel>
        {!loading && supplierSummary.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2 text-right">Total Cft</th>
                  <th className="px-3 py-2 text-right">Pieces</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummary.map((s) => (
                  <tr key={s.supplier} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-text">{s.supplier}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.totalCft.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.pieces}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionLabel>All entries</SectionLabel>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : detailRows.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
            No entries match these filters
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[1400px] text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {DETAIL_COLUMNS.map((c) => (
                    <th
                      key={c}
                      className={`px-3 py-2 ${
                        ['Height (in)', 'Length (ft)', 'Width (in)', 'Pieces', 'Cft'].includes(c) ? 'text-right' : ''
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailRows.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">{e.entry_date}</td>
                    <td className="px-3 py-2">{e.entry_time}</td>
                    <td className="px-3 py-2">{e.bill_no ?? '—'}</td>
                    <td className="px-3 py-2">{e.location}</td>
                    <td className="px-3 py-2">{e.wood_type}</td>
                    <td className="px-3 py-2">{e.wood_condition}</td>
                    <td className="px-3 py-2">{e.source ?? '—'}</td>
                    <td className="px-3 py-2">{e.supplier_name ?? '—'}</td>
                    <td className="px-3 py-2">{e.batch_code ?? '—'}</td>
                    <td className="px-3 py-2">{e.checker_name ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.height_inches ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.length_ft}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.width_inches}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.pieces}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-text">
                      {Number(e.total_cft).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      {e.quality === 'Bad' ? (
                        <span className="border-l-[3px] border-red-500 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          Bad
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary">Good</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
