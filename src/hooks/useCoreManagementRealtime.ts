import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Task, TaskRemark } from '../lib/coreManagement/dbTypes'

/** First supabase.channel() usage in this codebase — subscribes to live
 * changes on tasks/task_remarks so both admins see each other's edits
 * without a refresh. Callers merge by upserting-by-id into their own local
 * state rather than refetching, to avoid flicker and keep unrelated edits
 * from stomping each other. */
export function useCoreManagementRealtime(handlers: {
  onTaskChange?: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; row: Task; oldId?: string }) => void
  onRemarkChange?: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; row: TaskRemark }) => void
}) {
  useEffect(() => {
    const channel = supabase.channel('core-management-tasks')

    if (handlers.onTaskChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'core_management', table: 'tasks' },
        (payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
          const row = (eventType === 'DELETE' ? payload.old : payload.new) as Task
          handlers.onTaskChange?.({ eventType, row, oldId: (payload.old as Partial<Task>)?.id })
        },
      )
    }

    if (handlers.onRemarkChange) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'core_management', table: 'task_remarks' },
        (payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
          const row = (eventType === 'DELETE' ? payload.old : payload.new) as TaskRemark
          handlers.onRemarkChange?.({ eventType, row })
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
