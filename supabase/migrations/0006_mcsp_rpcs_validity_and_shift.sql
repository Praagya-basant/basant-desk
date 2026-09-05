-- Validity management + hall-shift approval RPCs — same logic as the
-- original app's admin_update_validity / review_validity_request (hall
-- manager can approve items in their own hall) / review_shift_request
-- (branches on item_type, updates the item's home hall, logs a closed
-- "Hall Shift" movement row as the audit trail).

create or replace function mcsp.admin_update_validity(
  p_item_type text, p_item_id uuid, p_new_expiry_date date, p_reason text
)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_old_expiry date;
  v_reason text;
begin
  if not (core.is_admin() or core.is_department_admin('mcsp')) then
    raise exception 'Only admins can manage validity';
  end if;

  if p_item_type = 'sample' then
    select expiry_date into v_old_expiry from mcsp.samples where id = p_item_id;
    if not found then
      raise exception 'Sample not found';
    end if;
    update mcsp.samples set expiry_date = p_new_expiry_date where id = p_item_id;
  elsif p_item_type = 'panel' then
    select expiry_date into v_old_expiry from mcsp.panels where id = p_item_id;
    if not found then
      raise exception 'Panel not found';
    end if;
    update mcsp.panels set expiry_date = p_new_expiry_date where id = p_item_id;
  else
    raise exception 'Invalid item type: %', p_item_type;
  end if;

  v_reason := case when p_new_expiry_date < current_date then 'Pre-expired: ' else '' end || coalesce(nullif(p_reason, ''), 'No reason given');

  insert into mcsp.validity_changes (item_type, item_id, changed_by, old_expiry_date, new_expiry_date, reason)
  values (p_item_type, p_item_id, auth.uid(), v_old_expiry, p_new_expiry_date, v_reason);
end;
$$;

create or replace function mcsp.review_validity_request(
  p_request_id uuid, p_approve boolean, p_admin_note text default null
)
returns mcsp.validity_requests
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_request mcsp.validity_requests;
  v_old_expiry date;
  v_new_expiry date;
  v_item_hall_id uuid;
  v_is_dept_admin boolean := core.is_admin() or core.is_department_admin('mcsp');
  v_caller_name text;
  v_reason text;
begin
  select * into v_request from mcsp.validity_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already reviewed';
  end if;

  if v_request.item_type = 'sample' then
    select hall_id into v_item_hall_id from mcsp.samples where id = v_request.item_id;
  else
    select hall_id into v_item_hall_id from mcsp.panels where id = v_request.item_id;
  end if;

  if not v_is_dept_admin and not mcsp.is_hall_manager_of(v_item_hall_id) then
    raise exception 'Only admins or the item''s own hall manager can review validity requests';
  end if;

  if p_approve then
    if v_request.item_type = 'sample' then
      select expiry_date into v_old_expiry from mcsp.samples where id = v_request.item_id;
    else
      select expiry_date into v_old_expiry from mcsp.panels where id = v_request.item_id;
    end if;

    v_new_expiry := coalesce(
      v_request.requested_expiry_date,
      (coalesce(v_old_expiry, current_date) + (coalesce(v_request.requested_months, 0) || ' months')::interval)::date
    );

    if v_request.item_type = 'sample' then
      update mcsp.samples set expiry_date = v_new_expiry where id = v_request.item_id;
    else
      update mcsp.panels set expiry_date = v_new_expiry where id = v_request.item_id;
    end if;

    if not v_is_dept_admin then
      select full_name into v_caller_name from core.users where id = auth.uid();
      v_reason := 'Extended by ' || coalesce(v_caller_name, 'Manager') || ' (Manager) — ' || coalesce(v_request.reason, 'no reason given');
    else
      v_reason := 'Approved request: ' || coalesce(v_request.reason, 'no reason given');
    end if;

    insert into mcsp.validity_changes (item_type, item_id, changed_by, old_expiry_date, new_expiry_date, reason)
    values (v_request.item_type, v_request.item_id, auth.uid(), v_old_expiry, v_new_expiry, v_reason);
  end if;

  update mcsp.validity_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      approved_by = auth.uid(), approved_at = now(), admin_note = p_admin_note
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function mcsp.review_shift_request(
  p_request_id uuid, p_approve boolean, p_admin_note text default null
)
returns mcsp.shift_requests
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_request mcsp.shift_requests;
  v_sample mcsp.samples;
  v_panel mcsp.panels;
  v_to_hall_name text;
begin
  if not (core.is_admin() or core.is_department_admin('mcsp')) then
    raise exception 'Only admins can review shift requests';
  end if;

  select * into v_request from mcsp.shift_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already reviewed';
  end if;

  if p_approve then
    select name into v_to_hall_name from mcsp.halls where id = v_request.to_hall_id;

    if v_request.item_type = 'sample' then
      select * into v_sample from mcsp.samples where id = v_request.item_id;
      if v_sample.id is null then
        raise exception 'Sample not found';
      end if;
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
      if v_panel.id is null then
        raise exception 'Panel not found';
      end if;
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
$$;

grant execute on function mcsp.admin_update_validity to authenticated;
grant execute on function mcsp.review_validity_request to authenticated;
grant execute on function mcsp.review_shift_request to authenticated;
