// Reminder digest for Core Management. Two callers:
//   1. pg_cron, daily — Authorization: Bearer <service role key> (see the
//      cron job's net.http_post). Full scan, respects the quiet-window +
//      interval throttling below.
//   2. A signed-in Core Management admin, on demand — Authorization: Bearer
//      <their session JWT>, POST body { scope: 'all'|'department'|'user',
//      departmentKey?, userId? }. Verified against core.core_management_admins
//      before doing anything. Bypasses throttling (an explicit "send now"
//      click should always send), still only for tasks in the overdue/
//      approaching tiers — nothing to remind about otherwise — and only
//      for tasks within the requested scope.
// Computes which non-done tasks need a reminder using the urgency-tier
// thresholds below, writes core_management.notifications rows for both
// admins, and (if any are due) asks Claude for one summarization-only line
// to put at the top of the batch. The AI never decides scheduling, status,
// or task content — only writes that one line.
import { createClient } from 'npm:@supabase/supabase-js@2'

// Reminder cadence — deliberately NOT a flat daily reminder (confirmed pain
// point of the old Sheets tracker, which sent the same email every day
// regardless of how close the deadline was). Quiet right after assignment,
// ramping up as current_deadline approaches, most frequent once overdue.
// Tune these four numbers only — the scheduling logic itself shouldn't need
// to change. Ignored entirely for a manual/on-demand send (see above).
const QUIET_WINDOW_DAYS = 3 // no reminders in the first N days after added_at
const APPROACHING_DAYS = 5 // start reminding once within N days of current_deadline
const APPROACHING_INTERVAL_DAYS = 2 // remind every N days while approaching
const OVERDUE_INTERVAL_DAYS = 1 // remind every N days once overdue

interface TaskRow {
  id: string
  task_number: string
  task_description: string
  department: string
  responsible_user_id: string
  added_at: string
  current_deadline: string | null
  status: string
}

interface ManualRequest {
  scope: 'all' | 'department' | 'user'
  departmentKey?: string
  userId?: string
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + 'T00:00:00Z').getTime()
  const to = new Date(toISO + 'T00:00:00Z').getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ success: false, error: 'Server misconfigured' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '')
  const isCronCall = callerToken === serviceRoleKey

  let manual: ManualRequest | null = null

  if (!isCronCall) {
    // Manual trigger from the browser — verify the caller is one of the two
    // named Core Management admins before doing anything. The digest
    // function has always run with the service role internally; this is the
    // one path where an arbitrary caller could reach it, so it's the one
    // path that needs its own identity check.
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()

    if (!caller) return json({ success: false, error: 'Invalid session' }, 401)

    const { data: allowlisted } = await admin
      .schema('core')
      .from('core_management_admins')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (!allowlisted) return json({ success: false, error: 'Only Core Management admins can send reminders' }, 403)

    let body: Partial<ManualRequest> = {}
    try {
      body = await req.json()
    } catch {
      // no body — default to "all"
    }
    manual = { scope: body.scope ?? 'all', departmentKey: body.departmentKey, userId: body.userId }
  }

  const today = todayISO()

  let taskQuery = admin
    .schema('core_management')
    .from('tasks')
    .select('id, task_number, task_description, department, responsible_user_id, added_at, current_deadline, status')
    .neq('status', 'done')

  if (manual?.scope === 'department' && manual.departmentKey) taskQuery = taskQuery.eq('department', manual.departmentKey)
  if (manual?.scope === 'user' && manual.userId) taskQuery = taskQuery.eq('responsible_user_id', manual.userId)

  const { data: tasks, error: tasksError } = await taskQuery

  if (tasksError) {
    return json({ success: false, error: tasksError.message }, 500)
  }

  const { data: admins, error: adminsError } = await admin.schema('core').from('core_management_admins').select('user_id')

  if (adminsError) {
    return json({ success: false, error: adminsError.message }, 500)
  }

  const recipientIds = (admins ?? []).map((a: { user_id: string }) => a.user_id)

  const dueTasks: { task: TaskRow; tier: 'approaching' | 'overdue' }[] = []

  for (const task of (tasks ?? []) as TaskRow[]) {
    if (!task.current_deadline) continue // nothing to be urgent about

    if (!manual) {
      const addedAt = task.added_at.slice(0, 10)
      if (daysBetween(addedAt, today) < QUIET_WINDOW_DAYS) continue
    }

    const daysUntilDeadline = daysBetween(today, task.current_deadline)
    const isOverdue = daysUntilDeadline < 0
    const isApproaching = !isOverdue && daysUntilDeadline <= APPROACHING_DAYS

    if (!isOverdue && !isApproaching) continue

    if (!manual) {
      // "Last reminded" is derived from the notifications log itself — no
      // separate column needed, and it stays correct even if this
      // function's schedule changes. Skipped for manual sends — an
      // explicit "send now" click should always send.
      const { data: lastReminder } = await admin
        .schema('core_management')
        .from('notifications')
        .select('created_at')
        .eq('task_id', task.id)
        .eq('kind', 'task_reminder')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const intervalDays = isOverdue ? OVERDUE_INTERVAL_DAYS : APPROACHING_INTERVAL_DAYS
      if (lastReminder && daysBetween(lastReminder.created_at.slice(0, 10), today) < intervalDays) continue
    }

    dueTasks.push({ task, tier: isOverdue ? 'overdue' : 'approaching' })
  }

  if (dueTasks.length === 0 || recipientIds.length === 0) {
    return json({ success: true, remindersSent: 0 }, 200)
  }

  // One-line urgency summary — summarization only, never scheduling/status/content.
  let summaryLine = `${dueTasks.filter((d) => d.tier === 'overdue').length} tasks overdue, ${
    dueTasks.filter((d) => d.tier === 'approaching').length
  } approaching deadline.`

  if (anthropicKey) {
    try {
      const overdueCount = dueTasks.filter((d) => d.tier === 'overdue').length
      const approachingCount = dueTasks.filter((d) => d.tier === 'approaching').length
      const taskList = dueTasks
        .map((d) => `- [${d.tier}] ${d.task.task_number}: ${d.task.task_description}`)
        .join('\n')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 60,
          messages: [
            {
              role: 'user',
              content: `Write exactly one short line (no preamble, no quotes) summarizing task urgency for a digest. There are ${overdueCount} overdue tasks and ${approachingCount} approaching their deadline. Tasks:\n${taskList}\n\nExample style: "3 tasks overdue, 2 waiting on input since last week."`,
            },
          ],
        }),
      })

      if (res.ok) {
        const responseJson = await res.json()
        const text = responseJson?.content?.[0]?.text?.trim()
        if (text) summaryLine = text
      }
    } catch (err) {
      console.error('Claude summary call failed, falling back to rule-based line:', err)
    }
  }

  const notificationRows: Record<string, unknown>[] = []

  for (const recipientId of recipientIds) {
    notificationRows.push({
      recipient_user_id: recipientId,
      task_id: null,
      kind: 'urgency_digest',
      title: manual ? 'Urgency summary (sent manually)' : 'Urgency summary',
      body: summaryLine,
    })
    for (const { task, tier } of dueTasks) {
      notificationRows.push({
        recipient_user_id: recipientId,
        task_id: task.id,
        kind: 'task_reminder',
        title: `${task.task_number} — ${tier === 'overdue' ? 'Overdue' : 'Approaching deadline'}`,
        body: task.task_description,
      })
    }
  }

  const { error: insertError } = await admin.schema('core_management').from('notifications').insert(notificationRows)

  if (insertError) {
    return json({ success: false, error: insertError.message }, 500)
  }

  // Resend email digest — optional stretch, not built this pass. Seam left
  // here deliberately: if RESEND_API_KEY is ever set, this is where a second
  // branch would send the same batch by email. No-op while absent.
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) {
    console.log('RESEND_API_KEY present but email digest is not implemented this pass — no-op.')
  }

  return json({ success: true, remindersSent: dueTasks.length, recipients: recipientIds.length }, 200)
})
