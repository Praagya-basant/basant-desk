// mcsp-expiry-alerts — daily sweep (pg_cron, 9:00 AM IST / 3:30 AM UTC, see
// migration 0022) that finds every sample/panel expiring in exactly 30 or 15
// days and fires one mcsp-send-email 'expiry_alert' per item. Triggered
// server-to-server (cron -> net.http_post with the public anon key, just to
// pass the platform's verify_jwt gateway check — see migration 0022's
// comment for why), not by a browser, so it isn't CORS-sensitive — kept
// minimal on purpose. Its own privileged DB work and its call onward to
// mcsp-send-email both use SUPABASE_SERVICE_ROLE_KEY, injected automatically
// by the platform into every edge function.

import { createClient } from 'npm:@supabase/supabase-js@2'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// No real human triggers this — a valid, non-existent uuid so mcsp-send-email's
// core.users lookup resolves to "no name found" instead of erroring. The
// expiry_alert email body doesn't include a "triggered by" field anyway.
const SYSTEM_TRIGGERED_BY = '00000000-0000-0000-0000-000000000000'

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfigured (missing Supabase env vars)' }, 500)

  const sb = createClient(supabaseUrl, serviceRoleKey)

  // Both boundaries computed in UTC calendar days — good enough for a
  // 30/15-day-out heads-up; being off by the IST/UTC offset near midnight
  // isn't meaningful for a monthly-scale validity window.
  const today = new Date()
  const in30 = new Date(today)
  in30.setUTCDate(in30.getUTCDate() + 30)
  const in15 = new Date(today)
  in15.setUTCDate(in15.getUTCDate() + 15)
  const targets = [in30.toISOString().slice(0, 10), in15.toISOString().slice(0, 10)]

  const { data: samples, error: samplesError } = await sb.schema('mcsp').from('samples').select('id').in('expiry_date', targets)
  if (samplesError) return json({ error: `Failed to query samples: ${samplesError.message}` }, 500)

  const { data: panels, error: panelsError } = await sb
    .schema('mcsp')
    .from('panels')
    .select('id')
    .in('expiry_date', targets)
    .neq('status', 'retired')
  if (panelsError) return json({ error: `Failed to query panels: ${panelsError.message}` }, 500)

  const items: { item_type: 'sample' | 'panel'; item_id: string }[] = [
    ...((samples ?? []) as { id: string }[]).map((s) => ({ item_type: 'sample' as const, item_id: s.id })),
    ...((panels ?? []) as { id: string }[]).map((p) => ({ item_type: 'panel' as const, item_id: p.id })),
  ]

  const emailUrl = `${supabaseUrl}/functions/v1/mcsp-send-email`
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const item of items) {
    try {
      const res = await fetch(emailUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'expiry_alert',
          item_type: item.item_type,
          item_id: item.item_id,
          triggered_by: SYSTEM_TRIGGERED_BY,
        }),
      })
      if (res.ok) sent++
      else {
        failed++
        errors.push(`${item.item_type}:${item.item_id} -> ${res.status}`)
      }
    } catch (err) {
      failed++
      errors.push(`${item.item_type}:${item.item_id} -> ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return json({ checked: items.length, sent, failed, errors: errors.slice(0, 20), targets })
})
