import { supabase } from './supabase'

/**
 * Shared event log every module writes to. Nothing reads this yet beyond the
 * admin's own history — it exists so future integrations (WhatsApp, email,
 * notifications) can hook into a single stream without touching each module.
 */
export async function logActivity(
  userId: string,
  department: string,
  action: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('activity_log').insert({
    user_id: userId,
    department,
    action,
    details,
  })

  if (error) {
    // Never let a logging failure block the action it's describing.
    console.error('Failed to write activity log:', error.message)
  }
}
