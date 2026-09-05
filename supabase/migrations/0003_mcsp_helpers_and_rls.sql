-- Helper functions (SECURITY DEFINER, same reasoning as core.is_admin() etc:
-- read core.users without RLS recursion). Reuses core.is_admin(),
-- core.is_department_admin('mcsp'), core.has_department_permission('mcsp')
-- as-is — only the two new hall/buyer scoping checks are MCSP-specific.

create or replace function mcsp.current_hall_id()
returns uuid
language sql security definer stable set search_path = mcsp, core, pg_temp as $$
  select h.id from mcsp.halls h
  join core.users u on u.hall = h.name
  where u.id = auth.uid();
$$;

-- True for a 'manager' role user who has 'mcsp' in their departments AND
-- whose core.users.hall resolves to this exact hall — the MCSP equivalent
-- of the old app's hall_manager, scoped the same way (one hall).
create or replace function mcsp.is_hall_manager_of(p_hall_id uuid)
returns boolean
language sql security definer stable set search_path = mcsp, core, pg_temp as $$
  select exists (
    select 1 from core.users u
    where u.id = auth.uid() and u.role = 'manager' and 'mcsp' = any(u.departments)
      and p_hall_id = mcsp.current_hall_id()
  );
$$;

-- True for a 'merchant' role user who has 'mcsp' in their departments AND
-- this buyer's name is in their core.users.buyers array — the MCSP
-- equivalent of the old app's is_merchant_buyer(), natively multi-buyer
-- since core.users.buyers is already an array.
create or replace function mcsp.owns_buyer(p_buyer_id uuid)
returns boolean
language sql security definer stable set search_path = mcsp, core, pg_temp as $$
  select exists (
    select 1 from mcsp.buyers b
    join core.users u on b.name = any(u.buyers)
    where b.id = p_buyer_id and u.id = auth.uid() and u.role = 'merchant' and 'mcsp' = any(u.departments)
  );
$$;

alter table mcsp.halls enable row level security;
alter table mcsp.buyers enable row level security;
alter table mcsp.samples enable row level security;
alter table mcsp.movements enable row level security;
alter table mcsp.panels enable row level security;
alter table mcsp.panel_movements enable row level security;
alter table mcsp.sample_comments enable row level security;
alter table mcsp.recall_requests enable row level security;
alter table mcsp.shift_requests enable row level security;
alter table mcsp.validity_requests enable row level security;
alter table mcsp.validity_changes enable row level security;
alter table mcsp.notifications enable row level security;

-- halls: hall names aren't sensitive, needed app-wide (destination dropdowns) —
-- readable by any mcsp member; write is admin/dept-admin only.
drop policy if exists "mcsp_halls_select" on mcsp.halls;
create policy "mcsp_halls_select" on mcsp.halls for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
    or exists (select 1 from core.users u where u.id = auth.uid() and 'mcsp' = any(u.departments))
  );

drop policy if exists "mcsp_halls_write" on mcsp.halls;
create policy "mcsp_halls_write" on mcsp.halls for all to authenticated
  using (core.is_admin() or core.is_department_admin('mcsp'))
  with check (core.is_admin() or core.is_department_admin('mcsp'));

-- buyers: admin/dept-admin full read; hall managers need the full list for
-- the "buyer" dropdown when adding a sample; merchants only see their own.
drop policy if exists "mcsp_buyers_select" on mcsp.buyers;
create policy "mcsp_buyers_select" on mcsp.buyers for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
    or exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'manager' and 'mcsp' = any(u.departments))
    or mcsp.owns_buyer(id)
  );

drop policy if exists "mcsp_buyers_write" on mcsp.buyers;
create policy "mcsp_buyers_write" on mcsp.buyers for all to authenticated
  using (core.is_admin() or core.is_department_admin('mcsp'))
  with check (core.is_admin() or core.is_department_admin('mcsp'));

-- samples: scoped per role. Status transitions happen exclusively through
-- the RPCs (0004), which enforce hall scoping internally, so no direct
-- UPDATE policy is needed for managers here.
drop policy if exists "mcsp_samples_select" on mcsp.samples;
create policy "mcsp_samples_select" on mcsp.samples for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
    or mcsp.is_hall_manager_of(hall_id)
    or mcsp.owns_buyer(buyer_id)
  );

drop policy if exists "mcsp_samples_insert" on mcsp.samples;
create policy "mcsp_samples_insert" on mcsp.samples for insert to authenticated
  with check (
    core.is_admin() or core.is_department_admin('mcsp') or mcsp.is_hall_manager_of(hall_id)
  );

drop policy if exists "mcsp_samples_update" on mcsp.samples;
create policy "mcsp_samples_update" on mcsp.samples for update to authenticated
  using (core.is_admin() or core.is_department_admin('mcsp'))
  with check (core.is_admin() or core.is_department_admin('mcsp'));

-- movements: read-scoped via the parent sample's hall/buyer. Writes happen
-- through checkout_sample/return_sample/forward_sample only (no insert/
-- update policy at all, matching the original app).
drop policy if exists "mcsp_movements_select" on mcsp.movements;
create policy "mcsp_movements_select" on mcsp.movements for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
    or exists (
      select 1 from mcsp.samples s where s.id = movements.sample_id
      and (mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
    )
  );

-- panels: same shape as samples, plus is_shared cross-buyer visibility for
-- merchants (a shared panel isn't tied to one buyer's collection).
drop policy if exists "mcsp_panels_select" on mcsp.panels;
create policy "mcsp_panels_select" on mcsp.panels for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
    or mcsp.is_hall_manager_of(hall_id)
    or (is_shared and exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'merchant' and 'mcsp' = any(u.departments)))
    or mcsp.owns_buyer(buyer_id)
  );

drop policy if exists "mcsp_panels_insert" on mcsp.panels;
create policy "mcsp_panels_insert" on mcsp.panels for insert to authenticated
  with check (
    core.is_admin() or core.is_department_admin('mcsp') or mcsp.is_hall_manager_of(hall_id)
  );

drop policy if exists "mcsp_panels_update" on mcsp.panels;
create policy "mcsp_panels_update" on mcsp.panels for update to authenticated
  using (core.is_admin() or core.is_department_admin('mcsp'))
  with check (core.is_admin() or core.is_department_admin('mcsp'));

drop policy if exists "mcsp_panel_movements_select" on mcsp.panel_movements;
create policy "mcsp_panel_movements_select" on mcsp.panel_movements for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
    or exists (
      select 1 from mcsp.panels p where p.id = panel_movements.panel_id
      and (mcsp.is_hall_manager_of(p.hall_id) or mcsp.owns_buyer(p.buyer_id))
    )
  );

-- sample_comments: merchants comment on their own buyer's samples; hall
-- managers/admins read comments on samples they can already see.
drop policy if exists "mcsp_sample_comments_select" on mcsp.sample_comments;
create policy "mcsp_sample_comments_select" on mcsp.sample_comments for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
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

-- recall_requests: merchants raise on their own buyer's samples; hall
-- managers see recalls for samples in their hall (they action the return).
drop policy if exists "mcsp_recall_requests_select" on mcsp.recall_requests;
create policy "mcsp_recall_requests_select" on mcsp.recall_requests for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp') or core.has_department_permission('mcsp')
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
    core.is_admin() or core.is_department_admin('mcsp')
    or exists (select 1 from mcsp.samples s where s.id = recall_requests.sample_id and mcsp.is_hall_manager_of(s.hall_id))
  );

-- shift_requests: requester's own hall must match the item's actual current
-- hall (can't be spoofed); visible to both parties (either hall + the
-- buyer's merchant) plus admin. Approval is admin/dept-admin only (RPC).
drop policy if exists "mcsp_shift_requests_select" on mcsp.shift_requests;
create policy "mcsp_shift_requests_select" on mcsp.shift_requests for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp')
    or requested_by = auth.uid()
    or mcsp.is_hall_manager_of(from_hall_id) or mcsp.is_hall_manager_of(to_hall_id)
    or (
      item_type = 'sample' and exists (select 1 from mcsp.samples s where s.id = item_id and mcsp.owns_buyer(s.buyer_id))
    )
    or (
      item_type = 'panel' and exists (select 1 from mcsp.panels p where p.id = item_id and mcsp.owns_buyer(p.buyer_id))
    )
  );

drop policy if exists "mcsp_shift_requests_insert" on mcsp.shift_requests;
create policy "mcsp_shift_requests_insert" on mcsp.shift_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (
      (item_type = 'sample' and exists (
        select 1 from mcsp.samples s where s.id = item_id and s.status = 'in_hall' and s.hall_id = from_hall_id
        and (core.is_admin() or core.is_department_admin('mcsp') or mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
      ))
      or (item_type = 'panel' and exists (
        select 1 from mcsp.panels p where p.id = item_id and p.status = 'in_hall' and p.hall_id = from_hall_id
        and (core.is_admin() or core.is_department_admin('mcsp') or mcsp.is_hall_manager_of(p.hall_id) or mcsp.owns_buyer(p.buyer_id))
      ))
    )
  );

drop policy if exists "mcsp_shift_requests_update" on mcsp.shift_requests;
create policy "mcsp_shift_requests_update" on mcsp.shift_requests for update to authenticated
  using (core.is_admin() or core.is_department_admin('mcsp'))
  with check (core.is_admin() or core.is_department_admin('mcsp'));

-- validity_requests: merchant raises on their own item, admin or the item's
-- own hall manager reviews (mirrors the original app's later-phase widening).
drop policy if exists "mcsp_validity_requests_select" on mcsp.validity_requests;
create policy "mcsp_validity_requests_select" on mcsp.validity_requests for select to authenticated
  using (
    core.is_admin() or core.is_department_admin('mcsp')
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
    core.is_admin() or core.is_department_admin('mcsp')
    or (item_type = 'sample' and exists (select 1 from mcsp.samples s where s.id = item_id and mcsp.is_hall_manager_of(s.hall_id)))
    or (item_type = 'panel' and exists (select 1 from mcsp.panels p where p.id = item_id and mcsp.is_hall_manager_of(p.hall_id)))
  );

-- validity_changes: append-only audit trail — admin/dept-admin read only, no
-- direct write policy (only the two RPCs insert here).
drop policy if exists "mcsp_validity_changes_select" on mcsp.validity_changes;
create policy "mcsp_validity_changes_select" on mcsp.validity_changes for select to authenticated
  using (core.is_admin() or core.is_department_admin('mcsp'));

-- notifications: recipient reads/marks their own; admin/dept-admin read all.
-- No insert policy — system-generated only (RPC/service role).
drop policy if exists "mcsp_notifications_select" on mcsp.notifications;
create policy "mcsp_notifications_select" on mcsp.notifications for select to authenticated
  using (recipient_id = auth.uid() or core.is_admin() or core.is_department_admin('mcsp'));

drop policy if exists "mcsp_notifications_update" on mcsp.notifications;
create policy "mcsp_notifications_update" on mcsp.notifications for update to authenticated
  using (recipient_id = auth.uid() or core.is_admin() or core.is_department_admin('mcsp'));

-- storage: mcsp-images bucket — upload/update by any mcsp member; delete by
-- admin/dept-admin/hall-manager only (RPCs/set_*_image() check real
-- ownership before pointing a row at an uploaded object).
drop policy if exists "mcsp_images_upload" on storage.objects;
create policy "mcsp_images_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mcsp-images'
    and exists (select 1 from core.users u where u.id = auth.uid() and 'mcsp' = any(u.departments))
  );

drop policy if exists "mcsp_images_update" on storage.objects;
create policy "mcsp_images_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'mcsp-images'
    and exists (select 1 from core.users u where u.id = auth.uid() and 'mcsp' = any(u.departments))
  );

drop policy if exists "mcsp_images_delete" on storage.objects;
create policy "mcsp_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'mcsp-images'
    and (
      core.is_admin() or core.is_department_admin('mcsp')
      or exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'manager' and 'mcsp' = any(u.departments))
    )
  );
