// AI task extraction (v1) — accepts pasted text or a WhatsApp screenshot
// image, asks Claude to pull out candidate task(s), and returns them to the
// browser as an editable draft. Never saves anything itself — the frontend
// always shows a confirmation screen where every field can be edited before
// the normal createTask() call runs. This is intentionally general-purpose,
// not tuned to any one person's shorthand/writing style — that
// personalization is an explicit v2, to be designed once real example
// messages are available (see docs/core-management.md).
//
// Caller must be a signed-in Core Management admin — same allowlist check
// as core-management-digest's manual-trigger path, since this is reachable
// directly from the browser (unlike the digest function's cron path).
import { createClient } from 'npm:@supabase/supabase-js@2'

interface ExtractedTask {
  task_description: string
  department_guess: string | null
  responsible_name_guess: string | null
  deadline_iso: string | null
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ success: false, error: 'Server misconfigured' }, 500)
  }
  if (!anthropicKey) {
    return json({ success: false, error: 'ANTHROPIC_API_KEY is not configured' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()

  if (!caller) return json({ success: false, error: 'Invalid session' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: allowlisted } = await admin
    .schema('core')
    .from('core_management_admins')
    .select('user_id')
    .eq('user_id', caller.id)
    .maybeSingle()

  if (!allowlisted) return json({ success: false, error: 'Only Core Management admins can use AI extraction' }, 403)

  let body: { text?: string; imageBase64?: string; mediaType?: string }
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400)
  }

  if (!body.text?.trim() && !body.imageBase64) {
    return json({ success: false, error: 'Provide text or an image' }, 400)
  }

  const { data: departments } = await admin.schema('core').from('departments').select('key, label').order('sort_order')
  const { data: users } = await admin
    .schema('core')
    .from('users')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('full_name')

  const departmentList = ((departments ?? []) as { key: string; label: string }[])
    .map((d) => `${d.key} (${d.label})`)
    .join(', ')
  const rosterList = ((users ?? []) as { id: string; full_name: string | null; email: string }[])
    .map((u) => u.full_name || u.email)
    .join(', ')

  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `You extract task-tracker entries from informal work messages (often WhatsApp text or screenshots). Today's date is ${today}. Known departments: ${departmentList}. Known people (for matching "responsible person" against, by name similarity — pick the closest match, do not invent a name that isn't in this list unless truly no match exists): ${rosterList}.

Return ONLY a JSON array (no prose, no markdown fences) of objects, one per distinct task/action item found:
[{"task_description": string, "department_guess": string|null (one of the department keys above, or null if unclear), "responsible_name_guess": string|null (a name from the roster above, or null if unclear), "deadline_iso": string|null (YYYY-MM-DD if a date or relative date like "by Friday" is mentioned, resolved against today's date; null otherwise)}]

If the message contains no identifiable task, return an empty array [].`

  const contentBlocks: Record<string, unknown>[] = []
  if (body.imageBase64) {
    contentBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.imageBase64 },
    })
  }
  contentBlocks.push({ type: 'text', text: body.text?.trim() || 'Extract the task(s) from this image.' })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return json({ success: false, error: `Claude API error: ${errText}` }, 502)
    }

    const responseJson = await res.json()
    const rawText: string = responseJson?.content?.[0]?.text ?? '[]'

    let extracted: ExtractedTask[]
    try {
      // Strip markdown fences if the model added them despite instructions.
      const cleaned = rawText.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      return json({ success: false, error: 'Could not parse extraction result' }, 502)
    }

    return json({ success: true, tasks: extracted }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : 'Extraction failed' }, 500)
  }
})
