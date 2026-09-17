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

  if v_hall_id is null then
    raise exception 'Panel not found';
  end if;

  if not (core.is_admin() or core.is_department_admin('mcsp')) and not mcsp.is_hall_manager_of(v_hall_id) then
    raise exception 'Not authorized to check out this panel';
  end if;

  if v_current_status = 'issued' then
    raise exception 'Panel is already issued';
  end if;
  if v_current_status = 'retired' then
    raise exception 'Panel is retired';
  end if;

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
  select p.hall_id into v_hall_id
  from mcsp.panel_movements m join mcsp.panels p on p.id = m.panel_id
  where m.id = p_movement_id;

  if v_hall_id is null then
    raise exception 'Movement not found';
  end if;

  if not (core.is_admin() or core.is_department_admin('mcsp')) and not mcsp.is_hall_manager_of(v_hall_id) then
    raise exception 'Not authorized to return this panel';
  end if;

  update mcsp.panel_movements
  set status = 'returned', returned_at = now()
  where id = p_movement_id and status = 'out'
  returning * into v_movement;

  if v_movement.id is null then
    raise exception 'Movement already returned or not found';
  end if;

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
  select p.* into v_panel
  from mcsp.panel_movements m join mcsp.panels p on p.id = m.panel_id
  where m.id = p_movement_id;

  if v_panel.id is null then
    raise exception 'Movement not found';
  end if;

  if v_panel.status <> 'issued' then
    raise exception 'Panel is not currently issued';
  end if;

  if not (core.is_admin() or core.is_department_admin('mcsp')) and not mcsp.is_hall_manager_of(v_panel.hall_id) then
    raise exception 'Not authorized to forward this panel';
  end if;

  update mcsp.panel_movements
  set status = 'returned', returned_at = now()
  where id = p_movement_id and status = 'out'
  returning * into v_old_movement;

  if v_old_movement.id is null then
    raise exception 'Movement already closed or not found';
  end if;

  v_old_hall_id := v_panel.hall_id;
  select id into v_dest_hall_id from mcsp.halls where name = p_destination;

  if v_dest_hall_id is not null then
    update mcsp.panels set hall_id = v_dest_hall_id where id = v_panel.id;
  end if;

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
  if not (core.is_admin() or core.is_department_admin('mcsp')) then
    raise exception 'Only admins can retire panels';
  end if;

  select * into v_panel from mcsp.panels where id = p_panel_id;
  if v_panel.id is null then
    raise exception 'Panel not found';
  end if;
  if v_panel.status = 'issued' then
    raise exception 'Cannot retire a panel that is currently issued — return it first';
  end if;
  if v_panel.status = 'retired' then
    raise exception 'Panel is already retired';
  end if;

  update mcsp.panels
  set status = 'retired', retired_reason = nullif(p_reason, ''), retired_at = now(), retired_by = auth.uid()
  where id = p_panel_id
  returning * into v_panel;

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

  if v_buyer_id is null then
    raise exception 'Panel not found';
  end if;

  if not (core.is_admin() or core.is_department_admin('mcsp'))
     and not (v_is_shared and exists (select 1 from core.users u where u.id = auth.uid() and u.role = 'merchant' and 'mcsp' = any(u.departments)))
     and not mcsp.owns_buyer(v_buyer_id) then
    raise exception 'Not authorized to update this panel';
  end if;

  update mcsp.panels set image_url = p_image_url where id = p_panel_id
  returning * into v_panel;

  return v_panel;
end;
$$;

grant execute on function mcsp.checkout_panel to authenticated;
grant execute on function mcsp.return_panel to authenticated;
grant execute on function mcsp.forward_panel to authenticated;
grant execute on function mcsp.retire_panel to authenticated;
grant execute on function mcsp.set_panel_image to authenticated;
