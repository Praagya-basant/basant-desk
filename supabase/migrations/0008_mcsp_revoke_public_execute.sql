-- Security tightening — Postgres grants EXECUTE to PUBLIC by default on
-- function creation, so every mcsp.* function (both the RPCs explicitly
-- granted to `authenticated` and the three helpers current_hall_id/
-- is_hall_manager_of/owns_buyer, which were never explicitly granted to
-- anyone) was also callable by the anon role via PostgREST's auto-exposed
-- /rest/v1/rpc/<name> endpoints. Flagged by Supabase's security advisor
-- (anon_security_definer_function_executable / authenticated_...).
--
-- Not an active vulnerability — every one of these functions gates on
-- auth.uid()-derived checks (core.is_admin() etc.), which correctly
-- resolve false when auth.uid() is null (anon has no session) — but it's
-- the wrong belt-and-suspenders default and worth closing at the grant
-- layer rather than relying solely on each function's internal logic.
--
-- Revoking from PUBLIC removes the implicit blanket grant (both anon and
-- authenticated lose the PUBLIC-derived access); the explicit `grant
-- execute ... to authenticated` already issued for every RPC in
-- 0004-0006 is untouched, so authenticated sessions keep exactly the
-- access they had. The three read-only helpers are left with no grantee
-- at all — they're only ever invoked from inside other SECURITY DEFINER
-- functions or RLS policies (as the function owner), never called
-- directly by any frontend code.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'mcsp'
  loop
    execute format('revoke execute on function %s from public', r.sig);
  end loop;
end $$;
