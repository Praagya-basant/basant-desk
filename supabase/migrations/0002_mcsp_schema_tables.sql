-- MCSP (Master Counter Sample & Panel) — new department schema.
-- Ported from the standalone BASANT MCSP app (Supabase ztxqksvexjonqmfyjijf,
-- "MCP/MCS", live at mcsp.basant.info) into the basant-desk schema-per-
-- department pattern. Column shapes kept as close to the original as
-- practical, for a clean data copy — see docs/mcsp.md for the full mapping.
--
-- Identity comes from core.users, not a separate profiles table:
--   - MCSP super_admin  -> core.users.role='admin' (global) or
--                          role='custom' + department_admin_for @> {mcsp}
--   - MCSP hall_manager -> core.users.role='manager', departments @> {mcsp},
--                          hall = <hall name> (core.users.hall is a plain
--                          text field, matched by name against mcsp.halls)
--   - MCSP merchant     -> core.users.role='merchant', departments @> {mcsp},
--                          buyers = {<buyer name>, ...} (core.users.buyers
--                          is already a text[] free-text field, built for
--                          exactly this — multi-buyer merchants supported
--                          natively, no separate join table needed)
--   - MCSP custom       -> core.users.role='custom', departments @> {mcsp},
--                          fine-grained core.permissions/user_permissions
--                          rows instead of the old custom_permissions jsonb

create schema if not exists mcsp;

create table if not exists mcsp.halls (
  id uuid primary key default gen_random_uuid(),
  hall_number integer not null unique,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists mcsp.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists mcsp.samples (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references mcsp.buyers(id) not null,
  hall_id uuid references mcsp.halls(id) not null,
  bt_code text not null unique,
  product_ref text,
  product_name text not null,
  image_url text,
  status text default 'in_hall' check (status in ('in_hall','checked_out')),
  buyer_code text,
  collection_name text,
  signed_by text,
  signed_date date,
  validity_months integer,
  expiry_date date,
  date_added_to_hall date,
  created_at timestamptz default now()
);

create table if not exists mcsp.movements (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid references mcsp.samples(id) not null,
  picked_by_name text not null,
  picked_by_email text,
  destination text not null,
  reason text not null,
  reason_other text,
  status text default 'out' check (status in ('out','returned')),
  picked_at timestamptz default now(),
  returned_at timestamptz,
  notes text,
  logged_by uuid references core.users(id),
  from_hall_id uuid references mcsp.halls(id),
  destination_hall_id uuid references mcsp.halls(id),
  purchaser_name text,
  supplier_name text,
  photo_url text,
  signature_url text,
  hop_number integer not null default 1
);

create table if not exists mcsp.panels (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references mcsp.buyers(id) not null,
  hall_id uuid references mcsp.halls(id) not null,
  panel_code text not null unique,
  panel_name text not null,
  panel_ref text,
  panel_finish text,
  finish_recipe text,
  collection_name text,
  image_url text,
  status text default 'in_hall' check (status in ('in_hall','issued','retired')),
  is_shared boolean default false,
  signed_by text,
  signed_date date,
  validity_months integer,
  expiry_date date,
  date_added_to_hall date,
  retired_reason text,
  retired_at timestamptz,
  retired_by uuid references core.users(id),
  created_at timestamptz default now()
);

create table if not exists mcsp.panel_movements (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid references mcsp.panels(id) not null,
  from_hall_id uuid references mcsp.halls(id),
  destination text not null,
  destination_hall_id uuid references mcsp.halls(id),
  picked_by_name text not null,
  picked_by_email text,
  reason text not null,
  reason_other text,
  purchaser_name text,
  supplier_name text,
  photo_url text,
  signature_url text,
  quantity integer,
  status text default 'out' check (status in ('out','returned')),
  picked_at timestamptz default now(),
  returned_at timestamptz,
  notes text,
  logged_by uuid references core.users(id),
  hop_number integer not null default 1
);

create table if not exists mcsp.sample_comments (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid references mcsp.samples(id) not null,
  author_id uuid references core.users(id) not null,
  comment text not null,
  created_at timestamptz default now()
);

create table if not exists mcsp.recall_requests (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid references mcsp.samples(id) not null,
  requested_by uuid references core.users(id) not null,
  reason text,
  status text default 'pending' check (status in ('pending','acknowledged','resolved')),
  created_at timestamptz default now()
);

create table if not exists mcsp.shift_requests (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('sample','panel')),
  item_id uuid not null,
  from_hall_id uuid references mcsp.halls(id) not null,
  to_hall_id uuid references mcsp.halls(id) not null,
  requested_by uuid references core.users(id) not null,
  note text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  approved_by uuid references core.users(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists mcsp.validity_requests (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('sample','panel')),
  item_id uuid not null,
  requested_by uuid references core.users(id) not null,
  requested_months integer,
  requested_expiry_date date,
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references core.users(id),
  approved_at timestamptz,
  admin_note text,
  created_at timestamptz default now()
);

create table if not exists mcsp.validity_changes (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('sample','panel')),
  item_id uuid not null,
  changed_by uuid references core.users(id) not null,
  old_expiry_date date,
  new_expiry_date date,
  reason text,
  created_at timestamptz default now()
);

-- In-app bell rows only for now (email/Web Push deferred to a later phase —
-- see docs/mcsp.md roadmap). Kept schema-compatible with that later phase.
create table if not exists mcsp.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references core.users(id) not null,
  title text not null,
  message text not null,
  type text not null,
  item_type text,
  item_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_mcsp_samples_buyer_id on mcsp.samples(buyer_id);
create index if not exists idx_mcsp_samples_hall_id on mcsp.samples(hall_id);
create index if not exists idx_mcsp_samples_status on mcsp.samples(status);
create index if not exists idx_mcsp_samples_expiry_date on mcsp.samples(expiry_date);
create index if not exists idx_mcsp_movements_sample_id on mcsp.movements(sample_id);
create index if not exists idx_mcsp_movements_status on mcsp.movements(status);
create index if not exists idx_mcsp_movements_picked_at on mcsp.movements(picked_at);
create index if not exists idx_mcsp_movements_from_hall_id on mcsp.movements(from_hall_id);
create index if not exists idx_mcsp_movements_destination_hall_id on mcsp.movements(destination_hall_id);
create index if not exists idx_mcsp_panels_buyer_id on mcsp.panels(buyer_id);
create index if not exists idx_mcsp_panels_hall_id on mcsp.panels(hall_id);
create index if not exists idx_mcsp_panels_status on mcsp.panels(status);
create index if not exists idx_mcsp_panels_expiry_date on mcsp.panels(expiry_date);
create index if not exists idx_mcsp_panel_movements_panel_id on mcsp.panel_movements(panel_id);
create index if not exists idx_mcsp_panel_movements_status on mcsp.panel_movements(status);
create index if not exists idx_mcsp_sample_comments_sample_id on mcsp.sample_comments(sample_id);
create index if not exists idx_mcsp_recall_requests_sample_id on mcsp.recall_requests(sample_id);
create index if not exists idx_mcsp_shift_requests_item_id on mcsp.shift_requests(item_id);
create index if not exists idx_mcsp_shift_requests_status on mcsp.shift_requests(status);
create index if not exists idx_mcsp_validity_requests_item_id on mcsp.validity_requests(item_id);
create index if not exists idx_mcsp_validity_requests_status on mcsp.validity_requests(status);
create index if not exists idx_mcsp_validity_changes_item_id on mcsp.validity_changes(item_id);
create index if not exists idx_mcsp_notifications_recipient_id on mcsp.notifications(recipient_id);
create index if not exists idx_mcsp_notifications_is_read on mcsp.notifications(is_read);

-- Public bucket so <img> tags render image_url directly, matching the
-- original app's sample-images bucket. Upload policies added in the RLS pass.
insert into storage.buckets (id, name, public)
values ('mcsp-images', 'mcsp-images', true)
on conflict (id) do nothing;
