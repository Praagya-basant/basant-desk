-- Sibling to 0009/0010 — same 'mcsp' -> 'sales' department-literal swap,
-- applied to the panel workflow + validity + shift RPCs via CREATE OR
-- REPLACE (signatures unchanged, existing grants/ACLs preserved).

create or replace function mcsp.checkout_panel(
  p_panel_id uuid, p_picked_by_name text, p_picked_by_email text, p_destination text,
  p_reason text, p_reason_other text, p_notes text, p_photo_url text default null,
  p_signature_url text default null, p_purchaser_name text default null,
  p_supplier_name text default null, p_movement_id uuid default null, p_quantity integer default null
)
returns mcsp.panel_movements
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_hall_id uuid;
  v_current_status text;
  v_dest_hall_id uuid;
  v_movement mcsp.panel_movements;
begin
  select hall_id, status into v_hall_id, v_current_status from mcsp.panels where id = p_panel_id;
  if v_hall_id is null then raise exception 'Panel not found'; end if;
  if not (core.is_admin() or core.is_department_admin('sales')) and not mcsp.is_hall_manager_of(v_hall_id) then
    raise exception 'Not authorized to check out this panel';
  end if;
  if v_current_status = 'issued' then raise exception 'Panel is already issued'; end if;
  if v_current_status = 'retired' then raise exception 'Panel is retired'; end if;
  select id into v_dest_hall_id from mcsp.halls where name = p_destination;
  update mcsp.panels set status = 'issued' where id = p_panel_id;
  insert into mcsp.panel_movements (
    id, panel_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name, quantity
  ) values (
    coalesce(p_movement_id, gen_random_uuid()), p_panel_id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, ''), p_quantity
  ) returning * into v_movement;
  return v_movement;
end;
$$;

create or replace function mcsp.return_panel(p_movement_id uuid)
returns mcsp.panel_movements
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_hall_id uuid;
  v_movement mcsp.panel_movements;
begin
  select p.hall_id into v_hall_id from mcsp.panel_movements m join mcsp.panels p on p.id = m.panel_id where m.id = p_movement_id;
  if v_hall_id is null then raise exception 'Movement not found'; end if;
  if not (core.is_admin() or core.is_department_admin('sales')) and not mcsp.is_hall_manager_of(v_hall_id) then
    raise exception 'Not authorized to return this panel';
  end if;
  update mcsp.panel_movements set status = 'returned', returned_at = now() where id = p_movement_id and status = 'out' returning * into v_movement;
  if v_movement.id is null then raise exception 'Movement already returned or not found'; end if;
  update mcsp.panels set status = 'in_hall' where id = v_movement.panel_id;
  return v_movement;
end;
$$;

create or replace function mcsp.forward_panel(
  p_movement_id uuid, p_picked_by_name text, p_picked_by_email text, p_destination text,
  p_reason text, p_reason_other text, p_notes text, p_photo_url text default null,
  p_signature_url text default null, p_purchaser_name text default null,
  p_supplier_name text default null, p_new_movement_id uuid default null, p_quantity integer default null
)
returns mcsp.panel_movements
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_panel mcsp.panels;
  v_old_movement mcsp.panel_movements;
  v_old_hall_id uuid;
  v_dest_hall_id uuid;
  v_new_movement mcsp.panel_movements;
begin
  select p.* into v_panel from mcsp.panel_movements m join mcsp.panels p on p.id = m.panel_id where m.id = p_movement_id;
  if v_panel.id is null then raise exception 'Movement not found'; end if;
  if v_panel.status <> 'issued' then raise exception 'Panel is not currently issued'; end if;
  if not (core.is_admin() or core.is_department_admin('sales')) and not mcsp.is_hall_manager_of(v_panel.hall_id) then
    raise exception 'Not authorized to forward this panel';
  end if;
  update mcsp.panel_movements set status = 'returned', returned_at = now() where id = p_movement_id and status = 'out' returning * into v_old_movement;
  if v_old_movement.id is null then raise exception 'Movement already closed or not found'; end if;
  v_old_hall_id := v_panel.hall_id;
  select id into v_dest_hall_id from mcsp.halls where name = p_destination;
  if v_dest_hall_id is not null then update mcsp.panels set hall_id = v_dest_hall_id where id = v_panel.id; end if;
  insert into mcsp.panel_movements (
    id, panel_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name, hop_number, quantity
  ) values (
    coalesce(p_new_movement_id, gen_random_uuid()), v_panel.id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_old_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, ''), v_old_movement.hop_number + 1, p_quantity
  ) returning * into v_new_movement;
  return v_new_movement;
end;
$$;

create or replace function mcsp.retire_panel(p_panel_id uuid, p_reason text)
returns mcsp.panels
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_panel mcsp.panels;
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then raise exception 'Only admins can retire panels'; end if;
  select * into v_panel from mcsp.panels where id = p_panel_id;
  if v_panel.id is null then raise exception 'Panel not found'; end if;
  if v_panel.status = 'issued' then raise exception 'Cannot retire a panel that is currently issued — return it first'; end if;
  if v_panel.status = 'retired' then raise exception 'Panel is already retired'; end if;
  update mcsp.panels set status = 'retired', retired_reason = nullif(p_reason, ''), retired_at = now(), retired_by = auth.uid()
  where id = p_panel_id returning * into v_panel;
  return v_panel;
end;
$$;

create or replace function mcsp.set_panel_image(p_panel_id uuid, p_image_url text)
returns mcsp.panels
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_buyer_id uuid;
  v_is_shared boolean;
  v_panel mcsp.panels;
begin
  select buyer_id, is_shared into v_buyer_id, v_is_shared from mcsp.panels where id = p_panel_id;
  if v_buyer_id is null then raise exception 'Panel not found'; end if;
  if not (core.is_admin() or core.is_department_admin('sales'))
     and not (v_is_shared and exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'merchant' and 'sales' = any(u.departments)))
     and not mcsp.owns_buyer(v_buyer_id) then
    raise exception 'Not authorized to update this panel';
  end if;
  update mcsp.panels set image_url = p_image_url where id = p_panel_id returning * into v_panel;
  return v_panel;
end;
$$;

create or replace function mcsp.admin_update_validity(
  p_item_type text, p_item_id uuid, p_new_expiry_date date, p_reason text
)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_old_expiry date;
  v_reason text;
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then raise exception 'Only admins can manage validity'; end if;
  if p_item_type = 'sample' then
    select expiry_date into v_old_expiry from mcsp.samples where id = p_item_id;
    if not found then raise exception 'Sample not found'; end if;
    update mcsp.samples set expiry_date = p_new_expiry_date where id = p_item_id;
  elsif p_item_type = 'panel' then
    select expiry_date into v_old_expiry from mcsp.panels where id = p_item_id;
    if not found then raise exception 'Panel not found'; end if;
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
  v_is_dept_admin boolean := core.is_admin() or core.is_department_admin('sales');
  v_caller_name text;
  v_reason text;
begin
  select * into v_request from mcsp.validity_requests where id = p_request_id and status = 'pending';
  if not found then raise exception 'Request not found or already reviewed'; end if;
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
  if not (core.is_admin() or core.is_department_admin('sales')) then raise exception 'Only admins can review shift requests'; end if;
  select * into v_request from mcsp.shift_requests where id = p_request_id and status = 'pending';
  if not found then raise exception 'Request not found or already reviewed'; end if;
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
$$;
