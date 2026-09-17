import { useMemo } from 'react'
import { useWoodMeasurements } from '../../hooks/useWoodMeasurements'
import { getTodayLocalISO } from '../../lib/yaamya/db'
import type { WoodMeasurement } from '../../lib/yaamya/dbTypes'

function sumCft(rows: WoodMeasurement[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.total_cft) || 0), 0)
}

function StatTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${accent ? 'text-accent' : 'text-text'}`}>
        {value}
      </p>
    </div>
  )
}

export default function TodayLog() {
  const { entries, loading, error } = useWoodMeasurements()
  const today = getTodayLocalISO()

  const todayEntries = useMemo(() => entries.filter((e) => e.entry_date === today), [entries, today])

  const stats = useMemo(() => {
    const goodCft = sumCft(todayEntries.filter((e) => e.quality === 'Good'))
    const badCft = sumCft(todayEntries.filter((e) => e.quality === 'Bad'))
    return { goodCft, badCft, totalCft: goodCft + badCft, pieces: todayEntries.length }
  }, [todayEntries])

  const billSummary = useMemo(() => {
    const map = new Map<string, { billNo: string; pieces: number; goodCft: number; badCft: number }>()
    for (const e of todayEntries) {
      const key = e.bill_no || 'Unknown'
      if (!map.has(key)) map.set(key, { billNo: key, pieces: 0, goodCft: 0, badCft: 0 })
      const agg = map.get(key)!
      agg.pieces += Number(e.pieces) || 0
      if (e.quality === 'Good') agg.goodCft += Number(e.total_cft) || 0
      else agg.badCft += Number(e.total_cft) || 0
    }
    return [...map.values()].sort((a, b) => a.billNo.localeCompare(b.billNo))
  }, [todayEntries])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Total Cft" value={stats.totalCft.toFixed(2)} accent />
        <StatTile label="Pieces" value={stats.pieces.toLocaleString('en-IN')} />
        <StatTile label="Good Cft" value={stats.goodCft.toFixed(2)} />
        <StatTile label="Bad Cft" value={stats.badCft.toFixed(2)} />
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Bill-wise summary — today
        </h2>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : billSummary.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
            No entries yet today
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2">Bill No</th>
                  <th className="px-3 py-2 text-right">Pieces</th>
                  <th className="px-3 py-2 text-right">Total Cft</th>
                  <th className="px-3 py-2 text-right">Good Cft</th>
                  <th className="px-3 py-2 text-right">Bad Cft</th>
                </tr>
              </thead>
              <tbody>
                {billSummary.map((b) => (
                  <tr key={b.billNo} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-text">{b.billNo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.pieces}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(b.goodCft + b.badCft).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.goodCft.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.badCft.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  )
}
