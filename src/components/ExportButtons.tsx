import { useState } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import { exportToExcel, exportToPDF, printCurrentView, type ExportColumn, type PrintOrientation } from '../lib/coreManagement/exportUtils'
import PrintOptionsDialog, { type PrintScope } from './coreManagement/PrintOptionsDialog'
import type { Task } from '../lib/coreManagement/dbTypes'
import type { TaskColumnKey } from '../lib/coreManagement/columns'

export default function ExportButtons({
  columns,
  rows,
  filename,
  title,
  orientation = 'landscape',
  printSource,
}: {
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
  filename: string
  title: string
  orientation?: PrintOrientation
  /** Backs the Print button's options dialog (orientation + scope) — a
   * separate, richer data source than `rows` above (which PDF/Excel still
   * export directly, one click, no dialog) because scoping needs the real
   * Task objects and lookup maps to filter by department/person/delayed,
   * not the already-flattened export rows. Optional: the non-task-table
   * views (Meetings, Today's Points, Scratch Sheet) have nothing to scope
   * by department/person, so they keep the old one-click print behavior —
   * only the task-table views (Active/All/Delayed) pass this. */
  printSource?: {
    tasks: Task[]
    departments: { key: string; label: string }[]
    users: { id: string; label: string }[]
    deptLabels: Map<string, string>
    names: Map<string, string>
    visibleColumns: Set<TaskColumnKey>
    scopeOptions?: PrintScope[]
  }
}) {
  const [printOpen, setPrintOpen] = useState(false)

  const btnClass =
    'flex items-center gap-1.5 rounded-md border border-border text-text text-sm px-3 py-2 hover:bg-surface-2 active:bg-border/60 transition-colors'

  return (
    <div className="flex items-center gap-1.5 cm-no-print">
      <button
        onClick={() => (printSource ? setPrintOpen(true) : printCurrentView(orientation))}
        className={btnClass}
      >
        <Printer size={14} strokeWidth={1.75} />
        Print
      </button>
      <button onClick={() => exportToPDF(columns, rows, filename, title, orientation)} className={btnClass}>
        <FileText size={14} strokeWidth={1.75} />
        PDF
      </button>
      <button
        onClick={() => {
          exportToExcel(columns, rows, filename).catch((err) => console.error('Excel export failed:', err))
        }}
        className={btnClass}
      >
        <Download size={14} strokeWidth={1.75} />
        Excel
      </button>

      {printSource && (
        <PrintOptionsDialog
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          title={title}
          defaultOrientation={orientation}
          {...printSource}
        />
      )}
    </div>
  )
}
