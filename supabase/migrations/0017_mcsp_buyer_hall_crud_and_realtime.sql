-- 0017_mcsp_buyer_hall_crud_and_realtime.sql
--
-- Audit 2026-09-08, P2:
--   26 — Buyers / Halls need rename + guarded delete (were add-only)
--   30 — notification bell realtime subscription needs the table published
--
-- delete_buyer previously CASCADE-deleted every sample/panel/movement for the
-- buyer if none were currently issued — far too destructive for a stray click.
-- It now refuses whenever ANY sample or panel still references the buyer; the
-- admin must remove or reassign those first.

create or replace function mcsp.delete_buyer(p_buyer_id uuid)
returns void
language plpgsql
security definer
set search_path to 'mcsp', 'core', 'pg_temp'
as $function$
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then
    raise exception 'Only admins can delete buyers';
  end if;
  if not exists (select 1 from mcsp.buyers where id = p_buyer_id) then
    raise exception 'Buyer not found';
  end if;
  if exists (select 1 from mcsp.samples where buyer_id = p_buyer_id) then
    raise exception 'This buyer still has samples — remove or reassign them first';
  end if;
  if exists (select 1 from mcsp.panels where buyer_id = p_buyer_id) then
    raise exception 'This buyer still has panels — remove or reassign them first';
  end if;
  delete from mcsp.buyers where id = p_buyer_id;
end;
$function$;

create or replace function mcsp.update_buyer(p_buyer_id uuid, p_name text)
returns mcsp.buyers
language plpgsql
security definer
set search_path to 'mcsp', 'core', 'pg_temp'
as $function$
declare v_row mcsp.buyers;
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then
    raise exception 'Only admins can rename buyers';
  end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Name is required'; end if;
  update mcsp.buyers set name = btrim(p_name) where id = p_buyer_id returning * into v_row;
  if not found then raise exception 'Buyer not found'; end if;
  return v_row;
end;
$function$;

create or replace function mcsp.update_hall(p_hall_id uuid, p_hall_number integer, p_name text)
returns mcsp.halls
language plpgsql
security definer
set search_path to 'mcsp', 'core', 'pg_temp'
as $function$
declare v_row mcsp.halls;
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then
    raise exception 'Only admins can edit halls';
  end if;
  if btrim(coalesce(p_name, '')) = '' or coalesce(p_hall_number, 0) <= 0 then
    raise exception 'Hall number and name are required';
  end if;
  update mcsp.halls set hall_number = p_hall_number, name = btrim(p_name)
  where id = p_hall_id returning * into v_row;
  if not found then raise exception 'Hall not found'; end if;
  return v_row;
end;
$function$;

create or replace function mcsp.delete_hall(p_hall_id uuid)
returns void
language plpgsql
security definer
set search_path to 'mcsp', 'core', 'pg_temp'
as $function$
begin
  if not (core.is_admin() or core.is_department_admin('sales')) then
    raise exception 'Only admins can delete halls';
  end if;
  if not exists (select 1 from mcsp.halls where id = p_hall_id) then
    raise exception 'Hall not found';
  end if;
  if exists (select 1 from mcsp.samples where hall_id = p_hall_id)
     or exists (select 1 from mcsp.panels where hall_id = p_hall_id) then
    raise exception 'This hall still holds samples or panels — move them first';
  end if;
  delete from mcsp.halls where id = p_hall_id;
end;
$function$;

revoke execute on function mcsp.delete_buyer(uuid) from public;
revoke execute on function mcsp.update_buyer(uuid, text) from public;
revoke execute on function mcsp.update_hall(uuid, integer, text) from public;
revoke execute on function mcsp.delete_hall(uuid) from public;
grant execute on function mcsp.delete_buyer(uuid) to authenticated;
grant execute on function mcsp.update_buyer(uuid, text) to authenticated;
grant execute on function mcsp.update_hall(uuid, integer, text) to authenticated;
grant execute on function mcsp.delete_hall(uuid) to authenticated;

-- ── 30 — publish mcsp.notifications so the bell's realtime channel fires ────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'mcsp' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table mcsp.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
