-- In-app notification triggers. No email/Resend infra exists in
-- basant-desk yet (unlike the original standalone app) — these write
-- mcsp.notifications rows only, read by a bell UI (mirrors Core
-- Management's notification pattern). SECURITY DEFINER because a regular
-- manager/merchant caller cannot SELECT other users' core.users rows
-- (RLS there only allows reading your own profile) — these functions
-- resolve recipients server-side and insert on their behalf, same
-- shape as the original app's send_validity_alerts() recipient resolution.

create or replace function mcsp.notify_users(
  p_recipient_ids uuid[], p_title text, p_message text, p_type text,
  p_item_type text default null, p_item_id uuid default null
)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
begin
  insert into mcsp.notifications (recipient_id, title, message, type, item_type, item_id)
  select uid, p_title, p_message, p_type, p_item_type, p_item_id
  from unnest(p_recipient_ids) as uid
  where uid is not null;
end;
$$;

grant execute on function mcsp.notify_users to authenticated;
revoke execute on function mcsp.notify_users from public;

-- Sample issued: notify merchants of the buyer + the destination hall's
-- manager (if the destination is a real hall, not Supplier/Other).
create or replace function mcsp.notify_checkout(p_sample_id uuid, p_destination text)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_buyer_name text;
  v_product_name text;
  v_bt_code text;
  v_recipients uuid[];
begin
  select b.name, s.product_name, s.bt_code into v_buyer_name, v_product_name, v_bt_code
  from mcsp.samples s join mcsp.buyers b on b.id = s.buyer_id
  where s.id = p_sample_id;

  select array_agg(distinct u.id) into v_recipients
  from core.users u
  where 'sales' = any(u.departments)
    and (
      (u.role = 'merchant' and v_buyer_name = any(u.buyers))
      or (u.role = 'manager' and u.hall = p_destination)
    );

  perform mcsp.notify_users(
    v_recipients, 'Sample issued', v_bt_code || ' — ' || v_product_name || ' issued to ' || p_destination,
    'checkout', 'sample', p_sample_id
  );
end;
$$;

grant execute on function mcsp.notify_checkout to authenticated;
revoke execute on function mcsp.notify_checkout from public;

-- Sample returned: notify the buyer's merchants.
create or replace function mcsp.notify_return(p_sample_id uuid)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
declare
  v_buyer_name text;
  v_product_name text;
  v_bt_code text;
  v_recipients uuid[];
begin
  select b.name, s.product_name, s.bt_code into v_buyer_name, v_product_name, v_bt_code
  from mcsp.samples s join mcsp.buyers b on b.id = s.buyer_id
  where s.id = p_sample_id;

  select array_agg(distinct u.id) into v_recipients
  from core.users u
  where 'sales' = any(u.departments) and u.role = 'merchant' and v_buyer_name = any(u.buyers);

  perform mcsp.notify_users(
    v_recipients, 'Sample returned', v_bt_code || ' — ' || v_product_name || ' returned to hall',
    'return', 'sample', p_sample_id
  );
end;
$$;

grant execute on function mcsp.notify_return to authenticated;
revoke execute on function mcsp.notify_return from public;

-- Hall shift request raised: notify the *other* party (whichever of the
-- current hall's manager / the item's merchant didn't raise it) plus every
-- Sales admin — mirrors the original app's "raiser excluded" rule.
create or replace function mcsp.notify_shift_requested(p_request_id uuid)
returns void
language plpgsql security definer set search_path = mcsp, core, pg_temp as $$
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

  select array_agg(distinct u.id) into v_recipients
  from core.users u
  where u.id <> v_request.requested_by
    and (
      core.is_admin()
      or ('sales' = any(u.departments) and u.department_admin_for @> array['sales'])
      or ('sales' = any(u.departments) and u.role = 'manager' and u.hall = v_from_hall_name)
      or ('sales' = any(u.departments) and u.role = 'merchant' and v_buyer_name = any(u.buyers))
    );

  perform mcsp.notify_users(
    v_recipients, 'Hall shift requested', 'A hall shift request needs review', 'shift_requested', v_request.item_type, v_request.item_id
  );
end;
$$;

grant execute on function mcsp.notify_shift_requested to authenticated;
revoke execute on function mcsp.notify_shift_requested from public;
