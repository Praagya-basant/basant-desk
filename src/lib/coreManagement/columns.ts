export type TaskColumnKey =
  | 'task_number'
  | 'department'
  | 'task_description'
  | 'responsible'
  | 'added_at'
  | 'initial_deadline'
  | 'current_deadline'
  | 'official_remarks'
  | 'status'
  | 'priority'

export interface TaskColumnDef {
  key: TaskColumnKey
  label: string
  align?: 'right' | 'center'
  /** Relative width weight — the single source of truth every rendering
   * (on-screen table, print, PDF, Excel) derives its actual width from, so
   * they can never drift out of sync with each other. Sized to fit each
   * column's real header label *and* typical content, not a binary
   * wide/compact flag — that's what caused "1ST DEADLINE" to wrap
   * mid-word: a two-word header needs real room even though its data
   * ("26 Aug") is short. */
  weight: number
}

/** Every column a task table can show. The leading row-serial number is not
 * in this list — it's always shown, never toggled, not a real field. */
export const TASK_COLUMNS: TaskColumnDef[] = [
  { key: 'task_number', label: 'Task #', weight: 3 },
  { key: 'department', label: 'Department', weight: 6 },
  { key: 'task_description', label: 'Task', weight: 16 },
  // Responsible and 1st Deadline both cut to ~75% of their pass-4 weight
  // (6 -> 4.5, 5 -> 3.75) — both were wider than their actual content needs.
  { key: 'responsible', label: 'Responsible', weight: 4.5 },
  { key: 'added_at', label: 'Added', align: 'right', weight: 3.5 },
  { key: 'initial_deadline', label: '1st Deadline', align: 'right', weight: 3.75 },
  { key: 'current_deadline', label: 'Deadline', align: 'right', weight: 4 },
  { key: 'official_remarks', label: 'Remarks', weight: 16 },
  { key: 'status', label: 'Status', align: 'center', weight: 4.5 },
  { key: 'priority', label: 'Priority', align: 'center', weight: 4.5 },
]

/** One shared default per view, governing both the on-screen table and
 * Print/PDF/Excel output — matches the old sheet's actual printed columns
 * exactly (serial# is always shown, not a toggle). Adjustable via the
 * Columns control; turning a column on shows it everywhere at once, so
 * Print never surprises anyone with a different layout than what's on
 * screen. */
export const DEFAULT_VISIBLE_COLUMNS: TaskColumnKey[] = [
  'task_description',
  'responsible',
  'initial_deadline',
  'current_deadline',
  'official_remarks',
]

const SERIAL_WEIGHT = 2
const ICON_COL_WEIGHT = 2.6 // the action column (delete + hide), on screen only

/** Percentage widths for a set of visible columns (+ serial, + optional
 * icon column), all summing to 100 — used for print <colgroup> and, scaled,
 * the on-screen table's own <colgroup> so column widths are identical
 * between the two and never jump when a cell switches between display and
 * edit mode (the actual cause of item 6's layout-shift bug: without a fixed
 * <colgroup>, a browser resizes the whole column to fit whichever cell is
 * currently widest). */
export function columnWidthPercents(
  columns: TaskColumnDef[],
  opts: { includeIconCol?: boolean } = {},
): { serial: number; icon: number; cols: number[] } {
  const total = SERIAL_WEIGHT + (opts.includeIconCol ? ICON_COL_WEIGHT : 0) + columns.reduce((s, c) => s + c.weight, 0)
  return {
    serial: (SERIAL_WEIGHT / total) * 100,
    icon: opts.includeIconCol ? (ICON_COL_WEIGHT / total) * 100 : 0,
    cols: columns.map((c) => (c.weight / total) * 100),
  }
}

/** Excel column width in characters — roughly weight * 3.2, tuned so a
 * weight-6 column (e.g. Department/Responsible) lands close to 19
 * characters, comfortably fitting both the header and typical content. */
export function excelWidth(weight: number): number {
  return Math.round(weight * 3.2)
}

/** jsPDF-autotable cellWidth in points — roughly weight * 5.5 at the sizes
 * these exports render at (A4, 8pt body font). */
export function pdfCellWidth(weight: number): number {
  return Math.round(weight * 5.5)
}
