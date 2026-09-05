import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { createTask } from '../../lib/coreManagement/db'
import type { TaskPriority } from '../../lib/coreManagement/dbTypes'

interface ExtractedTask {
  task_description: string
  department_guess: string | null
  responsible_name_guess: string | null
  deadline_iso: string | null
}

interface DraftTask extends ExtractedTask {
  department: string
  responsibleUserId: string
}

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [, data] = result.split(',')
      resolve({ data, mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** v1: general-purpose extraction, not tuned to any one person's shorthand —
 * see docs/core-management.md for the explicit v1/v2 scope split. Never
 * auto-saves — every extracted task lands here as an editable draft first. */
export default function AIExtractModal({
  onClose,
  onSaved,
  departments,
  users,
}: {
  onClose: () => void
  onSaved: () => void
  departments: { key: string; label: string }[]
  users: { id: string; label: string }[]
}) {
  const { profile } = useAuth()
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [drafts, setDrafts] = useState<DraftTask[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function matchDepartment(guess: string | null): string {
    if (!guess) return departments[0]?.key ?? ''
    const byKey = departments.find((d) => d.key.toLowerCase() === guess.toLowerCase())
    if (byKey) return byKey.key
    const byLabel = departments.find((d) => d.label.toLowerCase() === guess.toLowerCase())
    return byLabel?.key ?? departments[0]?.key ?? ''
  }

  function matchUser(guess: string | null): string {
    if (!guess) return users[0]?.id ?? ''
    const exact = users.find((u) => u.label.toLowerCase() === guess.toLowerCase())
    if (exact) return exact.id
    const contains = users.find((u) => u.label.toLowerCase().includes(guess.toLowerCase()))
    return contains?.id ?? users[0]?.id ?? ''
  }

  async function handleExtract() {
    setExtracting(true)
    setError(null)
    try {
      const body: { text?: string; imageBase64?: string; mediaType?: string } = {}
      if (text.trim()) body.text = text.trim()
      if (imageFile) {
        const { data, mediaType } = await fileToBase64(imageFile)
        body.imageBase64 = data
        body.mediaType = mediaType
      }

      const { data, error: invokeError } = await supabase.functions.invoke('core-management-ai-extract', { body })
      if (invokeError) throw invokeError
      if (!data?.success) throw new Error(data?.error ?? 'Extraction failed')

      const extracted = (data.tasks as ExtractedTask[]) ?? []
      if (extracted.length === 0) {
        setError('No tasks found in that input.')
        setExtracting(false)
        return
      }

      setDrafts(
        extracted.map((t) => ({
          ...t,
          department: matchDepartment(t.department_guess),
          responsibleUserId: matchUser(t.responsible_name_guess),
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed.')
    } finally {
      setExtracting(false)
    }
  }

  function updateDraft(index: number, changes: Partial<DraftTask>) {
    setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? { ...d, ...changes } : d)) : prev))
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev))
  }

  async function handleSaveAll() {
    if (!profile || !drafts) return
    setSaving(true)
    setError(null)
    try {
      for (const d of drafts) {
        if (!d.task_description.trim() || !d.responsibleUserId) continue
        await createTask({
          priority: 'active' as TaskPriority,
          department: d.department,
          task_description: d.task_description.trim(),
          responsible_user_id: d.responsibleUserId,
          current_deadline: d.deadline_iso ?? '',
          created_by: profile.id,
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tasks.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-lg bg-bg border border-border rounded-lg shadow-sm max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-medium text-text flex items-center gap-1.5">
            <Sparkles size={15} strokeWidth={1.75} className="text-accent" />
            Add via AI
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {drafts === null ? (
            <>
              <p className="text-xs text-text-secondary">
                Paste a WhatsApp message or upload a screenshot. Nothing saves until you review and confirm below.
              </p>
              <textarea
                rows={5}
                placeholder="Paste text here…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
              />
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Or upload a screenshot</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-text"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={handleExtract}
                disabled={extracting || (!text.trim() && !imageFile)}
                className="w-full rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover active:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {extracting ? 'Extracting…' : 'Extract tasks'}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-text-secondary">
                Review and edit before saving — nothing here is saved automatically.
              </p>
              {drafts.map((d, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <textarea
                      rows={2}
                      value={d.task_description}
                      onChange={(e) => updateDraft(i, { task_description: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent transition-colors resize-none"
                    />
                    <button onClick={() => removeDraft(i)} className="text-text-muted hover:text-red-600 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={d.department}
                      onChange={(e) => updateDraft(i, { department: e.target.value })}
                      className="rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none"
                    >
                      {departments.map((dep) => (
                        <option key={dep.key} value={dep.key}>
                          {dep.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={d.responsibleUserId}
                      onChange={(e) => updateDraft(i, { responsibleUserId: e.target.value })}
                      className="rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={d.deadline_iso ?? ''}
                      onChange={(e) => updateDraft(i, { deadline_iso: e.target.value || null })}
                      className="col-span-2 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none"
                    />
                  </div>
                </div>
              ))}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setDrafts(null)}
                  className="flex-1 rounded-md border border-border text-text text-sm font-medium py-2 hover:bg-surface-2 active:bg-border/60 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving || drafts.length === 0}
                  className="flex-1 rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover active:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : `Save ${drafts.length} task${drafts.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
