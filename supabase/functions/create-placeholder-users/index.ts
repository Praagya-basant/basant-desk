// One-off bulk seeder for Core Management's historical-data import. Creates
// a real auth.users row (random, never-shared password — so the account is
// not usable to sign in in practice) plus a matching core.users row flagged
// is_placeholder=true, is_active=false, for each {email, name} in the body.
// Idempotent: skips any email that already has a core.users row. Not part
// of the app's regular surface — deploy-and-invoke-once, not linked from
// any UI.
import { createClient } from 'npm:@supabase/supabase-js@2'

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes))
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  let body: { users?: { email: string; name: string }[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), { status: 400 })
  }

  const users = body.users ?? []
  const results: { email: string; status: string; id?: string }[] = []

  for (const u of users) {
    const { data: existing } = await admin.schema('core').from('users').select('id').eq('email', u.email).maybeSingle()

    if (existing) {
      results.push({ email: u.email, status: 'already_exists', id: existing.id })
      continue
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: u.email,
      password: randomPassword(),
      email_confirm: false,
    })

    if (createError || !created?.user) {
      results.push({ email: u.email, status: `auth_error: ${createError?.message ?? 'unknown'}` })
      continue
    }

    const { error: insertError } = await admin.schema('core').from('users').insert({
      id: created.user.id,
      full_name: u.name,
      email: u.email,
      role: 'custom',
      departments: [],
      department_admin_for: [],
      is_active: false,
      is_placeholder: true,
    })

    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id)
      results.push({ email: u.email, status: `profile_error: ${insertError.message}` })
      continue
    }

    results.push({ email: u.email, status: 'created', id: created.user.id })
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
