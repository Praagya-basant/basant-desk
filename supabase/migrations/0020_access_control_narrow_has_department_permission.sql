-- 0020_access_control_narrow_has_department_permission.sql
--
-- REGRESSION FIX for migration 0019.
--
-- 0019's core.has_department_permission() shim answered "any view+ access to any
-- module in this department" — which now includes a plain department-membership
-- baseline (core.modules.member_baseline / manager_baseline).
--
-- Several MCSP RLS policies (mcsp_samples_select, mcsp_panels_select,
-- mcsp_movements_select, mcsp_panel_movements_select, mcsp_recall_requests_select,
-- mcsp_sample_comments_select, …) OR in `core.has_department_permission('sales')`
-- as the "custom user with an EXPLICITLY-granted blanket-read permission" branch.
-- With the broad shim, every sales manager and merchant satisfied it via their
-- baseline and thereby BYPASSED the hall / buyer row-scoping
-- (mcsp.is_hall_manager_of / mcsp.owns_buyer) — a hall manager saw every hall's
-- samples, a merchant saw every buyer's samples.
--
-- The original semantic was "the user has an EXPLICITLY ASSIGNED permission in
-- this department" (a row in core.user_permissions). The faithful equivalent in
-- the new model is: a per-user module override OR a grant inherited from an
-- assigned role — NOT a membership baseline. `user_permissions` was empty at
-- migration time, so this correctly returns false for everyone today, exactly
-- matching pre-0018 behavior; row-scoping is back in force.

create or replace function core.has_department_permission(dept text)
returns boolean
language sql stable security definer
set search_path to 'core','pg_temp'
as $$
  select
    exists (
      select 1
      from core.user_module_access uma
      join core.modules m on m.key = uma.module_key
      where uma.user_id = auth.uid()
        and m.department_key = dept
        and uma.level >= 'view'
    )
    or exists (
      select 1
      from core.user_role_assignments ura
      join core.roles r               on r.id = ura.role_id
      join core.role_module_access rma on rma.role_id = r.id
      join core.modules m             on m.key = rma.module_key
      where ura.user_id = auth.uid()
        and m.department_key = dept
        and rma.level >= 'view'
        and (r.department_key is null or r.department_key = dept)
    );
$$;

notify pgrst, 'reload schema';
