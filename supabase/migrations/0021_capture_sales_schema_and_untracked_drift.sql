-- 0021_capture_sales_schema_and_untracked_drift.sql
--
-- Reverse-engineered from the live `basant-desk` database (2026-09-18). None
-- of the objects below were ever applied through this migrations folder —
-- they were built directly against Supabase outside any tracked session, so
-- `supabase/migrations` had drifted from reality. This migration brings the
-- two back in sync by recreating, verbatim, what already exists live:
--
--   - a brand-new `sales` schema (sales.users / sales.email_groups /
--     sales.settings) — early scaffolding for a future notifications
--     feature. RLS is enabled on all three tables but NO policies exist, and
--     there are NO grants to `authenticated`/`anon` (only the default
--     postgres/service_role access) — so right now this schema is fully
--     inert from the app's perspective (nothing in this repo queries it).
--     It is also NOT yet added to Supabase -> Settings -> API -> Exposed
--     schemas, matching its current dead state. Do not wire it up as part
--     of this migration — that's a deliberate future step.
--   - four new columns on `core.users` (number, designation, is_active,
--     is_placeholder) that were never migrated when they were added.
--   - a new `mcsp.users` table (per-user MCSP/Sales role + notification
--     prefs, separate from `core.users`) plus `mcsp.buyers.buyer_code` and
--     `mcsp.halls.hod_user_id` columns that reference it.
--   - two reporting views, `mcsp.user_full_view` and `mcsp.buyer_full_view`.
--
-- Faithful capture, not a cleanup: `mcsp.users` carries two overlapping
-- mcsp_role CHECK constraints (mcsp_users_mcsp_role_check restricts to
-- hod/merchant/viewer; users_mcsp_role_check separately allows
-- hod/merchant/sales_admin/sales_head/viewer) — since both apply, the
-- effective allowed set is just the first, narrower one. Reproduced as-is
-- rather than silently fixed, since resolving it is a business-logic call
-- this migration isn't scoped to make.
--
-- SECURITY NOTE (flagged, not fixed here): both views are owned by
-- `postgres` (not `security_invoker`), so they read their underlying tables
-- with the owner's row-level-security bypass — and `anon` already has
-- SELECT on both live. That means the public anon key can currently read
-- every user's email/phone/designation/department/WhatsApp number and every
-- buyer's sample/panel counts with no login. This predates this migration;
-- flagging it here so it isn't missed. Recommend revoking `anon` SELECT on
-- both views (and reviewing whether `authenticated` needs the full row
-- shape either) as a follow-up.

-- ── sales schema (new, currently unused by the app) ─────────────────────

create schema if not exists sales;

create table if not exists sales.users (
  user_id uuid primary key references core.users(id) on delete cascade,
  sales_role text not null check (sales_role in ('sales_admin', 'sales_head', 'viewer')),
  notify_on_expiry boolean default true,
  notify_on_shift boolean default true,
  notify_on_validity boolean default true,
  notification_email text,
  whatsapp_number text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  buyer_ids uuid[] default '{}'::uuid[]
);

create table if not exists sales.email_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  user_id uuid references sales.users(user_id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists sales.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table sales.users enable row level security;
alter table sales.email_groups enable row level security;
alter table sales.settings enable row level security;
-- No policies yet — matches live state. No authenticated/anon grants either,
-- so this schema is inert until a future session deliberately wires it up.

-- ── core.users: untracked columns ────────────────────────────────────────

alter table core.users add column if not exists number text;
alter table core.users add column if not exists designation text;
alter table core.users add column if not exists is_active boolean not null default true;
alter table core.users add column if not exists is_placeholder boolean not null default false;

-- ── mcsp.users: untracked table (per-user MCSP role + notification prefs,
--    separate from core.users) ─────────────────────────────────────────────

create table if not exists mcsp.users (
  user_id uuid primary key references core.users(id) on delete cascade,
  mcsp_role text not null,
  hall_id uuid references mcsp.halls(id),
  buyer_ids uuid[] default '{}'::uuid[],
  notify_on_issue boolean default true,
  notify_on_return boolean default true,
  notify_on_expiry boolean default true,
  notification_email text,
  whatsapp_number text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint mcsp_users_mcsp_role_check check (mcsp_role in ('hod', 'merchant', 'viewer')),
  constraint users_mcsp_role_check check (mcsp_role in ('hod', 'merchant', 'sales_admin', 'sales_head', 'viewer'))
);

alter table mcsp.users enable row level security;
-- No policies yet — matches live state (RLS enabled + zero policies denies
-- all rows to authenticated/anon regardless of the broad table grants those
-- roles already hold via migration 0014's default-privileges rule).

-- ── mcsp.buyers / mcsp.halls: untracked columns ─────────────────────────

alter table mcsp.buyers add column if not exists buyer_code text;
alter table mcsp.halls add column if not exists hod_user_id uuid references mcsp.users(user_id);

-- ── Reporting views (untracked) ──────────────────────────────────────────

create or replace view mcsp.buyer_full_view as
select
  b.id,
  b.name,
  b.buyer_code,
  b.created_at,
  count(s.id) as sample_count,
  count(p.id) as panel_count
from mcsp.buyers b
left join mcsp.samples s on s.buyer_id = b.id
left join mcsp.panels p on p.buyer_id = b.id
group by b.id, b.name, b.buyer_code, b.created_at;

create or replace view mcsp.user_full_view as
select
  cu.id,
  cu.full_name,
  cu.email,
  cu.role as platform_role,
  cu.departments,
  cu.number,
  cu.designation,
  cu.is_active as platform_active,
  su.sales_role,
  su.buyer_ids,
  su.notify_on_expiry,
  su.notify_on_shift,
  su.notify_on_validity,
  su.notification_email as sales_notification_email,
  su.whatsapp_number as sales_whatsapp,
  su.is_active as sales_active,
  mu.mcsp_role,
  mu.hall_id,
  mu.notify_on_issue,
  mu.notify_on_return,
  mu.notification_email as mcsp_notification_email,
  h.name as hall_name
from core.users cu
left join sales.users su on su.user_id = cu.id
left join mcsp.users mu on mu.user_id = cu.id
left join mcsp.halls h on h.id = mu.hall_id
where 'sales' = any(cu.departments) or cu.role = 'admin';

notify pgrst, 'reload schema';
