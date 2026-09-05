-- Adds 'mcsp' to pgrst.db_schemas via ALTER ROLE authenticator, same as the
-- yaamya schema did. ⚠️ This is overwritten by Supabase dashboard -> Settings
-- -> API -> Exposed schemas the next time that page is saved — the
-- dashboard is the canonical source. MUST also add 'mcsp' there by hand.
alter role authenticator set pgrst.db_schemas = 'public, core, purchase, graphql_public, core_management, yaamya, mcsp';
notify pgrst, 'reload config';

-- Department + permission seed. Appended at the end of sort_order (13) —
-- deliberately not renumbering the existing wip_*/orange_tree/operations
-- rows (those are core_management-only categories, unrelated to this
-- department's position in the sidebar, which src/config/departments.ts
-- controls independently).
insert into core.departments (key, label, route, sort_order)
values ('mcsp', 'MCSP', '/mcsp', 13)
on conflict (key) do nothing;

insert into core.permissions (key, label, department)
select v.key, v.label, 'mcsp' from (values
  ('mcsp.view_all_buyers', 'View All Buyers'),
  ('mcsp.manage_samples', 'Manage Samples'),
  ('mcsp.manage_panels', 'Manage Panels'),
  ('mcsp.view_movements', 'View Movements'),
  ('mcsp.manage_users', 'Manage Users'),
  ('mcsp.export_data', 'Export Data')
) as v(key, label)
where not exists (select 1 from core.permissions p where p.key = v.key);
