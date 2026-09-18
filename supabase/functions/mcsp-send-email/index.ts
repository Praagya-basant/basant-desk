// mcsp-send-email — sends one transactional email for an MCSP workflow event
// via Resend. Called two ways:
//   1. Fire-and-forget from the frontend right after an action succeeds
//      (src/lib/mcsp/db.ts) — the caller never awaits or surfaces failures.
//   2. From mcsp-expiry-alerts, once per item approaching expiry.
//
// Recipient resolution follows the live schema captured in migration 0021:
//   - Hall HODs  = mcsp.users where hall_id = <hall> and mcsp_role = 'hod'
//   - Merchants  = sales.users where buyer_ids @> [<buyer>]
//   - Sales Heads (CC) = sales.email_groups where group_name = 'sales_heads',
//     joined to sales.users
// A recipient's email is their notification_email override if set, else
// their core.users.email. notify_on_* flags on sales.users/mcsp.users are
// honoured where the relevant column exists for that event; there's no
// notify_on_issue/return on sales.users nor notify_on_shift/validity on
// mcsp.users, so those combinations simply aren't gated.
//
// Both mcsp.users and sales.users are brand-new, currently-empty tables
// (see CLAUDE.md) — until they're populated, most events will resolve to
// zero recipients. That's expected, not a bug: this function treats "no
// recipients" as a normal, successful no-op rather than an error.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type EmailEvent = 'sample_issued' | 'sample_returned' | 'expiry_alert' | 'shift_request' | 'validity_extended'
type ItemType = 'sample' | 'panel'

interface RequestBody {
  event: EmailEvent
  item_type: ItemType
  item_id: string
  movement_id?: string | null
  triggered_by: string
}

const EVENTS: EmailEvent[] = ['sample_issued', 'sample_returned', 'expiry_alert', 'shift_request', 'validity_extended']

function escapeHtml(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function renderEmailHtml(heading: string, rows: [string, string][]): string {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #E8E8E5;color:#6B6B6B;font-size:13px;width:40%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #E8E8E5;color:#1A1A1A;font-size:14px;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px 12px;background:#F8F8F7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#FFFFFF;padding:32px;border-radius:8px;">
      <div style="font-weight:700;font-size:18px;color:#1A1A1A;letter-spacing:-0.01em;">BASANT</div>
      <hr style="border:none;border-top:1px solid #E8E8E5;margin:16px 0 24px;" />
      <div style="font-size:16px;font-weight:700;color:#1A1A1A;margin-bottom:16px;">${escapeHtml(heading)}</div>
      <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
      <div style="margin-top:28px;">
        <a href="https://desk.basant.info/sales/mcsp" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:600;">View Sample</a>
      </div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E8E8E5;color:#9B9B96;font-size:12px;">
        BASANT — For support contact praagya@basant.info
      </div>
    </div>
  </body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfigured (missing Supabase env vars)' }, 500)
  if (!resendApiKey) return json({ error: 'Server misconfigured (missing RESEND_API_KEY)' }, 500)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { event, item_type, item_id, movement_id, triggered_by } = body
  if (!EVENTS.includes(event)) return json({ error: `Invalid event: ${event}` }, 400)
  if (item_type !== 'sample' && item_type !== 'panel') return json({ error: `Invalid item_type: ${item_type}` }, 400)
  if (!item_id) return json({ error: 'item_id is required' }, 400)

  const sb = createClient(supabaseUrl, serviceRoleKey)

  // ── shared lookups ────────────────────────────────────────────────────

  async function coreEmail(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null
    const { data } = await sb.schema('core').from('users').select('email').eq('id', userId).maybeSingle()
    return (data as { email: string } | null)?.email ?? null
  }

  async function coreName(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null
    const { data } = await sb.schema('core').from('users').select('full_name, email').eq('id', userId).maybeSingle()
    const row = data as { full_name: string | null; email: string } | null
    return row ? row.full_name || row.email : null
  }

  async function hallName(hallId: string | null | undefined): Promise<string | null> {
    if (!hallId) return null
    const { data } = await sb.schema('mcsp').from('halls').select('name').eq('id', hallId).maybeSingle()
    return (data as { name: string } | null)?.name ?? null
  }

  type McspUserRow = {
    user_id: string
    notification_email: string | null
    is_active: boolean | null
    notify_on_issue: boolean | null
    notify_on_return: boolean | null
    notify_on_expiry: boolean | null
  }

  async function hodEmails(hallId: string | null | undefined, notifyField: 'notify_on_issue' | 'notify_on_return' | null): Promise<string[]> {
    if (!hallId) return []
    const { data } = await sb.schema('mcsp').from('users').select('*').eq('hall_id', hallId).eq('mcsp_role', 'hod')
    const out: string[] = []
    for (const r of (data ?? []) as McspUserRow[]) {
      if (r.is_active === false) continue
      if (notifyField && r[notifyField] === false) continue
      const email = r.notification_email || (await coreEmail(r.user_id))
      if (email) out.push(email)
    }
    return out
  }

  type SalesUserRow = {
    user_id: string
    notification_email: string | null
    is_active: boolean | null
    notify_on_expiry: boolean | null
    notify_on_shift: boolean | null
    notify_on_validity: boolean | null
  }

  async function merchantEmails(
    buyerId: string | null | undefined,
    notifyField: 'notify_on_expiry' | 'notify_on_shift' | 'notify_on_validity' | null,
  ): Promise<string[]> {
    if (!buyerId) return []
    const { data } = await sb.schema('sales').from('users').select('*').contains('buyer_ids', [buyerId])
    const out: string[] = []
    for (const r of (data ?? []) as SalesUserRow[]) {
      if (r.is_active === false) continue
      if (notifyField && r[notifyField] === false) continue
      const email = r.notification_email || (await coreEmail(r.user_id))
      if (email) out.push(email)
    }
    return out
  }

  async function salesHeadEmails(): Promise<string[]> {
    const { data: groups } = await sb.schema('sales').from('email_groups').select('user_id').eq('group_name', 'sales_heads')
    const ids = [...new Set(((groups ?? []) as { user_id: string | null }[]).map((g) => g.user_id).filter((x): x is string => !!x))]
    if (ids.length === 0) return []
    const { data } = await sb.schema('sales').from('users').select('*').in('user_id', ids)
    const out: string[] = []
    for (const r of (data ?? []) as SalesUserRow[]) {
      if (r.is_active === false) continue
      const email = r.notification_email || (await coreEmail(r.user_id))
      if (email) out.push(email)
    }
    return out
  }

  // ── item ─────────────────────────────────────────────────────────────

  const itemTable = item_type === 'sample' ? 'samples' : 'panels'
  const { data: itemRow, error: itemError } = await sb
    .schema('mcsp')
    .from(itemTable)
    .select('*, buyer:buyer_id(id,name), hall:hall_id(id,name)')
    .eq('id', item_id)
    .maybeSingle()

  if (itemError || !itemRow) return json({ error: `${item_type === 'sample' ? 'Sample' : 'Panel'} not found` }, 404)

  const item = itemRow as any
  const code: string = item_type === 'sample' ? item.bt_code : item.panel_code || 'N/A'
  const productName: string = item_type === 'sample' ? item.product_name : item.panel_name
  const buyerId: string | null = item.buyer_id
  const buyerName: string = item.buyer?.name ?? '—'
  const currentHallId: string | null = item.hall_id
  const currentHallName: string = item.hall?.name ?? '—'

  const triggeredByName = (await coreName(triggered_by)) ?? 'Unknown'

  let subject = ''
  let heading = ''
  let rows: [string, string][] = []
  let to: string[] = []
  let cc: string[] = []

  if (event === 'sample_issued') {
    const movTable = item_type === 'sample' ? 'movements' : 'panel_movements'
    const idCol = item_type === 'sample' ? 'sample_id' : 'panel_id'
    let q = sb.schema('mcsp').from(movTable).select('*')
    q = movement_id ? q.eq('id', movement_id) : q.eq(idCol, item_id).order('picked_at', { ascending: false }).limit(1)
    const { data: mov } = await q.maybeSingle()
    const m = mov as any
    const fromHallId = m?.from_hall_id ?? null
    const toHallId = m?.destination_hall_id ?? null
    const fromHall = (await hallName(fromHallId)) ?? currentHallName
    const toHall = toHallId ? (await hallName(toHallId)) ?? '—' : m?.destination ?? '—'

    subject = `[${code}] Sample Issued — ${fromHall} → ${toHall}`
    heading = 'Sample Issued'
    rows = [
      ['BT Code', code],
      ['Product Name', productName],
      ['From Hall', fromHall],
      ['To Hall', toHall],
      ['Reason', m?.reason_other || m?.reason || '—'],
      ['Issued By', triggeredByName],
      ['Date/Time', fmtDateTime(m?.picked_at)],
    ]
    to = [...(await hodEmails(fromHallId, 'notify_on_issue')), ...(await hodEmails(toHallId, 'notify_on_issue')), ...(await merchantEmails(buyerId, null))]
  } else if (event === 'sample_returned') {
    const movTable = item_type === 'sample' ? 'movements' : 'panel_movements'
    const idCol = item_type === 'sample' ? 'sample_id' : 'panel_id'
    let q = sb.schema('mcsp').from(movTable).select('*')
    q = movement_id ? q.eq('id', movement_id) : q.eq(idCol, item_id).order('picked_at', { ascending: false }).limit(1)
    const { data: mov } = await q.maybeSingle()
    const m = mov as any

    subject = `[${code}] Sample Returned — ${currentHallName}`
    heading = 'Sample Returned'
    rows = [
      ['BT Code', code],
      ['Product Name', productName],
      ['Hall', currentHallName],
      ['Returned By', triggeredByName],
      ['Return Time', fmtDateTime(m?.returned_at)],
    ]
    to = [...(await hodEmails(currentHallId, 'notify_on_return')), ...(await merchantEmails(buyerId, null))]
  } else if (event === 'expiry_alert') {
    const expiryDate: string | null = item.expiry_date
    const daysRemaining = expiryDate ? Math.round((new Date(expiryDate).getTime() - Date.now()) / 86_400_000) : null

    subject = `[${code}] Expiry Alert — ${daysRemaining ?? '?'} days remaining`
    heading = 'Expiry Alert'
    rows = [
      ['BT Code', code],
      ['Product Name', productName],
      ['Buyer', buyerName],
      ['Hall', currentHallName],
      ['Expiry Date', fmtDate(expiryDate)],
      ['Days Remaining', daysRemaining === null ? '—' : String(daysRemaining)],
    ]
    to = await merchantEmails(buyerId, 'notify_on_expiry')
    cc = await salesHeadEmails()
  } else if (event === 'shift_request') {
    let q = sb.schema('mcsp').from('shift_requests').select('*, from_hall:from_hall_id(name), to_hall:to_hall_id(name)')
    q = movement_id ? q.eq('id', movement_id) : q.eq('item_id', item_id).order('created_at', { ascending: false }).limit(1)
    const { data: reqRow } = await q.maybeSingle()
    const r = reqRow as any

    const fromHall = r?.from_hall?.name ?? currentHallName
    const toHall = r?.to_hall?.name ?? '—'

    subject = `[${code}] Shift Requested — ${fromHall} → ${toHall}`
    heading = 'Hall Shift Requested'
    rows = [
      ['BT Code', code],
      ['Product Name', productName],
      ['Current Hall', fromHall],
      ['Requested Hall', toHall],
      ['Requested By', triggeredByName],
      ['Date', fmtDateTime(r?.created_at)],
    ]
    to = [...(await hodEmails(r?.from_hall_id ?? currentHallId, null)), ...(await hodEmails(r?.to_hall_id, null)), ...(await merchantEmails(buyerId, 'notify_on_shift'))]
    cc = await salesHeadEmails()
  } else {
    // validity_extended
    const { data: changeRow } = await sb
      .schema('mcsp')
      .from('validity_changes')
      .select('*')
      .eq('item_id', item_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const c = changeRow as any

    subject = `[${code}] Validity Extended — ${productName}`
    heading = 'Validity Extended'
    rows = [
      ['BT Code', code],
      ['Product Name', productName],
      ['Old Expiry', fmtDate(c?.old_expiry_date)],
      ['New Expiry', fmtDate(c?.new_expiry_date)],
      ['Extended By', (await coreName(c?.changed_by)) ?? triggeredByName],
      ['Reason', c?.reason || '—'],
    ]
    to = await merchantEmails(buyerId, 'notify_on_validity')
    cc = await salesHeadEmails()
  }

  const toSet = [...new Set(to.filter(Boolean))]
  const ccSet = [...new Set(cc.filter((e) => Boolean(e) && !toSet.includes(e)))]

  if (toSet.length === 0) {
    return json({ sent: false, reason: 'no recipients', event, item_id })
  }

  const html = renderEmailHtml(heading, rows)

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'BASANT <noreply@basant.info>',
      to: toSet,
      cc: ccSet.length ? ccSet : undefined,
      subject,
      html,
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text().catch(() => '')
    return json({ sent: false, error: `Resend API error: ${resendRes.status} ${errText}`, event, item_id }, 200)
  }

  return json({ sent: true, event, item_id, recipients: toSet.length, cc: ccSet.length })
})
