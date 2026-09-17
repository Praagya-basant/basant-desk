import { departmentLabel, formatShortDate, priorityLabel, statusLabel } from '../../lib/coreManagement/taskHelpers'
import { TASK_COLUMNS, columnWidthPercents, type TaskColumnKey } from '../../lib/coreManagement/columns'
import type { Task } from '../../lib/coreManagement/dbTypes'

/** Read-only print/PDF-equivalent rendering — deliberately not the same
 * component as the interactive TaskTable (which is full of <input>/<select>
 * elements that print badly). Styled to resemble the old sheet's actual
 * printed page: thin borders, tight rows, plain text. Used inside a
 * .cm-print-only region so it never shows on screen, only under @media print
 * (and is what html2canvas/jsPDF-equivalent PDF export mirrors). Column
 * widths come from the same columnWidthPercents() weights TaskTable uses on
 * screen, so print never drifts out of sync with what's visible in-app. */
export default function PrintTable({
  title,
  tasks,
  names,
  deptLabels,
  visibleColumns,
  grouped,
  bare = false,
}: {
  title?: string
  tasks: Task[]
  names: Map<string, string>
  deptLabels: Map<string, string>
  visibleColumns: Set<TaskColumnKey>
  grouped?: boolean
  /** Skip the outer .cm-print-page/title wrapper — for embedding inside a
   * caller-managed print layout (e.g. Delayed's two labeled sections). */
  bare?: boolean
}) {
  const columns = TASK_COLUMNS.filter((c) => visibleColumns.has(c.key))
  const widths = columnWidthPercents(columns)

  function cellValue(task: Task, key: TaskColumnKey): string {
    switch (key) {
      case 'task_number':
        return task.task_number
      case 'department':
        return departmentLabel(task.department, deptLabels)
      case 'task_description':
        return task.task_description
      case 'responsible':
        return names.get(task.responsible_user_id) ?? '—'
      case 'added_at':
        return formatShortDate(task.added_at.slice(0, 10))
      case 'initial_deadline':
        return task.initial_deadline ? formatShortDate(task.initial_deadline) : ''
      case 'current_deadline':
        return task.current_deadline ? formatShortDate(task.current_deadline) : ''
      case 'official_remarks':
        return task.official_remarks ?? ''
      case 'status':
        return statusLabel(task.status)
      case 'priority':
        return priorityLabel(task.priority)
    }
  }

  function TableBody({ rows, startIndex }: { rows: Task[]; startIndex: number }) {
    return (
      <table className="cm-print-table">
        <colgroup>
          <col style={{ width: `${widths.serial}%` }} />
          {columns.map((c, i) => (
            <col key={c.key} style={{ width: `${widths.cols[i]}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="cm-print-serial">#</th>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'cm-print-right' : c.align === 'center' ? 'cm-print-center' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.id}>
              <td className="cm-print-serial">{startIndex + i + 1}</td>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'cm-print-right' : c.align === 'center' ? 'cm-print-center' : ''}>
                  {cellValue(t, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (!grouped) {
    const body = <TableBody rows={tasks} startIndex={0} />
    if (bare) return body
    return (
      <div className="cm-print-page">
        <h1 className="cm-print-title">{title}</h1>
        {body}
      </div>
    )
  }

  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const list = groups.get(t.department) ?? []
    list.push(t)
    groups.set(t.department, list)
  }

  let offset = 0
  const sections = Array.from(groups.entries()).map(([dept, rows]) => {
    const start = offset
    offset += rows.length
    return (
      <div key={dept} className="cm-print-section">
        <h2 className="cm-print-section-title">{departmentLabel(dept, deptLabels)}</h2>
        <TableBody rows={rows} startIndex={start} />
      </div>
    )
  })

  if (bare) return <>{sections}</>
  return (
    <div className="cm-print-page">
      <h1 className="cm-print-title">{title}</h1>
      {sections}
    </div>
  )
}
