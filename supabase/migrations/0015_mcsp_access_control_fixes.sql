-- 0015_mcsp_access_control_fixes.sql
--
-- P1 access-control fixes from the 2026-09-08 audit.
--   3  — hall managers can raise validity_requests (not merchant-only)
--   5  — anyone with item access can comment on a sample (not merchant-only)
--   6  — global admins (departments = []) can upload/replace mcsp-images
--   7  — return-condition photos: add UPDATE policy on movements tables
--   8  — notify_shift_requested no longer notifies EVERY user when an admin raises it
--   9  — notification bell shows each user only their OWN notifications

-- ── 3 — validity request insert: allow hall managers + admins ────────────────
drop policy if exists mcsp_validity_requests_insert on mcsp.validity_requests;
create policy mcsp_validity_requests_insert on mcsp.validity_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (
      core.is_admin()
      or core.is_department_admin('sales')
      or (item_type = 'sample' and exists (
        select 1 from mcsp.samples s
        where s.id = item_id
          and (mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
      ))
      or (item_type = 'panel' and exists (
        select 1 from mcsp.panels p
        where p.id = item_id
          and (mcsp.is_hall_manager_of(p.hall_id) or p.is_shared or mcsp.owns_buyer(p.buyer_id))
      ))
    )
  );

-- ── 5 — sample comments insert: anyone who can see the sample can comment ────
drop policy if exists mcsp_sample_comments_insert on mcsp.sample_comments;
create policy mcsp_sample_comments_insert on mcsp.sample_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      core.is_admin()
      or core.is_department_admin('sales')
      or core.has_department_permission('sales')
      or exists (
        select 1 from mcsp.samples s
        where s.id = sample_id
          and (mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
      )
    )
  );

-- ── 7 — movement photo attach: UPDATE policy on both movement tables ─────────
drop policy if exists mcsp_movements_update on mcsp.movements;
create policy mcsp_movements_update on mcsp.movements
  for update to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales')
    or logged_by = auth.uid()
    or exists (select 1 from mcsp.samples s where s.id = movements.sample_id and mcsp.is_hall_manager_of(s.hall_id))
  )
  with check (
    core.is_admin() or core.is_department_admin('sales')
    or logged_by = auth.uid()
    or exists (select 1 from mcsp.samples s where s.id = movements.sample_id and mcsp.is_hall_manager_of(s.hall_id))
  );

drop policy if exists mcsp_panel_movements_update on mcsp.panel_movements;
create policy mcsp_panel_movements_update on mcsp.panel_movements
  for update to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales')
    or logged_by = auth.uid()
    or exists (select 1 from mcsp.panels p where p.id = panel_movements.panel_id and mcsp.is_hall_manager_of(p.hall_id))
  )
  with check (
    core.is_admin() or core.is_department_admin('sales')
    or logged_by = auth.uid()
    or exists (select 1 from mcsp.panels p where p.id = panel_movements.panel_id and mcsp.is_hall_manager_of(p.hall_id))
  );

-- ── 9 — notifications: each user sees / updates only their own ───────────────
drop policy if exists mcsp_notifications_select on mcsp.notifications;
create policy mcsp_notifications_select on mcsp.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists mcsp_notifications_update on mcsp.notifications;
create policy mcsp_notifications_update on mcsp.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ── 6 — storage: global admins can upload/replace images ────────────────────
drop policy if exists mcsp_images_upload on storage.objects;
create policy mcsp_images_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mcsp-images'
    and (
      core.is_admin()
      or core.is_department_admin('sales')
      or exists (select 1 from core.users u where u.id = auth.uid() and 'sales' = any(u.departments))
    )
  );

drop policy if exists mcsp_images_update on storage.objects;
create policy mcsp_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'mcsp-images'
    and (
      core.is_admin()
      or core.is_department_admin('sales')
      or exists (select 1 from core.users u where u.id = auth.uid() and 'sales' = any(u.departments))
    )
  );

-- ── 8 — notify_shift_requested: never blast every user in the system ────────
create or replace function mcsp.notify_shift_requested(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'mcsp', 'core', 'pg_temp'
as $function$
declare
  v_request mcsp.shift_requests;
  v_buyer_name text;
  v_from_hall_name text;
  v_recipients uuid[];
begin
  select * into v_request from mcsp.shift_requests where id = p_request_id;

  select name into v_from_hall_name from mcsp.halls where id = v_request.from_hall_id;

  if v_request.item_type = 'sample' then
    select b.name into v_buyer_name from mcsp.samples s join mcsp.buyers b on b.id = s.buyer_id where s.id = v_request.item_id;
  else
    select b.name into v_buyer_name from mcsp.panels p join mcsp.buyers b on b.id = p.buyer_id where p.id = v_request.item_id;
  end if;

  -- Only people who actually need to act on / know about this request:
  -- global admins, Sales department admins, the from-hall's manager, and the
  -- item's merchant contacts. Never every user in the system.
  select array_agg(distinct u.id) into v_recipients
  from core.users u
  where u.id <> v_request.requested_by
    and (
      u.role = 'admin'
      or u.department_admin_for @> array['sales']
      or ('sales' = any(u.departments) and u.role = 'manager' and u.hall = v_from_hall_name)
      or ('sales' = any(u.departments) and u.role = 'merchant' and v_buyer_name = any(u.buyers))
    );

  perform mcsp.notify_users(
    v_recipients, 'Hall shift requested', 'A hall shift request needs review', 'shift_requested', v_request.item_type, v_request.item_id
  );
end;
$function$;

revoke execute on function mcsp.notify_shift_requested(uuid) from public;
grant execute on function mcsp.notify_shift_requested(uuid) to authenticated;

notify pgrst, 'reload schema';
