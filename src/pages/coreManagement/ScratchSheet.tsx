import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createScratchSheet, deleteScratchSheet, fetchScratchSheets, updateScratchSheet } from '../../lib/coreManagement/db'
import type { ScratchSheet as ScratchSheetRow } from '../../lib/coreManagement/dbTypes'
import { cellKey, colLabel, emptyGrid, parseGrid, serializeGrid, type GridData } from '../../lib/coreManagement/grid'
import ExportButtons from '../../components/ExportButtons'

export default function ScratchSheet() {
  const { profile } = useAuth()
  const [sheets, setSheets] = useState<ScratchSheetRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [grid, setGrid] = useState<GridData>(emptyGrid())
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load(selectId?: string) {
    setLoading(true)
    const rows = await fetchScratchSheets()
    setSheets(rows)
    const target = rows.find((s) => s.id === (selectId ?? activeId)) ?? rows[0] ?? null
    if (target) {
      setActiveId(target.id)
      setTitle(target.title)
      setGrid(parseGrid(target.content))
    } else {
      setActiveId(null)
      setTitle('')
      setGrid(emptyGrid())
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openSheet(sheet: ScratchSheetRow) {
    setActiveId(sheet.id)
    setTitle(sheet.title)
    setGrid(parseGrid(sheet.content))
  }

  async function handleNew() {
    if (!profile) return
    const sheet = await createScratchSheet(profile.id)
    load(sheet.id)
  }

  async function handleDelete(sheet: ScratchSheetRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${sheet.title}"? This can't be undone.`)) return
    await deleteScratchSheet(sheet.id)
    if (sheet.id === activeId) setActiveId(null)
    load()
  }

  function startRename(sheet: ScratchSheetRow, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(sheet.id)
    setRenameDraft(sheet.title)
  }

  async function commitRename(sheet: ScratchSheetRow) {
    setRenamingId(null)
    if (renameDraft.trim() && renameDraft !== sheet.title) {
      await updateScratchSheet(sheet.id, { title: renameDraft.trim() })
      if (sheet.id === activeId) setTitle(renameDraft.trim())
      load(sheet.id === activeId ? sheet.id : undefined)
    }
  }

  // Autosaves on every change (title, cell edit, row/col add/remove) —
  // debounced so rapid typing doesn't fire a request per keystroke, matching
  // the "no friction" spreadsheet feel instead of a manual Save button.
  function scheduleSave(nextTitle: string, nextGrid: GridData) {
    if (!activeId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateScratchSheet(activeId, { title: nextTitle, content: serializeGrid(nextGrid) })
    }, 500)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    scheduleSave(value, grid)
  }

  function handleCellChange(r: number, c: number, value: string) {
    setGrid((prev) => {
      const next = { ...prev, cells: { ...prev.cells, [cellKey(r, c)]: value } }
      scheduleSave(title, next)
      return next
    })
  }

  function addRow() {
    setGrid((prev) => {
      const next = { ...prev, rows: prev.rows + 1 }
      scheduleSave(title, next)
      return next
    })
  }

  function removeRow() {
    setGrid((prev) => {
      if (prev.rows <= 1) return prev
      const next = { ...prev, rows: prev.rows - 1 }
      scheduleSave(title, next)
      return next
    })
  }

  function addCol() {
    setGrid((prev) => {
      const next = { ...prev, cols: prev.cols + 1 }
      scheduleSave(title, next)
      return next
    })
  }

  function removeCol() {
    setGrid((prev) => {
      if (prev.cols <= 1) return prev
      const next = { ...prev, cols: prev.cols - 1 }
      scheduleSave(title, next)
      return next
    })
  }

  const exportRows = useMemo(() => {
    const rows: Record<string, unknown>[] = []
    for (let r = 0; r < grid.rows; r++) {
      const row: Record<string, unknown> = {}
      for (let c = 0; c < grid.cols; c++) row[`col${c}`] = grid.cells[cellKey(r, c)] ?? ''
      rows.push(row)
    }
    return rows
  }, [grid])
  const exportColumns = useMemo(
    () => Array.from({ length: grid.cols }, (_, c) => ({ key: `col${c}`, header: colLabel(c) })),
    [grid.cols],
  )

  return (
    <div className="flex gap-6">
      <aside className="w-52 shrink-0 cm-no-print">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Sheets</p>
          <button onClick={handleNew} className="text-text-secondary hover:text-text transition-colors">
            <Plus size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="space-y-0.5">
          {sheets.map((s) =>
            renamingId === s.id ? (
              <input
                key={s.id}
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => commitRename(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(s)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                className="w-full px-3 py-2 rounded-md text-sm text-text bg-bg border border-accent outline-none"
              />
            ) : (
              <div
                key={s.id}
                onClick={() => openSheet(s)}
                onDoubleClick={(e) => startRename(s, e)}
                title="Double-click to rename"
                className={`group w-full flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                  s.id === activeId ? 'bg-surface text-text border border-border' : 'text-text-secondary hover:text-text'
                }`}
              >
                <span className="flex-1 truncate">{s.title}</span>
                <button
                  onClick={(e) => handleDelete(s, e)}
                  title="Delete sheet"
                  className="text-text-muted hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </div>
            ),
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {loading && sheets.length === 0 ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : !activeId ? (
          <p className="text-sm text-text-secondary">No scratch sheets yet — create one to get started.</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3 cm-no-print">
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-lg font-medium text-text bg-transparent outline-none border-b border-transparent focus:border-border transition-colors"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-1">
                  <button onClick={addRow} title="Add row" className="text-text-secondary hover:text-text p-1">
                    <Plus size={13} strokeWidth={2} />
                    <span className="sr-only">Add row</span>
                  </button>
                  <button onClick={removeRow} title="Remove last row" className="text-text-secondary hover:text-text p-1">
                    <Minus size={13} strokeWidth={2} />
                  </button>
                  <span className="text-xs text-text-muted">rows</span>
                  <button onClick={addCol} title="Add column" className="text-text-secondary hover:text-text p-1 ml-2">
                    <Plus size={13} strokeWidth={2} />
                  </button>
                  <button onClick={removeCol} title="Remove last column" className="text-text-secondary hover:text-text p-1">
                    <Minus size={13} strokeWidth={2} />
                  </button>
                  <span className="text-xs text-text-muted">cols</span>
                </div>
                <ExportButtons columns={exportColumns} rows={exportRows} filename="scratch-sheet" title={title} orientation="landscape" />
              </div>
            </div>

            <div className="cm-no-print border border-border rounded-lg overflow-auto">
              <table key={activeId} className="border-collapse text-sm">
                <thead>
                  <tr className="bg-accent/8">
                    <th className="w-8 border-r border-b border-accent/20"></th>
                    {Array.from({ length: grid.cols }, (_, c) => (
                      <th key={c} className="min-w-[110px] px-1 py-1 text-xs font-semibold text-text border-r border-b border-accent/20">
                        {colLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: grid.rows }, (_, r) => (
                    <tr key={r}>
                      <td className="w-8 text-center text-xs text-text-muted border-r border-b border-border bg-surface">{r + 1}</td>
                      {Array.from({ length: grid.cols }, (_, c) => (
                        <td key={c} className="border-r border-b border-border p-0">
                          <input
                            type="text"
                            defaultValue={grid.cells[cellKey(r, c)] ?? ''}
                            onBlur={(e) => handleCellChange(r, c, e.target.value)}
                            className="w-full h-full px-1.5 py-1 text-sm text-text bg-transparent outline-none focus:bg-accent/5 border border-transparent focus:border-accent transition-colors"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cm-print-only cm-print-page">
              <h1 className="cm-print-title">{title}</h1>
              <table className="cm-print-table">
                <tbody>
                  {Array.from({ length: grid.rows }, (_, r) => (
                    <tr key={r}>
                      {Array.from({ length: grid.cols }, (_, c) => (
                        <td key={c}>{grid.cells[cellKey(r, c)] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
