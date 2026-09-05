-- MCSP moves from being its own top-level department ('mcsp') to living
-- under Sales ('sales') — a deliberate re-scoping decided after the
-- mcsp-migration branch's Phase 1/2. The mcsp Postgres schema/tables/RPCs
-- keep their names unchanged (no data moves) — only the department-scoping
-- string literals change: core.users.departments/department_admin_for must
-- now contain 'sales' (not 'mcsp') for MCSP access. The core.departments
-- row for 'mcsp' (sort_order 13) is left in place, harmless/unused for
-- scoping purposes now — not dropped since Core Management's category
-- tracker also reads core.departments and this isn't the moment to audit
-- that.

create or replace function mcsp.is_hall_manager_of(p_hall_id uuid)
returns boolean
language sql security definer stable set search_path = mcsp, core, pg_temp as $$
  select exists (
    select 1 from core.users u
    where u.id = auth.uid() and u.role = 'manager' and 'sales' = any(u.departments)
      and p_hall_id = mcsp.current_hall_id()
  );
$$;

create or replace function mcsp.owns_buyer(p_buyer_id uuid)
returns boolean
language sql security definer stable set search_path = mcsp, core, pg_temp as $$
  select exists (
    select 1 from mcsp.buyers b
    join core.users u on b.name = any(u.buyers)
    where b.id = p_buyer_id and u.id = auth.uid() and u.role = 'merchant' and 'sales' = any(u.departments)
  );
$$;

-- halls
drop policy if exists "mcsp_halls_select" on mcsp.halls;
create policy "mcsp_halls_select" on mcsp.halls for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or exists (select 1 from core.users u where u.id = auth.uid() and 'sales' = any(u.departments))
  );

drop policy if exists "mcsp_halls_write" on mcsp.halls;
create policy "mcsp_halls_write" on mcsp.halls for all to authenticated
  using (core.is_admin() or core.is_department_admin('sales'))
  with check (core.is_admin() or core.is_department_admin('sales'));

-- buyers
drop policy if exists "mcsp_buyers_select" on mcsp.buyers;
create policy "mcsp_buyers_select" on mcsp.buyers for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'manager' and 'sales' = any(u.departments))
    or mcsp.owns_buyer(id)
  );

drop policy if exists "mcsp_buyers_write" on mcsp.buyers;
create policy "mcsp_buyers_write" on mcsp.buyers for all to authenticated
  using (core.is_admin() or core.is_department_admin('sales'))
  with check (core.is_admin() or core.is_department_admin('sales'));

-- samples
drop policy if exists "mcsp_samples_select" on mcsp.samples;
create policy "mcsp_samples_select" on mcsp.samples for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or mcsp.is_hall_manager_of(hall_id)
    or mcsp.owns_buyer(buyer_id)
  );

drop policy if exists "mcsp_samples_insert" on mcsp.samples;
create policy "mcsp_samples_insert" on mcsp.samples for insert to authenticated
  with check (
    core.is_admin() or core.is_department_admin('sales') or mcsp.is_hall_manager_of(hall_id)
  );

drop policy if exists "mcsp_samples_update" on mcsp.samples;
create policy "mcsp_samples_update" on mcsp.samples for update to authenticated
  using (core.is_admin() or core.is_department_admin('sales'))
  with check (core.is_admin() or core.is_department_admin('sales'));

-- movements
drop policy if exists "mcsp_movements_select" on mcsp.movements;
create policy "mcsp_movements_select" on mcsp.movements for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or exists (
      select 1 from mcsp.samples s where s.id = movements.sample_id
      and (mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
    )
  );

-- panels
drop policy if exists "mcsp_panels_select" on mcsp.panels;
create policy "mcsp_panels_select" on mcsp.panels for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or mcsp.is_hall_manager_of(hall_id)
    or (is_shared and exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'merchant' and 'sales' = any(u.departments)))
    or mcsp.owns_buyer(buyer_id)
  );

drop policy if exists "mcsp_panels_insert" on mcsp.panels;
create policy "mcsp_panels_insert" on mcsp.panels for insert to authenticated
  with check (
    core.is_admin() or core.is_department_admin('sales') or mcsp.is_hall_manager_of(hall_id)
  );

drop policy if exists "mcsp_panels_update" on mcsp.panels;
create policy "mcsp_panels_update" on mcsp.panels for update to authenticated
  using (core.is_admin() or core.is_department_admin('sales'))
  with check (core.is_admin() or core.is_department_admin('sales'));

drop policy if exists "mcsp_panel_movements_select" on mcsp.panel_movements;
create policy "mcsp_panel_movements_select" on mcsp.panel_movements for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or exists (
      select 1 from mcsp.panels p where p.id = panel_movements.panel_id
      and (mcsp.is_hall_manager_of(p.hall_id) or mcsp.owns_buyer(p.buyer_id))
    )
  );

-- sample_comments
drop policy if exists "mcsp_sample_comments_select" on mcsp.sample_comments;
create policy "mcsp_sample_comments_select" on mcsp.sample_comments for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or exists (
      select 1 from mcsp.samples s where s.id = sample_comments.sample_id
      and (mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
    )
  );

drop policy if exists "mcsp_sample_comments_insert" on mcsp.sample_comments;
create policy "mcsp_sample_comments_insert" on mcsp.sample_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from mcsp.samples s where s.id = sample_id and mcsp.owns_buyer(s.buyer_id))
  );

-- recall_requests
drop policy if exists "mcsp_recall_requests_select" on mcsp.recall_requests;
create policy "mcsp_recall_requests_select" on mcsp.recall_requests for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales') or core.has_department_permission('sales')
    or exists (
      select 1 from mcsp.samples s where s.id = recall_requests.sample_id
      and (mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
    )
  );

drop policy if exists "mcsp_recall_requests_insert" on mcsp.recall_requests;
create policy "mcsp_recall_requests_insert" on mcsp.recall_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and exists (select 1 from mcsp.samples s where s.id = sample_id and mcsp.owns_buyer(s.buyer_id))
  );

drop policy if exists "mcsp_recall_requests_update" on mcsp.recall_requests;
create policy "mcsp_recall_requests_update" on mcsp.recall_requests for update to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales')
    or exists (select 1 from mcsp.samples s where s.id = recall_requests.sample_id and mcsp.is_hall_manager_of(s.hall_id))
  );

-- shift_requests
drop policy if exists "mcsp_shift_requests_select" on mcsp.shift_requests;
create policy "mcsp_shift_requests_select" on mcsp.shift_requests for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales')
    or requested_by = auth.uid()
    or mcsp.is_hall_manager_of(from_hall_id) or mcsp.is_hall_manager_of(to_hall_id)
    or (item_type = 'sample' and exists (select 1 from mcsp.samples s where s.id = item_id and mcsp.owns_buyer(s.buyer_id)))
    or (item_type = 'panel' and exists (select 1 from mcsp.panels p where p.id = item_id and mcsp.owns_buyer(p.buyer_id)))
  );

drop policy if exists "mcsp_shift_requests_insert" on mcsp.shift_requests;
create policy "mcsp_shift_requests_insert" on mcsp.shift_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (
      (item_type = 'sample' and exists (
        select 1 from mcsp.samples s where s.id = item_id and s.status = 'in_hall' and s.hall_id = from_hall_id
        and (core.is_admin() or core.is_department_admin('sales') or mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
      ))
      or (item_type = 'panel' and exists (
        select 1 from mcsp.panels p where p.id = item_id and p.status = 'in_hall' and p.hall_id = from_hall_id
        and (core.is_admin() or core.is_department_admin('sales') or mcsp.is_hall_manager_of(p.hall_id) or mcsp.owns_buyer(p.buyer_id))
      ))
    )
  );

drop policy if exists "mcsp_shift_requests_update" on mcsp.shift_requests;
create policy "mcsp_shift_requests_update" on mcsp.shift_requests for update to authenticated
  using (core.is_admin() or core.is_department_admin('sales'))
  with check (core.is_admin() or core.is_department_admin('sales'));

-- validity_requests
drop policy if exists "mcsp_validity_requests_select" on mcsp.validity_requests;
create policy "mcsp_validity_requests_select" on mcsp.validity_requests for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales')
    or requested_by = auth.uid()
    or (item_type = 'sample' and exists (select 1 from mcsp.samples s where s.id = item_id and mcsp.is_hall_manager_of(s.hall_id)))
    or (item_type = 'panel' and exists (select 1 from mcsp.panels p where p.id = item_id and mcsp.is_hall_manager_of(p.hall_id)))
  );

drop policy if exists "mcsp_validity_requests_insert" on mcsp.validity_requests;
create policy "mcsp_validity_requests_insert" on mcsp.validity_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (
      (item_type = 'sample' and exists (select 1 from mcsp.samples s where s.id = item_id and mcsp.owns_buyer(s.buyer_id)))
      or (item_type = 'panel' and exists (select 1 from mcsp.panels p where p.id = item_id and (p.is_shared or mcsp.owns_buyer(p.buyer_id))))
    )
  );

drop policy if exists "mcsp_validity_requests_update" on mcsp.validity_requests;
create policy "mcsp_validity_requests_update" on mcsp.validity_requests for update to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales')
    or (item_type = 'sample' and exists (select 1 from mcsp.samples s where s.id = item_id and mcsp.is_hall_manager_of(s.hall_id)))
    or (item_type = 'panel' and exists (select 1 from mcsp.panels p where p.id = item_id and mcsp.is_hall_manager_of(p.hall_id)))
  );

-- validity_changes
drop policy if exists "mcsp_validity_changes_select" on mcsp.validity_changes;
create policy "mcsp_validity_changes_select" on mcsp.validity_changes for select to authenticated
  using (core.is_admin() or core.is_department_admin('sales'));

-- notifications
drop policy if exists "mcsp_notifications_select" on mcsp.notifications;
create policy "mcsp_notifications_select" on mcsp.notifications for select to authenticated
  using (recipient_id = auth.uid() or core.is_admin() or core.is_department_admin('sales'));

drop policy if exists "mcsp_notifications_update" on mcsp.notifications;
create policy "mcsp_notifications_update" on mcsp.notifications for update to authenticated
  using (recipient_id = auth.uid() or core.is_admin() or core.is_department_admin('sales'));

-- storage
drop policy if exists "mcsp_images_upload" on storage.objects;
create policy "mcsp_images_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mcsp-images'
    and exists (select 1 from core.users u where u.id = auth.uid() and 'sales' = any(u.departments))
  );

drop policy if exists "mcsp_images_update" on storage.objects;
create policy "mcsp_images_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'mcsp-images'
    and exists (select 1 from core.users u where u.id = auth.uid() and 'sales' = any(u.departments))
  );

drop policy if exists "mcsp_images_delete" on storage.objects;
create policy "mcsp_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'mcsp-images'
    and (
      core.is_admin() or core.is_department_admin('sales')
      or exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'manager' and 'sales' = any(u.departments))
    )
  );

-- Permission keys renamed mcsp.* -> sales.* (department column now 'sales').
-- No core.user_permissions rows reference the old ids (table was empty),
-- so a delete+reinsert is safe.
delete from core.permissions where department = 'mcsp';
insert into core.permissions (key, label, department)
select v.key, v.label, 'sales' from (values
  ('sales.view_all_buyers', 'View All Buyers'),
  ('sales.manage_samples', 'Manage Samples'),
  ('sales.manage_panels', 'Manage Panels'),
  ('sales.view_movements', 'View Movements'),
  ('sales.manage_users', 'Manage Users'),
  ('sales.export_data', 'Export Data')
) as v(key, label)
where not exists (select 1 from core.permissions p where p.key = v.key);
