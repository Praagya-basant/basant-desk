// Creates a new BASANT Desk user: an auth.users login + matching core.users
// profile row, in one server-side step. Callable by a global admin, or by a
// department admin creating a user scoped to their own department (same
// subset constraints as the "department admins can manage users" RLS policy
// on core.users — this function uses the service role key and bypasses RLS
// entirely, so it must enforce those constraints itself). Never exposed to
// the browser.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const VALID_ROLES = ['admin', 'manager', 'merchant', 'custom']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, error: 'Server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ success: false, error: 'Missing authorization header' }, 401)
  }

  // Client scoped to the caller's own session — used only to identify who's calling.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser()

  if (callerError || !caller) {
    return json({ success: false, error: 'Invalid session' }, 401)
  }

  // Service-role client for privileged operations — bypasses RLS, never sent to the browser.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerProfile, error: profileError } = await adminClient
    .schema('core')
    .from('users')
    .select('role, is_active, department_admin_for')
    .eq('id', caller.id)
    .single()

  if (profileError || !callerProfile?.is_active) {
    return json({ success: false, error: 'Only admins can create users' }, 403)
  }

  const callerIsGlobalAdmin = callerProfile.role === 'admin'
  const callerDeptScope: string[] = callerProfile.department_admin_for ?? []

  if (!callerIsGlobalAdmin && callerDeptScope.length === 0) {
    return json({ success: false, error: 'Only admins can create users' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400)
  }

  const full_name = typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : null
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = typeof body.role === 'string' ? body.role : ''
  const departments = Array.isArray(body.departments) ? body.departments.filter((d) => typeof d === 'string') : []
  const hall = typeof body.hall === 'string' && body.hall.trim() ? body.hall.trim() : null
  const buyers = Array.isArray(body.buyers)
    ? body.buyers.filter((b) => typeof b === 'string' && b.trim())
    : null
  const departmentAdminFor = Array.isArray(body.department_admin_for)
    ? body.department_admin_for.filter((d) => typeof d === 'string')
    : []

  if (!email || !password || !VALID_ROLES.includes(role)) {
    return json({ success: false, error: 'email, password, and a valid role are required' }, 400)
  }

  if (password.length < 8) {
    return json({ success: false, error: 'Password must be at least 8 characters' }, 400)
  }

  // A department admin can only create non-admin users scoped to their own
  // department(s), and can only grant department_admin_for within that same
  // scope — mirrors core.users' "department admins can manage users" policy.
  if (!callerIsGlobalAdmin) {
    const withinScope = (list: string[]) => list.length > 0 && list.every((d) => callerDeptScope.includes(d))
    if (role === 'admin' || !withinScope(departments) || !departmentAdminFor.every((d) => callerDeptScope.includes(d))) {
      return json({ success: false, error: 'You can only create users within your own department scope' }, 403)
    }
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created?.user) {
    return json({ success: false, error: createError?.message ?? 'Could not create the account' }, 400)
  }

  const { error: insertError } = await adminClient.schema('core').from('users').insert({
    id: created.user.id,
    full_name,
    email,
    role,
    departments,
    hall: role === 'manager' ? hall : null,
    buyers: role === 'merchant' ? buyers : null,
    department_admin_for: departmentAdminFor,
  })

  if (insertError) {
    // Roll back the auth account so we don't leave an orphaned login with no profile.
    await adminClient.auth.admin.deleteUser(created.user.id)
    return json({ success: false, error: insertError.message }, 400)
  }

  await adminClient.schema('core').from('activity_log').insert({
    user_id: caller.id,
    department: departments[0] ?? 'admin',
    action: 'user.created',
    details: { target_user_id: created.user.id, email, role, departments, department_admin_for: departmentAdminFor },
  })

  return json({ success: true, user: { id: created.user.id, email } }, 201)
})
