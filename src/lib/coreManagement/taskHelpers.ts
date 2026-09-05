import type { Task, TaskPriority, TaskStatus } from './dbTypes'

/** Core Management reads departments from core.departments (the DB table)
 * rather than the hardcoded frontend DEPARTMENTS config, since the tracker
 * covers categories (Orange Tree, Operations, WIP*) that aren't real
 * navigable app departments — labels is built via useDepartments(). Falls
 * back to the raw key if the label hasn't loaded yet or is unrecognized. */
export function departmentLabel(key: string, labels?: Map<string, string>): string {
  return labels?.get(key) ?? key
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  on_hold: 'On hold',
}

export function statusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status]
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  tasklist: 'Tasklist',
  active: 'Active Task',
  delayed: 'Delayed',
  other: 'Other',
}

export function priorityLabel(priority: TaskPriority): string {
  return PRIORITY_LABELS[priority]
}

/** Auto-overdue is deliberately never a stored column — always derived live
 * from current_deadline vs today, per spec. A task with no deadline set at
 * all (real historical data has these) is never overdue — there's nothing
 * to be late against. */
export function isAutoOverdue(task: Task): boolean {
  if (task.status === 'done' || !task.current_deadline) return false
  return task.current_deadline < todayISO()
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

/** Short display date everywhere in Core Management — "26 Aug" style, never
 * ISO. Parsed manually rather than via Date() to avoid timezone-shift bugs
 * with plain YYYY-MM-DD strings (new Date('2026-08-26') is UTC midnight,
 * which can render as the 25th in a negative-offset local timezone). */
export function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const [, month, day] = iso.split('-').map(Number)
  if (!month || !day) return iso
  return `${day} ${SHORT_MONTHS[month - 1]}`
}

export function groupByDepartment(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) {
    const list = groups.get(task.department) ?? []
    list.push(task)
    groups.set(task.department, list)
  }
  return groups
}
