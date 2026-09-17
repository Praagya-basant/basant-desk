-- 0016_mcsp_manager_reviews_and_data_integrity.sql
--
-- Audit 2026-09-08, P1/P2:
--   4  — hall managers can review shift requests for their own hall
--   16 — hall manager / assigned merchant can read an item's validity_changes
--   27 — unique buyer / hall names (they are the scoping key, matched by name)
--   28 — current_hall_id() tolerant of case / whitespace differences

-- ── 4 — review_shift_request: admin OR the from/to hall's manager ───────────
create or replace function mcsp.review_shift_request(p_request_id uuid, p_approve boolean, p_admin_note text default null::text)
returns mcsp.shift_requests
language plpgsql
security definer
set search_path to 'mcsp', 'core', 'pg_temp'
as $function$
declare
  v_request mcsp.shift_requests;
  v_sample mcsp.samples;
  v_panel mcsp.panels;
  v_to_hall_name text;
begin
  select * into v_request from mcsp.shift_requests where id = p_request_id and status = 'pending';
  if not found then raise exception 'Request not found or already reviewed'; end if;

  if not (
    core.is_admin() or core.is_department_admin('sales')
    or mcsp.is_hall_manager_of(v_request.from_hall_id)
    or mcsp.is_hall_manager_of(v_request.to_hall_id)
  ) then
    raise exception 'Only admins or the item''s hall manager can review shift requests';
  end if;

  if p_approve then
    select name into v_to_hall_name from mcsp.halls where id = v_request.to_hall_id;
    if v_request.item_type = 'sample' then
      select * into v_sample from mcsp.samples where id = v_request.item_id;
      if v_sample.id is null then raise exception 'Sample not found'; end if;
      if v_sample.status <> 'in_hall' or v_sample.hall_id <> v_request.from_hall_id then
        raise exception 'Sample has moved since this request was raised';
      end if;
      update mcsp.samples set hall_id = v_request.to_hall_id where id = v_sample.id;
      insert into mcsp.movements (
        sample_id, picked_by_name, picked_by_email, destination, reason, notes,
        logged_by, status, picked_at, returned_at, from_hall_id, destination_hall_id, hop_number
      ) values (
        v_sample.id, 'Hall Shift', null, coalesce(v_to_hall_name, ''), 'Hall Shift', nullif(v_request.note, ''),
        auth.uid(), 'returned', now(), now(), v_request.from_hall_id, v_request.to_hall_id, 1
      );
    else
      select * into v_panel from mcsp.panels where id = v_request.item_id;
      if v_panel.id is null then raise exception 'Panel not found'; end if;
      if v_panel.status <> 'in_hall' or v_panel.hall_id <> v_request.from_hall_id then
        raise exception 'Panel has moved since this request was raised';
      end if;
      update mcsp.panels set hall_id = v_request.to_hall_id where id = v_panel.id;
      insert into mcsp.panel_movements (
        panel_id, picked_by_name, picked_by_email, destination, reason, notes,
        logged_by, status, picked_at, returned_at, from_hall_id, destination_hall_id, hop_number
      ) values (
        v_panel.id, 'Hall Shift', null, coalesce(v_to_hall_name, ''), 'Hall Shift', nullif(v_request.note, ''),
        auth.uid(), 'returned', now(), now(), v_request.from_hall_id, v_request.to_hall_id, 1
      );
    end if;
  end if;

  update mcsp.shift_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      approved_by = auth.uid(), approved_at = now(), admin_note = p_admin_note
  where id = p_request_id
  returning * into v_request;
  return v_request;
end;
$function$;

revoke execute on function mcsp.review_shift_request(uuid, boolean, text) from public;
grant execute on function mcsp.review_shift_request(uuid, boolean, text) to authenticated;

-- Let hall managers action their hall's pending requests from the UI. The RPC
-- above is the real gate; this policy just lets the row-status write through.
drop policy if exists mcsp_shift_requests_update on mcsp.shift_requests;
create policy mcsp_shift_requests_update on mcsp.shift_requests
  for update to authenticated
  using (
    core.is_admin() or core.is_department_admin('sales')
    or mcsp.is_hall_manager_of(from_hall_id) or mcsp.is_hall_manager_of(to_hall_id)
  )
  with check (
    core.is_admin() or core.is_department_admin('sales')
    or mcsp.is_hall_manager_of(from_hall_id) or mcsp.is_hall_manager_of(to_hall_id)
  );

-- ── 16 — validity_changes visible to the item's hall manager / merchant ─────
drop policy if exists mcsp_validity_changes_select on mcsp.validity_changes;
create policy mcsp_validity_changes_select on mcsp.validity_changes
  for select to authenticated
  using (
    core.is_admin()
    or core.is_department_admin('sales')
    or core.has_department_permission('sales')
    or (item_type = 'sample' and exists (
      select 1 from mcsp.samples s
      where s.id = validity_changes.item_id
        and (mcsp.is_hall_manager_of(s.hall_id) or mcsp.owns_buyer(s.buyer_id))
    ))
    or (item_type = 'panel' and exists (
      select 1 from mcsp.panels p
      where p.id = validity_changes.item_id
        and (mcsp.is_hall_manager_of(p.hall_id) or p.is_shared or mcsp.owns_buyer(p.buyer_id))
    ))
  );

-- ── 27 — buyer / hall names must be unique (case-insensitive) ───────────────
create unique index if not exists mcsp_buyers_name_lower_key on mcsp.buyers (lower(btrim(name)));
create unique index if not exists mcsp_halls_name_lower_key on mcsp.halls (lower(btrim(name)));
create unique index if not exists mcsp_halls_number_key on mcsp.halls (hall_number);

-- ── 28 — current_hall_id(): tolerate case / surrounding whitespace ──────────
create or replace function mcsp.current_hall_id()
returns uuid
language sql
stable security definer
set search_path to 'mcsp', 'core', 'pg_temp'
as $function$
  select h.id from mcsp.halls h
  join core.users u on lower(btrim(u.hall)) = lower(btrim(h.name))
  where u.id = auth.uid();
$function$;

notify pgrst, 'reload schema';
