-- 0019_access_control_retrofit.sql
--
-- Centralized access-control — Phase 2: register existing modules, seed system
-- roles, migrate legacy user_permissions data into the new engine, and make the
-- legacy RLS helper read from the new engine so NO existing policy changes.
--
-- Aborts with an exception if any current user would lose access.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Compatibility shim — every existing purchase/yaamya/mcsp RLS policy calls
--    core.has_department_permission(dept); it now answers from the new engine.
--    Semantics preserved: "does this user have any view+ access in this dept".
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function core.has_department_permission(p_dept text)
returns boolean
language sql stable security definer
set search_path to 'core','pg_temp'
as $$
  select exists (
    select 1 from core.modules m
    where m.department_key = p_dept and m.is_active
      and core.module_access_level(auth.uid(), m.key) >= 'view'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Register existing modules. Baselines chosen to reproduce today's behavior
--    exactly (see docs/access-control.md → "Retrofit behavior matrix").
-- ─────────────────────────────────────────────────────────────────────────────
insert into core.modules (key, department_key, label, parent_module_key, route, sort_order, member_baseline, manager_baseline) values
  ('purchase.honeycomb',             'purchase', 'Honeycomb Calculator',  null,                  '/purchase/honeycomb',              10, 'none', 'edit'),
  ('purchase.honeycomb_history',     'purchase', 'Extraction History',     'purchase.honeycomb', '/purchase/honeycomb/history',      11, 'none', 'edit'),
  ('purchase.honeycomb_price_grid',  'purchase', 'Price Grid',             'purchase.honeycomb', '/purchase/honeycomb/price-grid',   12, 'none', 'none'),
  ('purchase.marble',                'purchase', 'Marble Costing',         null,                  '/purchase/marble-costing',         20, 'none', 'edit'),
  ('purchase.users',                 'purchase', 'Purchase Users',         null,                  '/purchase/users',                  90, 'none', 'none'),
  ('yaamya.wood_inward',             'yaamya',   'Wood Inward',            null,                  '/yaamya/wood-inward',              10, 'edit', 'edit'),
  ('yaamya.inward_log',              'yaamya',   'Inward Log',             null,                  '/yaamya/inward-log',               20, 'none', 'none'),
  ('sales.mcs',                      'sales',    'MCSP — Signed Samples',  null,                  '/sales/mcsp/mcs',                  10, 'view', 'edit'),
  ('sales.mcp',                      'sales',    'MCSP — Counter Panels',  null,                  '/sales/mcsp/mcp',                  11, 'view', 'edit'),
  ('sales.mcsp_validity',            'sales',    'Validity Requests',      null,                  '/sales/mcsp/validity-requests',    20, 'none', 'edit'),
  ('sales.mcsp_shift',               'sales',    'Shift Requests',         null,                  '/sales/mcsp/shift-requests',       21, 'none', 'edit'),
  ('sales.mcsp_recalls',             'sales',    'Recalls',                null,                  '/sales/mcsp/recalls',              22, 'none', 'none'),
  ('sales.mcsp_buyers',              'sales',    'MCSP Buyers',            null,                  '/sales/mcsp/buyers',               80, 'none', 'none'),
  ('sales.mcsp_halls',               'sales',    'MCSP Halls',             null,                  '/sales/mcsp/halls',                81, 'none', 'none'),
  ('sales.mcsp_users',               'sales',    'MCSP Users',             null,                  '/sales/mcsp/users',                82, 'none', 'none')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seed system roles (is_system_role = true) — 3 generic per department that
--    has modules, plus a few named ones matching current real usage.
-- ─────────────────────────────────────────────────────────────────────────────
insert into core.roles (name, description, department_key, is_system_role) values
  ('Viewer',   'Read-only access to every module in the department.',            'purchase', true),
  ('Editor',   'Day-to-day work — create and edit — on the department''s tools.', 'purchase', true),
  ('Approver', 'Editor plus acting on approval workflows.',                       'purchase', true),
  ('Viewer',   'Read-only access to every module in the department.',            'yaamya',   true),
  ('Editor',   'Day-to-day work — create and edit — on the department''s tools.', 'yaamya',   true),
  ('Approver', 'Editor plus acting on approval workflows.',                       'yaamya',   true),
  ('Viewer',   'Read-only access to every module in the department.',            'sales',    true),
  ('Editor',   'Day-to-day work — create and edit — on the department''s tools.', 'sales',    true),
  ('Approver', 'Editor plus acting on approval workflows.',                       'sales',    true),
  ('Purchase Data Entry', 'Run honeycomb extractions and review history.',        'purchase', true),
  ('MCSP Merchant',       'View signed samples and counter panels.',              'sales',    true),
  ('MCSP Hall Manager',   'Manage samples/panels and review validity + shift requests.', 'sales', true)
on conflict (department_key, name) do nothing;

-- Generic role grants over the department's "real work" modules (skip the
-- admin-only surfaces — manager_baseline = 'none' — which stay reachable only
-- via department_admin_for, a global admin, an explicit per-user 'admin'
-- override, or a custom role an admin builds deliberately).
insert into core.role_module_access (role_id, module_key, level)
select r.id, m.key,
  case r.name
    when 'Viewer'   then 'view'::core.access_level
    when 'Editor'   then 'edit'::core.access_level
    when 'Approver' then 'approve'::core.access_level
  end
from core.roles r
join core.modules m
  on m.department_key = r.department_key and m.manager_baseline <> 'none'
where r.is_system_role and r.name in ('Viewer','Editor','Approver')
on conflict (role_id, module_key) do nothing;

-- Named role grants.
insert into core.role_module_access (role_id, module_key, level)
select r.id, g.module_key, g.level::core.access_level
from core.roles r
join (values
  ('Purchase Data Entry', 'purchase', 'purchase.honeycomb',         'edit'),
  ('Purchase Data Entry', 'purchase', 'purchase.honeycomb_history', 'view'),
  ('MCSP Merchant',       'sales',    'sales.mcs',                  'view'),
  ('MCSP Merchant',       'sales',    'sales.mcp',                  'view'),
  ('MCSP Hall Manager',   'sales',    'sales.mcs',                  'edit'),
  ('MCSP Hall Manager',   'sales',    'sales.mcp',                  'edit'),
  ('MCSP Hall Manager',   'sales',    'sales.mcsp_validity',        'edit'),
  ('MCSP Hall Manager',   'sales',    'sales.mcsp_shift',           'edit')
) as g(role_name, dept, module_key, level)
  on g.role_name = r.name and g.dept = r.department_key
on conflict (role_id, module_key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Migrate legacy user_permissions → user_module_access.
--    In practice every legacy sales.* grant only ever gave "enter Sales + read
--    MCS/MCP" (the UI never gated edit on these keys, and MCSP write-RLS never
--    used has_department_permission), so they all map to 'view'. The honeycomb
--    key did enable read+write, so it maps to 'edit'.
-- ─────────────────────────────────────────────────────────────────────────────
insert into core.user_module_access (user_id, module_key, level, granted_by, note)
select up.user_id, mp.module_key, mp.level::core.access_level, null,
       'migrated 2026-09-09 from legacy user_permissions (' || p.key || ')'
from core.user_permissions up
join core.permissions p on p.id = up.permission_id
join (values
  ('purchase.hc_extraction', 'purchase.honeycomb',          'edit'),
  ('purchase.hc_extraction', 'purchase.honeycomb_history',  'view'),
  ('sales.view_all_buyers',  'sales.mcs',                   'view'),
  ('sales.view_all_buyers',  'sales.mcp',                   'view'),
  ('sales.manage_samples',   'sales.mcs',                   'view'),
  ('sales.manage_panels',    'sales.mcp',                   'view'),
  ('sales.view_movements',   'sales.mcs',                   'view'),
  ('sales.view_movements',   'sales.mcp',                   'view'),
  ('sales.manage_users',     'sales.mcs',                   'view'),
  ('sales.manage_users',     'sales.mcp',                   'view'),
  ('sales.export_data',      'sales.mcs',                   'view'),
  ('sales.export_data',      'sales.mcp',                   'view')
) as mp(legacy_key, module_key, level) on mp.legacy_key = p.key
on conflict (user_id, module_key)
  do update set level = greatest(core.user_module_access.level, excluded.level),
                note  = coalesce(core.user_module_access.note || ' + ', '') || excluded.note;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Verification gate — abort the whole migration if anyone loses access.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_regressions int;
  v_migrated    int;
  v_modules     int;
  v_roles       int;
begin
  select count(*) into v_regressions
  from core.user_permissions up
  join core.permissions p on p.id = up.permission_id
  join (values
    ('purchase.hc_extraction', 'purchase.honeycomb',          'edit'),
    ('purchase.hc_extraction', 'purchase.honeycomb_history',  'view'),
    ('sales.view_all_buyers',  'sales.mcs',                   'view'),
    ('sales.view_all_buyers',  'sales.mcp',                   'view'),
    ('sales.manage_samples',   'sales.mcs',                   'view'),
    ('sales.manage_panels',    'sales.mcp',                   'view'),
    ('sales.view_movements',   'sales.mcs',                   'view'),
    ('sales.view_movements',   'sales.mcp',                   'view'),
    ('sales.manage_users',     'sales.mcs',                   'view'),
    ('sales.manage_users',     'sales.mcp',                   'view'),
    ('sales.export_data',      'sales.mcs',                   'view'),
    ('sales.export_data',      'sales.mcp',                   'view')
  ) as mp(legacy_key, module_key, level) on mp.legacy_key = p.key
  where core.module_access_level(up.user_id, mp.module_key) < mp.level::core.access_level;

  if v_regressions > 0 then
    raise exception 'ABORT: % legacy permission grant(s) not preserved by the new resolver', v_regressions;
  end if;

  select count(*) into v_migrated from core.user_module_access
    where note like 'migrated 2026-09-09%';
  select count(*) into v_modules from core.modules;
  select count(*) into v_roles   from core.roles where is_system_role;

  raise notice 'Access-control retrofit OK — % modules registered, % system roles seeded, % legacy grants migrated, 0 regressions.',
    v_modules, v_roles, v_migrated;
end $$;

notify pgrst, 'reload schema';
