import { useState } from 'react'
import { X } from 'lucide-react'
import PrintTable from './PrintTable'
import { printCurrentView, type PrintOrientation } from '../../lib/coreManagement/exportUtils'
import { isAutoOverdue } from '../../lib/coreManagement/taskHelpers'
import type { Task } from '../../lib/coreManagement/dbTypes'
import type { TaskColumnKey } from '../../lib/coreManagement/columns'

export type PrintScope = 'current' | 'department' | 'person' | 'delayed'

const SCOPE_LABELS: Record<PrintScope, string> = {
  current: 'Current view',
  department: 'A specific department',
  person: "An individual's tasks",
  delayed: 'Delayed tasks only',
}

/** A real print-options dialog, appearing before the browser's own print
 * dialog — orientation choice plus a Google-Sheets-style scope (current
 * view / one department / one person / delayed only), rather than the
 * previous fixed-landscape, whatever's-on-screen-right-now behavior. Owns
 * its own .cm-print-only region (a PrintTable bound to whatever's currently
 * scoped) so the calling page no longer needs one of its own — there must
 * only ever be one .cm-print-only region active at a time, or both would
 * print. Ad-hoc row/column custom selection (the other example in the
 * original ask) is intentionally not built this pass — department/person/
 * delayed scoping covers the practical cases; a full custom multi-select
 * is a larger, separate feature. */
export default function PrintOptionsDialog({
  open,
  onClose,
  tasks,
  departments,
  users,
  deptLabels,
  names,
  visibleColumns,
  title,
  scopeOptions = ['current', 'department', 'person', 'delayed'],
  defaultOrientation = 'landscape',
}: {
  open: boolean
  onClose: () => void
  tasks: Task[]
  departments: { key: string; label: string }[]
  users: { id: string; label: string }[]
  deptLabels: Map<string, string>
  names: Map<string, string>
  visibleColumns: Set<TaskColumnKey>
  title: string
  scopeOptions?: PrintScope[]
  defaultOrientation?: PrintOrientation
}) {
  const [orientation, setOrientation] = useState<PrintOrientation>(defaultOrientation)
  const [scope, setScope] = useState<PrintScope>('current')
  const [deptKey, setDeptKey] = useState(departments[0]?.key ?? '')
  const [personId, setPersonId] = useState(users[0]?.id ?? '')

  if (!open) return null

  const scoped =
    scope === 'department'
      ? tasks.filter((t) => t.department === deptKey)
      : scope === 'person'
        ? tasks.filter((t) => t.responsible_user_id === personId)
        : scope === 'delayed'
          ? tasks.filter((t) => isAutoOverdue(t) || t.priority === 'delayed')
          : tasks

  function handlePrint() {
    printCurrentView(orientation)
    onClose()
  }

  const toggleBtn = (active: boolean) =>
    `flex-1 px-3 py-1.5 text-sm transition-colors ${active ? 'bg-text text-bg' : 'text-text-secondary hover:bg-surface-2 active:bg-border/60'}`

  const selectClass =
    'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none hover:bg-surface-2 focus:border-accent transition-colors cursor-pointer'

  return (
    <>
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4 cm-no-print" onClick={onClose}>
        <div className="w-full max-w-sm bg-bg border border-border rounded-lg shadow-sm" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium text-text">Print options</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text hover:bg-surface-2 active:bg-border/60 rounded p-0.5 transition-colors"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Orientation</label>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button onClick={() => setOrientation('portrait')} className={toggleBtn(orientation === 'portrait')}>
                  Portrait
                </button>
                <button onClick={() => setOrientation('landscape')} className={toggleBtn(orientation === 'landscape')}>
                  Landscape
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">What to print</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as PrintScope)} className={selectClass}>
                {scopeOptions.map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {scope === 'department' && (
              <select value={deptKey} onChange={(e) => setDeptKey(e.target.value)} className={selectClass}>
                {departments.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}

            {scope === 'person' && (
              <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={selectClass}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            )}

            <p className="text-xs text-text-secondary">
              {scoped.length} task{scoped.length === 1 ? '' : 's'} will print.
            </p>

            <button
              onClick={handlePrint}
              className="w-full rounded-md bg-accent text-white text-sm font-medium py-2 hover:bg-accent-hover active:bg-accent-hover transition-colors"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="cm-print-only">
        <PrintTable title={title} tasks={scoped} names={names} deptLabels={deptLabels} visibleColumns={visibleColumns} grouped />
      </div>
    </>
  )
}
