// 'other' added and is_delayed_manual folded into this enum's 'delayed' value
// as of pass 6 — see docs/core-management.md's "Data model" section for the
// full reasoning. A task's priority is now a single admin-set choice, not a
// priority tier plus an independent boolean.
export type TaskPriority = 'active' | 'tasklist' | 'delayed' | 'other'
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'on_hold'
export type PointSource = 'meeting' | 'verbal' | 'other'
export type NotificationKind = 'urgency_digest' | 'task_reminder'

export interface Task {
  id: string
  task_number: string
  priority: TaskPriority
  department: string
  task_description: string
  responsible_user_id: string
  added_at: string
  initial_deadline: string | null
  current_deadline: string | null
  status: TaskStatus
  official_remarks: string | null
  /** Soft-delete — a deleted task is never hard-removed by the app itself;
   * it moves to the Deleted Tasks view and can be restored or permanently
   * purged from there. */
  is_deleted: boolean
  deleted_at: string | null
  created_by: string | null
  updated_at: string
}

/** Columns exposed by core_management.staff_own_tasks_view — deliberately
 * excludes status/official_remarks/is_delayed_manual, which staff must never see. */
export interface StaffOwnTask {
  id: string
  task_number: string
  task_description: string
  department: string
  added_at: string
  current_deadline: string | null
  responsible_user_id: string
}

export interface TaskRemark {
  id: string
  task_id: string
  author_user_id: string
  remark_text: string
  created_at: string
}

export interface TodayPoint {
  id: string
  point_text: string
  source: PointSource
  logged_at: string
  created_by: string | null
  converted_task_id: string | null
  created_at: string
}

export interface Meeting {
  id: string
  meeting_date: string
  attendees: string[]
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface ScratchSheet {
  id: string
  title: string
  content: string
  created_by: string | null
  updated_at: string
}

export interface CoreManagementNotification {
  id: string
  recipient_user_id: string
  task_id: string | null
  kind: NotificationKind
  title: string
  body: string
  is_read: boolean
  created_at: string
}
