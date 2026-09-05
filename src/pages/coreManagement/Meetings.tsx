import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createMeeting, fetchMeetings } from '../../lib/coreManagement/db'
import type { Meeting } from '../../lib/coreManagement/dbTypes'
import { formatShortDate, todayISO } from '../../lib/coreManagement/taskHelpers'
import ExportButtons from '../../components/ExportButtons'

/** Scaffold only, per spec: list + create form, no AI extraction, no Notion
 * integration this pass. */
export default function Meetings() {
  const { profile } = useAuth()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [date, setDate] = useState(todayISO())
  const [attendeesText, setAttendeesText] = useState('')
  const [notes, setNotes] = useState('')

  async function load() {
    setLoading(true)
    setMeetings(await fetchMeetings())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    if (!profile) return
    const attendees = attendeesText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
    const meeting = await createMeeting({ meeting_date: date, attendees, notes: notes || null, created_by: profile.id })
    setMeetings((prev) => [meeting, ...prev])
    setDate(todayISO())
    setAttendeesText('')
    setNotes('')
    setShowForm(false)
  }

  const exportRows = useMemo(
    () =>
      meetings.map((m) => ({
        date: formatShortDate(m.meeting_date),
        attendees: m.attendees.join(', '),
        notes: m.notes ?? '',
      })),
    [meetings],
  )
  const columns = [
    { key: 'date', header: 'Date', width: 12 },
    { key: 'attendees', header: 'Attendees', width: 30 },
    { key: 'notes', header: 'Notes', width: 50 },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4 cm-no-print">
        <h1 className="text-lg font-medium text-text">Meetings</h1>
        <div className="flex items-center gap-2">
          <ExportButtons columns={columns} rows={exportRows} filename="meetings" title="Meetings" orientation="portrait" />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover active:bg-accent-hover transition-colors"
          >
            <Plus size={15} strokeWidth={2} />
            Log meeting
          </button>
        </div>
      </div>

      {showForm && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 cm-no-print">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Attendees (comma-separated)</label>
            <input
              value={attendeesText}
              onChange={(e) => setAttendeesText(e.target.value)}
              placeholder="Praagya, Amit, ..."
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Notes</label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm text-text-secondary hover:text-text px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:bg-accent-hover active:bg-accent-hover transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="cm-no-print">
        {loading && meetings.length === 0 ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="text-sm text-text-secondary">No meetings logged yet.</p>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text">{formatShortDate(m.meeting_date)}</p>
                  <p className="text-xs text-text-secondary">{m.attendees.join(', ') || 'No attendees listed'}</p>
                </div>
                {m.notes && <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">{m.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cm-print-only cm-print-page">
        <h1 className="cm-print-title">Meetings</h1>
        {meetings.map((m) => (
          <div key={m.id} className="cm-print-section">
            <h2 className="cm-print-section-title">
              {formatShortDate(m.meeting_date)} — {m.attendees.join(', ') || 'No attendees listed'}
            </h2>
            {m.notes && <p style={{ fontSize: 10, whiteSpace: 'pre-wrap', margin: 0 }}>{m.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
