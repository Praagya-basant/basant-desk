import { supabase } from '../supabase'
import type {
  CoreManagementNotification,
  Meeting,
  ScratchSheet,
  StaffOwnTask,
  Task,
  TaskRemark,
  TodayPoint,
} from './dbTypes'

const cm = () => supabase.schema('core_management')

// ---------------------------------------------------------------------------
// Departments — read from core.departments (the DB table), not the hardcoded
// frontend DEPARTMENTS config, since the tracker covers categories (Orange
// Tree, Operations, WIP*) that aren't real navigable app departments.
// ---------------------------------------------------------------------------

export async function fetchDepartments(): Promise<{ key: string; label: string }[]> {
  const { data, error } = await supabase.from('departments').select('key, label').order('sort_order')
  if (error) throw error
  return data as { key: string; label: string }[]
}

// ---------------------------------------------------------------------------
// Admin surface — tasks
// ---------------------------------------------------------------------------

/** Never returns soft-deleted rows — those only ever surface in
 * fetchDeletedTasks(), the Deleted Tasks view's own query.
 *
 * Filters is_deleted client-side rather than with `.eq('is_deleted', false)`
 * at the query level deliberately: PostgREST 400s an entire query (error
 * 42703, "column does not exist") the instant a filter or order references
 * a column the live table doesn't have yet, and the pass-6 migration that
 * adds is_deleted hasn't been run (still blocked on Supabase access — see
 * docs/core-management.md's "Manual steps required"). `select('*')` alone
 * never has this problem — it only ever returns whichever columns actually
 * exist — so filtering the *result* by `!t.is_deleted` works identically
 * whether the column is present and false, or (right now) simply absent
 * from every row entirely (`undefined`, which is falsy). This is not a
 * temporary workaround to remove once the migration lands — it's just where
 * this filter belongs, and it'll keep working unchanged afterward too. */
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await cm().from('tasks').select('*').order('added_at', { ascending: false })
  if (error) throw error
  return (data as Task[]).filter((t) => !t.is_deleted)
}

/** Same reasoning as fetchTasks() above — orders by added_at (guaranteed to
 * exist) rather than deleted_at, and filters is_deleted client-side. Before
 * the pass-6 migration runs this always returns an empty list (nothing has
 * ever been marked deleted, since the column doesn't exist to mark it on)
 * rather than erroring — which is the correct behavior for "no soft-delete
 * infrastructure yet", not a bug to work around. */
export async function fetchDeletedTasks(): Promise<Task[]> {
  const { data, error } = await cm().from('tasks').select('*').order('added_at', { ascending: false })
  if (error) throw error
  return (data as Task[]).filter((t) => t.is_deleted === true)
}

export async function fetchTask(id: string): Promise<Task> {
  const { data, error } = await cm().from('tasks').select('*').eq('id', id).single()
  if (error) throw error
  return data as Task
}

export async function createTask(params: {
  priority: Task['priority']
  department: string
  task_description: string
  responsible_user_id: string
  current_deadline: string
  created_by: string
}): Promise<Task> {
  const { data, error } = await cm().from('tasks').insert(params).select('*').single()
  if (error) throw error
  return data as Task
}

export async function updateTask(id: string, changes: Partial<Task>): Promise<void> {
  const { error } = await cm().from('tasks').update(changes).eq('id', id)
  if (error) throw error
}

/** Soft delete — the normal delete action everywhere in the admin UI, single
 * or bulk (one request either way, via `.in('id', ids)`). Pairs with
 * useUndoableDelete's 5s grace window: the row stays fully intact in the DB,
 * just flagged, so "Undo" and "Restore" (from the Deleted Tasks view) are
 * both trivial — there's no un-delete-from-hard-delete to build.
 *
 * Falls back to a real hard delete (purgeTasks) when is_deleted/deleted_at
 * don't exist yet — PostgREST returns PGRST204 ("could not find the column")
 * for an unknown column in a write body, distinct from the 42703 a read-side
 * query gets for the same underlying cause. This was the concrete bug behind
 * "delete produces Failed to delete task": the pass-6 migration adding those
 * columns has still never run, so every soft-delete write was unconditionally
 * failing. Falling back to a real delete makes the action actually succeed
 * now; once the migration runs, this fallback simply stops triggering (the
 * primary update starts succeeding instead), no further code change needed. */
export async function softDeleteTasks(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await cm()
    .from('tasks')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) {
    if (error.code === 'PGRST204' || error.code === '42703') {
      await purgeTasks(ids)
      return
    }
    throw error
  }
}

export async function softDeleteTask(id: string): Promise<void> {
  return softDeleteTasks([id])
}

export async function restoreTask(id: string): Promise<void> {
  const { error } = await cm().from('tasks').update({ is_deleted: false, deleted_at: null }).eq('id', id)
  if (error) throw error
}

/** Real, irreversible hard delete. Normally only called from the Deleted
 * Tasks view's "Purge permanently" action (which confirms first) — but also
 * used internally as softDeleteTasks' fallback when is_deleted/deleted_at
 * don't exist yet, in which case there genuinely is no soft option available
 * and a hard delete is the only way the user's delete action can succeed. */
export async function purgeTasks(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await cm().from('tasks').delete().in('id', ids)
  if (error) throw error
}

export async function purgeTask(id: string): Promise<void> {
  return purgeTasks([id])
}

// ---------------------------------------------------------------------------
// Admin surface — remarks timeline (also written to by staff, see below)
// ---------------------------------------------------------------------------

export async function fetchTaskRemarks(taskId: string): Promise<TaskRemark[]> {
  const { data, error } = await cm()
    .from('task_remarks')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as TaskRemark[]
}

export async function addTaskRemark(taskId: string, authorUserId: string, remarkText: string): Promise<void> {
  const { error } = await cm()
    .from('task_remarks')
    .insert({ task_id: taskId, author_user_id: authorUserId, remark_text: remarkText })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Admin surface — today's points
// ---------------------------------------------------------------------------

export async function fetchTodayPoints(): Promise<TodayPoint[]> {
  const { data, error } = await cm().from('today_points').select('*').order('logged_at', { ascending: false })
  if (error) throw error
  return data as TodayPoint[]
}

export async function createTodayPoint(params: {
  point_text: string
  source: TodayPoint['source']
  logged_at: string
  created_by: string
}): Promise<TodayPoint> {
  const { data, error } = await cm().from('today_points').insert(params).select('*').single()
  if (error) throw error
  return data as TodayPoint
}

/** Explicit two-step conversion — insert the task, then link the point to it.
 * Never automatic; only ever called from an admin's "Convert to Task" click. */
export async function convertPointToTask(
  pointId: string,
  taskDraft: Parameters<typeof createTask>[0],
): Promise<Task> {
  const task = await createTask(taskDraft)
  const { error } = await cm().from('today_points').update({ converted_task_id: task.id }).eq('id', pointId)
  if (error) throw error
  return task
}

// ---------------------------------------------------------------------------
// Admin surface — meetings (scaffold) & scratch sheets (best-effort)
// ---------------------------------------------------------------------------

export async function fetchMeetings(): Promise<Meeting[]> {
  const { data, error } = await cm().from('meetings').select('*').order('meeting_date', { ascending: false })
  if (error) throw error
  return data as Meeting[]
}

export async function createMeeting(params: {
  meeting_date: string
  attendees: string[]
  notes: string | null
  created_by: string
}): Promise<Meeting> {
  const { data, error } = await cm().from('meetings').insert(params).select('*').single()
  if (error) throw error
  return data as Meeting
}

export async function fetchScratchSheets(): Promise<ScratchSheet[]> {
  const { data, error } = await cm().from('scratch_sheets').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return data as ScratchSheet[]
}

export async function createScratchSheet(createdBy: string): Promise<ScratchSheet> {
  const { data, error } = await cm()
    .from('scratch_sheets')
    .insert({ created_by: createdBy })
    .select('*')
    .single()
  if (error) throw error
  return data as ScratchSheet
}

export async function deleteScratchSheet(id: string): Promise<void> {
  const { error } = await cm().from('scratch_sheets').delete().eq('id', id)
  if (error) throw error
}

export async function updateScratchSheet(id: string, changes: { title?: string; content?: string }): Promise<void> {
  const { error } = await cm().from('scratch_sheets').update(changes).eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function fetchNotifications(userId: string): Promise<CoreManagementNotification[]> {
  const { data, error } = await cm()
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as CoreManagementNotification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await cm().from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

/** Manually triggers the reminder digest on demand, in addition to its daily
 * cron schedule — same underlying logic (urgency tiers, Claude summary
 * line), just an explicit send-now instead of waiting for 8am. The edge
 * function verifies the caller is a Core Management admin itself. */
export async function sendReminders(params: {
  scope: 'all' | 'department' | 'user'
  departmentKey?: string
  userId?: string
}): Promise<{ success: boolean; remindersSent?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('core-management-digest', { body: params })
  if (error) {
    let message = error.message
    if ('context' in error && error.context instanceof Response) {
      try {
        const body = await error.context.json()
        if (body?.error) message = body.error
      } catch {
        // fall back to the generic error message below
      }
    }
    throw new Error(message)
  }
  return data
}

// ---------------------------------------------------------------------------
// Staff surface — do NOT widen these queries. Staff must only ever see their
// own tasks, and never status/official_remarks/is_delayed_manual, which is
// why fetchStaffOwnTasks reads the restricted staff_own_tasks_view, not the
// tasks table directly. RLS enforces this server-side too — this is belt and
// suspenders, not the only line of defense.
// ---------------------------------------------------------------------------

export async function fetchStaffOwnTasks(): Promise<StaffOwnTask[]> {
  const { data, error } = await cm()
    .from('staff_own_tasks_view')
    .select('*')
    .order('current_deadline', { ascending: true })
  if (error) throw error
  return data as StaffOwnTask[]
}

export async function updateOwnDeadline(taskId: string, currentDeadline: string): Promise<void> {
  const { error } = await cm().from('tasks').update({ current_deadline: currentDeadline }).eq('id', taskId)
  if (error) throw error
}

export async function addOwnRemark(taskId: string, authorUserId: string, remarkText: string): Promise<void> {
  await addTaskRemark(taskId, authorUserId, remarkText)
}

export async function fetchOwnTaskRemarks(taskId: string): Promise<TaskRemark[]> {
  return fetchTaskRemarks(taskId)
}

// ---------------------------------------------------------------------------
// User display names — shared lookup across every view (mirrors
// src/lib/purchase/db.ts's fetchUserNames)
// ---------------------------------------------------------------------------

export async function fetchUserNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase.from('users').select('id, full_name, email').in('id', uniqueIds)
  if (error) throw error

  const map = new Map<string, string>()
  for (const u of data as { id: string; full_name: string | null; email: string }[]) {
    map.set(u.id, u.full_name || u.email)
  }
  return map
}
