-- Security fix — core.core_management_admins was created without Row Level
-- Security enabled at all (Supabase advisory: critical, "RLS Disabled").
-- That meant anyone holding the anon/authenticated key could read or write
-- the Core Management allowlist directly, bypassing the intended "exactly
-- Praagya + Amit" restriction.
--
-- Applied directly to the live basant-desk project (fwedvwhjscdrvgjsdzyk) on
-- 2026-09-05, ahead of this commit — this file documents/replays that fix,
-- it does not newly apply anything time-sensitive.
--
-- Why this is safe to enable with only one narrow policy:
-- every legitimate reader already goes through core.is_core_management_admin(),
-- a SECURITY DEFINER function owned by the table owner, so it bypasses RLS
-- regardless of policies here; the two service-role edge functions
-- (core-management-ai-extract, core-management-digest) bypass RLS too via
-- the service-role key. So this table never needed direct anon/authenticated
-- access — a bare "enable RLS, add zero policies" would have been correct on
-- its own. One self-read policy is added anyway, in case a future
-- admin-facing UI wants to read its own membership row directly. No insert/
-- update/delete policy is added on purpose — allowlist changes stay a
-- manual/service-role operation, same as today.

alter table core.core_management_admins enable row level security;

drop policy if exists "core_management_admins_select_own" on core.core_management_admins;
create policy "core_management_admins_select_own" on core.core_management_admins
  for select to authenticated
  using (user_id = auth.uid());
