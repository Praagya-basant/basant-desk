import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createTodayPoint, convertPointToTask, fetchTodayPoints } from '../../lib/coreManagement/db'
import { formatShortDate, todayISO } from '../../lib/coreManagement/taskHelpers'
import type { PointSource, TodayPoint } from '../../lib/coreManagement/dbTypes'
import ExportButtons from '../../components/ExportButtons'
import NewTaskModal from './NewTaskModal'

const SOURCE_LABELS: Record<PointSource, string> = { meeting: 'Meeting', verbal: 'Verbal', other: 'Other' }

export default function TodayPoints() {
  const { profile } = useAuth()
  const [points, setPoints] = useState<TodayPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [convertingPoint, setConvertingPoint] = useState<TodayPoint | null>(null)

  // Quick-add form state
  const [pointText, setPointText] = useState('')
  const [source, setSource] = useState<PointSource>('verbal')

  async function load() {
    setLoading(true)
    try {
      setPoints(await fetchTodayPoints())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load points.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () => (dateFilter ? points.filter((p) => p.logged_at === dateFilter) : points),
    [points, dateFilter],
  )

  const exportRows = useMemo(
    () =>
      filtered.map((p) => ({
        date: formatShortDate(p.logged_at),
        source: SOURCE_LABELS[p.source],
        point: p.point_text,
        converted: p.converted_task_id ? 'Yes' : 'No',
      })),
    [filtered],
  )
  const exportColumns = [
    { key: 'date', header: 'Date', width: 12 },
    { key: 'source', header: 'Source', width: 12 },
    { key: 'point', header: 'Point', width: 50 },
    { key: 'converted', header: 'Converted', width: 12 },
  ]

  // Previously this had no try/catch at all — if the insert failed for any
  // reason (RLS, network, etc.) the error vanished into an unhandled
  // promise rejection and the form just sat there with no feedback, which
  // is exactly the "adding a point does not work" symptom. Now any failure
  // surfaces as a visible message instead of failing silently.
  async function handleAdd() {
    if (!profile || !pointText.trim()) return
    setSaving(true)
    setError(null)
    try {
      const point = await createTodayPoint({
        point_text: pointText.trim(),
        source,
        logged_at: todayISO(),
        created_by: profile.id,
      })
      setPoints((prev) => [point, ...prev])
      setPointText('')
      setSource('verbal')
      setShowAdd(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add point.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 cm-no-print">
        <h1 className="text-lg font-medium text-text">Today's Points</h1>
        <div className="flex items-center gap-2">
          <ExportButtons columns={exportColumns} rows={exportRows} filename="todays-points" title="Today's Points" orientation="portrait" />
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover active:bg-accent-hover transition-colors"
          >
            <Plus size={15} strokeWidth={2} />
            Add point
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3 cm-no-print">
          {error}{' '}
          <button onClick={() => setError(null)} className="underline hover:text-red-700 active:text-red-800 transition-colors">
            dismiss
          </button>
        </p>
      )}

      <div className="mb-4 cm-no-print">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none"
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')} className="ml-2 text-sm text-text-secondary hover:text-text">
            Clear
          </button>
        )}
      </div>

      {showAdd && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 cm-no-print">
          <textarea
            autoFocus
            rows={2}
            placeholder="What was said?"
            value={pointText}
            onChange={(e) => setPointText(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as PointSource)}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none"
            >
              <option value="meeting">Meeting</option>
              <option value="verbal">Verbal</option>
              <option value="other">Other</option>
            </select>
            <div className="flex-1" />
            <button onClick={() => setShowAdd(false)} className="text-sm text-text-secondary hover:text-text px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:bg-accent-hover active:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="cm-no-print">
        {loading && points.length === 0 ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-secondary">No points logged.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-accent/10 border-b-2 border-accent/30 text-left text-text">
                  <th className="font-semibold px-3 py-2 text-xs uppercase tracking-wide border-r border-accent/20 w-20">Date</th>
                  <th className="font-semibold px-3 py-2 text-xs uppercase tracking-wide border-r border-accent/20 w-24">Source</th>
                  <th className="font-semibold px-3 py-2 text-xs uppercase tracking-wide border-r border-accent/20">Point</th>
                  <th className="font-semibold px-3 py-2 text-xs uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-text-secondary border-r border-border">{formatShortDate(p.logged_at)}</td>
                    <td className="px-3 py-1.5 text-text-secondary border-r border-border">{SOURCE_LABELS[p.source]}</td>
                    <td className="px-3 py-1.5 text-text border-r border-border">{p.point_text}</td>
                    <td className="px-3 py-1.5 text-right">
                      {p.converted_task_id ? (
                        <span className="text-xs text-success">Converted</span>
                      ) : (
                        <button
                          onClick={() => setConvertingPoint(p)}
                          className="text-xs text-accent hover:text-accent-hover transition-colors"
                        >
                          Convert to Task
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="cm-print-only cm-print-page">
        <h1 className="cm-print-title">Today's Points</h1>
        <table className="cm-print-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th className="cm-print-wide">Point</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{formatShortDate(p.logged_at)}</td>
                <td>{SOURCE_LABELS[p.source]}</td>
                <td className="cm-print-wide">{p.point_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {convertingPoint && (
        <NewTaskModal
          initialDescription={convertingPoint.point_text}
          onCreate={(draft) => convertPointToTask(convertingPoint.id, draft)}
          onClose={() => setConvertingPoint(null)}
          onSaved={(task) => {
            setPoints((prev) => prev.map((p) => (p.id === convertingPoint.id ? { ...p, converted_task_id: task.id } : p)))
            setConvertingPoint(null)
          }}
        />
      )}
    </div>
  )
}
