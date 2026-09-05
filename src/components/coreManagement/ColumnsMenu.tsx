import { useState } from 'react'
import { Columns3 } from 'lucide-react'
import { TASK_COLUMNS, type TaskColumnKey } from '../../lib/coreManagement/columns'

export default function ColumnsMenu({
  visible,
  onToggle,
}: {
  visible: Set<TaskColumnKey>
  onToggle: (key: TaskColumnKey) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative cm-no-print">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border text-text text-sm px-3 py-2 hover:bg-surface-2 active:bg-border/60 transition-colors"
      >
        <Columns3 size={14} strokeWidth={1.75} />
        Columns
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-52 rounded-lg border border-border bg-bg shadow-sm z-50 py-1.5">
            {TASK_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={visible.has(col.key)}
                  onChange={() => onToggle(col.key)}
                  className="rounded border-border"
                />
                {col.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
