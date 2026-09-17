-- Sibling to 0009 — same 'mcsp' -> 'sales' department-literal swap, applied
-- to the sample-side RPCs via CREATE OR REPLACE (signatures unchanged, so
-- existing grants/ACLs from 0004/0008 are preserved automatically).

create or replace function mcsp.checkout_sample(
  p_sample_id uuid, p_picked_by_name text, p_picked_by_email text, p_destination text,
  p_reason text, p_reason_other text, p_notes text, p_photo_url text default null,
  p_signature_url text default null, p_purchaser_name text default null,
  p_supplier_name text default null, p_movement_id uuid default null
)
returns mcsp.movements
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_hall_id uuid;
  v_current_status text;
  v_dest_hall_id uuid;
  v_movement mcsp.movements;
begin
  select hall_id, status into v_hall_id, v_current_status from mcsp.samples where id = p_sample_id;
  if v_hall_id is null then raise exception 'Sample not found'; end if;
  if not (core.is_admin() or core.is_department_admin('sales')) and not mcsp.is_hall_manager_of(v_hall_id) then
    raise exception 'Not authorized to check out this sample';
  end if;
  if v_current_status = 'checked_out' then raise exception 'Sample is already checked out'; end if;
  select id into v_dest_hall_id from mcsp.halls where name = p_destination;
  update mcsp.samples set status = 'checked_out' where id = p_sample_id;
  insert into mcsp.movements (
    id, sample_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name
  ) values (
    coalesce(p_movement_id, gen_random_uuid()), p_sample_id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, '')
  ) returning * into v_movement;
  return v_movement;
end;
$$;

create or replace function mcsp.return_sample(p_movement_id uuid)
returns mcsp.movements
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_hall_id uuid;
  v_movement mcsp.movements;
begin
  select s.hall_id into v_hall_id from mcsp.movements m join mcsp.samples s on s.id = m.sample_id where m.id = p_movement_id;
  if v_hall_id is null then raise exception 'Movement not found'; end if;
  if not (core.is_admin() or core.is_department_admin('sales')) and not mcsp.is_hall_manager_of(v_hall_id) then
    raise exception 'Not authorized to return this sample';
  end if;
  update mcsp.movements set status = 'returned', returned_at = now() where id = p_movement_id and status = 'out' returning * into v_movement;
  if v_movement.id is null then raise exception 'Movement already returned or not found'; end if;
  update mcsp.samples set status = 'in_hall' where id = v_movement.sample_id;
  return v_movement;
end;
$$;

create or replace function mcsp.forward_sample(
  p_movement_id uuid, p_picked_by_name text, p_picked_by_email text, p_destination text,
  p_reason text, p_reason_other text, p_notes text, p_photo_url text default null,
  p_signature_url text default null, p_purchaser_name text default null,
  p_supplier_name text default null, p_new_movement_id uuid default null
)
returns mcsp.movements
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_sample mcsp.samples;
  v_old_movement mcsp.movements;
  v_old_hall_id uuid;
  v_dest_hall_id uuid;
  v_new_movement mcsp.movements;
begin
  select s.* into v_sample from mcsp.movements m join mcsp.samples s on s.id = m.sample_id where m.id = p_movement_id;
  if v_sample.id is null then raise exception 'Movement not found'; end if;
  if v_sample.status <> 'checked_out' then raise exception 'Sample is not currently checked out'; end if;
  if not (core.is_admin() or core.is_department_admin('sales')) and not mcsp.is_hall_manager_of(v_sample.hall_id) then
    raise exception 'Not authorized to forward this sample';
  end if;
  update mcsp.movements set status = 'returned', returned_at = now() where id = p_movement_id and status = 'out' returning * into v_old_movement;
  if v_old_movement.id is null then raise exception 'Movement already closed or not found'; end if;
  v_old_hall_id := v_sample.hall_id;
  select id into v_dest_hall_id from mcsp.halls where name = p_destination;
  if v_dest_hall_id is not null then update mcsp.samples set hall_id = v_dest_hall_id where id = v_sample.id; end if;
  insert into mcsp.movements (
    id, sample_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name, hop_number
  ) values (
    coalesce(p_new_movement_id, gen_random_uuid()), v_sample.id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_old_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, ''), v_old_movement.hop_number + 1
  ) returning * into v_new_movement;
  return v_new_movement;
end;
$$;

create or replace function mcsp.clear_movement_history()
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then raise exception 'Only admins can clear movement history'; end if;
  update mcsp.samples set status = 'in_hall' where status = 'checked_out';
  delete from mcsp.movements where true;
end;
$$;

create or replace function mcsp.set_sample_image(p_sample_id uuid, p_image_url text)
returns mcsp.samples
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_buyer_id uuid;
  v_sample mcsp.samples;
begin
  select buyer_id into v_buyer_id from mcsp.samples where id = p_sample_id;
  if v_buyer_id is null then raise exception 'Sample not found'; end if;
  if not (core.is_admin() or core.is_department_admin('sales')) and not mcsp.owns_buyer(v_buyer_id) then
    raise exception 'Not authorized to update this sample';
  end if;
  update mcsp.samples set image_url = p_image_url where id = p_sample_id returning * into v_sample;
  return v_sample;
end;
$$;

create or replace function mcsp.delete_sample(p_sample_id uuid)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_status text;
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then raise exception 'Only admins can delete samples'; end if;
  select status into v_status from mcsp.samples where id = p_sample_id;
  if v_status is null then raise exception 'Sample not found'; end if;
  if v_status = 'checked_out' then raise exception 'Cannot delete a sample that is currently issued'; end if;
  delete from mcsp.recall_requests where sample_id = p_sample_id;
  delete from mcsp.sample_comments where sample_id = p_sample_id;
  delete from mcsp.movements where sample_id = p_sample_id;
  delete from mcsp.samples where id = p_sample_id;
end;
$$;

create or replace function mcsp.delete_buyer(p_buyer_id uuid)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then raise exception 'Only admins can delete buyers'; end if;
  if not exists (select 1 from mcsp.buyers where id = p_buyer_id) then raise exception 'Buyer not found'; end if;
  if exists (select 1 from mcsp.samples where buyer_id = p_buyer_id and status = 'checked_out') then
    raise exception 'Cannot delete a buyer with samples currently issued';
  end if;
  if exists (select 1 from mcsp.panels where buyer_id = p_buyer_id and status = 'issued') then
    raise exception 'Cannot delete a buyer with panels currently issued';
  end if;
  delete from mcsp.recall_requests where sample_id in (select id from mcsp.samples where buyer_id = p_buyer_id);
  delete from mcsp.sample_comments where sample_id in (select id from mcsp.samples where buyer_id = p_buyer_id);
  delete from mcsp.movements where sample_id in (select id from mcsp.samples where buyer_id = p_buyer_id);
  delete from mcsp.samples where buyer_id = p_buyer_id;
  delete from mcsp.panel_movements where panel_id in (select id from mcsp.panels where buyer_id = p_buyer_id);
  delete from mcsp.panels where buyer_id = p_buyer_id;
  delete from mcsp.buyers where id = p_buyer_id;
end;
$$;
