-- 0018_access_control_core.sql
--
-- Centralized access-control system — Phase 1: schema, RLS, resolver, audit.
-- Full design + rules: docs/access-control.md (written in Phase 5).
--
-- This ADDS ON TOP of the existing model. core.users.role, .departments and
-- .department_admin_for keep meaning exactly what they mean today. Legacy
-- core.permissions / core.user_permissions are left frozen (Phase 2 migrates
-- their data out; a later cleanup migration drops them).
--
-- Resolution order for core.module_access_level(user, module) — first match wins:
--   1. users.role = 'admin'                              -> 'admin'
--   2. module.department_key = ANY(department_admin_for)  -> 'admin'
--   3. core.user_module_access row exists                 -> its level (incl. 'none' = deny)
--   4. highest level across assigned roles' grants        -> that level
--   5. department member baseline (manager_baseline if role='manager',
--      else member_baseline), when department_key = ANY(departments)
--   6. otherwise                                          -> 'none'

-- ─────────────────────────────────────────────────────────────────────────────
-- Enum
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type core.access_level as enum ('none','view','edit','approve','admin');
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Every feature/page across every department registers itself here.
create table if not exists core.modules (
  key                text primary key,
  department_key      text not null references core.departments(key),
  label              text not null,
  description        text,
  parent_module_key  text references core.modules(key),
  route              text,
  sort_order         int  not null default 0,
  member_baseline    core.access_level not null default 'none',
  manager_baseline   core.access_level not null default 'edit',
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists modules_department_idx on core.modules(department_key);

-- Reusable, named bundles of module+level grants.
create table if not exists core.roles (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  department_key text references core.departments(key),   -- null = global (Admin only)
  is_system_role boolean not null default false,
  created_by     uuid references core.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
-- Name unique within its scope; NULLS NOT DISTINCT so there can be only one
-- global "Viewer", "Editor", etc. (Postgres 15+).
create unique index if not exists roles_scope_name_key
  on core.roles (department_key, name) nulls not distinct;

create table if not exists core.role_module_access (
  role_id     uuid not null references core.roles(id) on delete cascade,
  module_key  text not null references core.modules(key) on delete cascade,
  level       core.access_level not null,
  primary key (role_id, module_key)
);

create table if not exists core.user_role_assignments (
  user_id     uuid not null references core.users(id) on delete cascade,
  role_id     uuid not null references core.roles(id) on delete cascade,
  assigned_by uuid references core.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Explicit per-user override. Wins over roles (incl. level='none' = deny).
create table if not exists core.user_module_access (
  user_id    uuid not null references core.users(id) on delete cascade,
  module_key text not null references core.modules(key) on delete cascade,
  level      core.access_level not null,
  granted_by uuid references core.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  note       text,
  primary key (user_id, module_key)
);

create table if not exists core.access_change_log (
  id          bigint generated always as identity primary key,
  changed_by  uuid references core.users(id) on delete set null,
  target_user uuid references core.users(id) on delete set null,
  change_type text not null,
  scope       text,
  old_value   jsonb,
  new_value   jsonb,
  changed_at  timestamptz not null default now()
);
create index if not exists access_change_log_target_idx on core.access_change_log(target_user);
create index if not exists access_change_log_changed_at_idx on core.access_change_log(changed_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Small helper predicates (SECURITY DEFINER, search_path pinned — same shape as
-- the existing core.is_admin / is_department_admin helpers).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function core.user_is_global_admin(p_user uuid)
returns boolean language sql stable security definer
set search_path to 'core','pg_temp' as $$
  select exists (select 1 from core.users where id = p_user and role = 'admin');
$$;

-- A dept admin may only manage users who belong to that same department
-- (as a member or as its admin).
create or replace function core.user_in_department(p_user uuid, p_dept text)
returns boolean language sql stable security definer
set search_path to 'core','pg_temp' as $$
  select exists (
    select 1 from core.users u
    where u.id = p_user
      and (p_dept = any(u.departments) or p_dept = any(u.department_admin_for))
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The resolver — used by RLS everywhere and by the admin UI.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function core.module_access_level(p_user uuid, p_module text)
returns core.access_level
language plpgsql stable security definer
set search_path to 'core','pg_temp'
as $$
declare
  v_role        text;
  v_departments text[];
  v_dept_admin  text[];
  v_mod_dept    text;
  v_member      core.access_level;
  v_manager     core.access_level;
  v_override    core.access_level;
  v_role_level  core.access_level;
  v_base        core.access_level;
begin
  select role, coalesce(departments,'{}'::text[]), coalesce(department_admin_for,'{}'::text[])
    into v_role, v_departments, v_dept_admin
    from core.users where id = p_user;
  if not found then return 'none'; end if;

  -- 1. global admin
  if v_role = 'admin' then return 'admin'; end if;

  select department_key, member_baseline, manager_baseline
    into v_mod_dept, v_member, v_manager
    from core.modules where key = p_module and is_active;
  if not found then return 'none'; end if;

  -- 2. department admin → admin on every module in that department
  if v_mod_dept = any(v_dept_admin) then return 'admin'; end if;

  -- 3. explicit per-user override (wins over roles, incl. 'none' = deny)
  select level into v_override
    from core.user_module_access
    where user_id = p_user and module_key = p_module;
  if found then return v_override; end if;

  -- 4. highest level across assigned roles (a dept-scoped role can't grant
  --    for a module outside its own department)
  select max(rma.level) into v_role_level
    from core.user_role_assignments ura
    join core.roles r             on r.id = ura.role_id
    join core.role_module_access rma on rma.role_id = r.id
    where ura.user_id = p_user
      and rma.module_key = p_module
      and (r.department_key is null or r.department_key = v_mod_dept);
  if v_role_level is not null and v_role_level <> 'none' then
    return v_role_level;
  end if;

  -- 5. department-member baseline
  if v_mod_dept = any(v_departments) then
    v_base := case when v_role = 'manager' then v_manager else v_member end;
    if v_base <> 'none' then return v_base; end if;
  end if;

  -- 6. nothing
  return 'none';
end;
$$;

-- What the logged-in user can reach — one call, AuthContext uses this.
create or replace function core.my_module_access()
returns table(module_key text, level core.access_level)
language sql stable security definer
set search_path to 'core','pg_temp'
as $$
  select m.key, core.module_access_level(auth.uid(), m.key)
  from core.modules m
  where m.is_active
    and core.module_access_level(auth.uid(), m.key) <> 'none';
$$;

-- Full resolved picture for one user, with the winning source — powers the
-- read-only "effective access" panel on /admin/access-control. Callable by a
-- global admin, or a department admin for a user in one of their departments.
create or replace function core.effective_module_access(p_user uuid)
returns table(
  module_key     text,
  department_key text,
  label          text,
  level          core.access_level,
  source         text
)
language plpgsql stable security definer
set search_path to 'core','pg_temp'
as $$
declare
  v_role        text;
  v_departments text[];
  v_dept_admin  text[];
  v_caller_ok   boolean;
  m             record;
  v_override    core.access_level;
  v_role_rec    record;
  v_base        core.access_level;
begin
  -- delegation guard
  select core.is_admin() or exists (
    select 1 from core.users tu,
      unnest(coalesce(tu.departments,'{}'::text[]) || coalesce(tu.department_admin_for,'{}'::text[])) d
    where tu.id = p_user and core.is_department_admin(d)
  ) into v_caller_ok;
  if not v_caller_ok then
    raise exception 'Not permitted to view this user''s access';
  end if;

  select u.role, coalesce(u.departments,'{}'::text[]), coalesce(u.department_admin_for,'{}'::text[])
    into v_role, v_departments, v_dept_admin
    from core.users u where u.id = p_user;
  if not found then return; end if;

  for m in
    select mo.key, mo.department_key as dept, mo.label, mo.member_baseline, mo.manager_baseline
    from core.modules mo where mo.is_active
    order by mo.department_key, mo.sort_order, mo.label
  loop
    -- 1
    if v_role = 'admin' then
      module_key := m.key; department_key := m.dept; label := m.label;
      level := 'admin'; source := 'global_admin'; return next; continue;
    end if;
    -- 2
    if m.dept = any(v_dept_admin) then
      module_key := m.key; department_key := m.dept; label := m.label;
      level := 'admin'; source := 'department_admin'; return next; continue;
    end if;
    -- 3
    select uma.level into v_override from core.user_module_access uma
      where uma.user_id = p_user and uma.module_key = m.key;
    if found then
      module_key := m.key; department_key := m.dept; label := m.label;
      level := v_override; source := 'override'; return next; continue;
    end if;
    -- 4
    select rma.level as lvl, r.name as rname into v_role_rec
      from core.user_role_assignments ura
      join core.roles r               on r.id = ura.role_id
      join core.role_module_access rma on rma.role_id = r.id
      where ura.user_id = p_user and rma.module_key = m.key
        and (r.department_key is null or r.department_key = m.dept)
        and rma.level <> 'none'
      order by rma.level desc
      limit 1;
    if found then
      module_key := m.key; department_key := m.dept; label := m.label;
      level := v_role_rec.lvl; source := 'role:' || v_role_rec.rname; return next; continue;
    end if;
    -- 5
    if m.dept = any(v_departments) then
      v_base := case when v_role = 'manager' then m.manager_baseline else m.member_baseline end;
      if v_base <> 'none' then
        module_key := m.key; department_key := m.dept; label := m.label;
        level := v_base;
        source := case when v_role = 'manager' then 'manager_baseline' else 'member_baseline' end;
        return next; continue;
      end if;
    end if;
    -- 6
    module_key := m.key; department_key := m.dept; label := m.label;
    level := 'none'; source := 'none'; return next;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit triggers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function core.log_access_change()
returns trigger language plpgsql security definer
set search_path to 'core','pg_temp'
as $$
declare
  v_type text; v_target uuid; v_scope text; v_old jsonb; v_new jsonb;
begin
  if tg_table_name = 'user_role_assignments' then
    if tg_op = 'INSERT' then
      v_type := 'role_assigned'; v_target := new.user_id;
      v_scope := (select name from core.roles where id = new.role_id);
      v_new := to_jsonb(new);
    else
      v_type := 'role_unassigned'; v_target := old.user_id;
      v_scope := (select name from core.roles where id = old.role_id);
      v_old := to_jsonb(old);
    end if;

  elsif tg_table_name = 'user_module_access' then
    v_target := coalesce(new.user_id, old.user_id);
    v_scope  := coalesce(new.module_key, old.module_key);
    v_type   := case tg_op when 'DELETE' then 'module_override_cleared' else 'module_override_set' end;
    v_old := to_jsonb(old); v_new := to_jsonb(new);

  elsif tg_table_name = 'roles' then
    v_scope := coalesce(new.department_key, old.department_key, 'global');
    v_type  := case tg_op when 'INSERT' then 'role_created'
                          when 'UPDATE' then 'role_updated'
                          else 'role_deleted' end;
    v_old := to_jsonb(old); v_new := to_jsonb(new);

  elsif tg_table_name = 'role_module_access' then
    v_type  := 'role_grant_changed';
    v_scope := coalesce(new.module_key, old.module_key);
    v_old := to_jsonb(old); v_new := to_jsonb(new);
  end if;

  -- This function is SECURITY DEFINER and owned by the migration role, which
  -- also owns core.access_change_log — so this insert runs as the table owner
  -- and bypasses the log's RLS (which otherwise blocks all client inserts).
  insert into core.access_change_log(changed_by, target_user, change_type, scope, old_value, new_value)
  values (auth.uid(), v_target, v_type, v_scope, v_old, v_new);

  return null;  -- AFTER trigger — return value ignored
end;
$$;

create or replace function core.log_department_admin_change()
returns trigger language plpgsql security definer
set search_path to 'core','pg_temp'
as $$
declare d text;
begin
  if coalesce(old.department_admin_for,'{}'::text[]) is distinct from coalesce(new.department_admin_for,'{}'::text[]) then
    for d in
      select unnest(coalesce(new.department_admin_for,'{}'::text[]))
      except
      select unnest(coalesce(old.department_admin_for,'{}'::text[]))
    loop
      insert into core.access_change_log(changed_by, target_user, change_type, scope, new_value)
      values (auth.uid(), new.id, 'department_admin_granted', d, to_jsonb(new.department_admin_for));
    end loop;
    for d in
      select unnest(coalesce(old.department_admin_for,'{}'::text[]))
      except
      select unnest(coalesce(new.department_admin_for,'{}'::text[]))
    loop
      insert into core.access_change_log(changed_by, target_user, change_type, scope, old_value)
      values (auth.uid(), new.id, 'department_admin_revoked', d, to_jsonb(old.department_admin_for));
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_user_role_assignments on core.user_role_assignments;
create trigger trg_log_user_role_assignments
  after insert or delete on core.user_role_assignments
  for each row execute function core.log_access_change();

drop trigger if exists trg_log_user_module_access on core.user_module_access;
create trigger trg_log_user_module_access
  after insert or update or delete on core.user_module_access
  for each row execute function core.log_access_change();

drop trigger if exists trg_log_roles on core.roles;
create trigger trg_log_roles
  after insert or update or delete on core.roles
  for each row execute function core.log_access_change();

drop trigger if exists trg_log_role_module_access on core.role_module_access;
create trigger trg_log_role_module_access
  after insert or update or delete on core.role_module_access
  for each row execute function core.log_access_change();

drop trigger if exists trg_log_department_admin on core.users;
create trigger trg_log_department_admin
  after update of department_admin_for on core.users
  for each row execute function core.log_department_admin_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table core.modules             enable row level security;
alter table core.roles               enable row level security;
alter table core.role_module_access  enable row level security;
alter table core.user_role_assignments enable row level security;
alter table core.user_module_access  enable row level security;
alter table core.access_change_log   enable row level security;

-- modules — everyone reads, only global admin writes (registration is normally
-- via migration; the write policy just lets an admin toggle is_active/labels).
drop policy if exists modules_select on core.modules;
create policy modules_select on core.modules
  for select to authenticated using (true);
drop policy if exists modules_write on core.modules;
create policy modules_write on core.modules
  for all to authenticated
  using (core.is_admin()) with check (core.is_admin());

-- roles
drop policy if exists roles_select on core.roles;
create policy roles_select on core.roles
  for select to authenticated
  using (
    core.is_admin()
    or department_key is null
    or core.is_department_admin(department_key)
  );
drop policy if exists roles_write on core.roles;
create policy roles_write on core.roles
  for all to authenticated
  using (
    core.is_admin()
    or (department_key is not null and not is_system_role and core.is_department_admin(department_key))
  )
  with check (
    core.is_admin()
    or (department_key is not null and not is_system_role and core.is_department_admin(department_key))
  );

-- role_module_access — dept admin may edit grants only for a non-system role in
-- their department AND only for modules in their department.
drop policy if exists role_module_access_select on core.role_module_access;
create policy role_module_access_select on core.role_module_access
  for select to authenticated
  using (
    core.is_admin()
    or exists (
      select 1 from core.roles r
      where r.id = role_module_access.role_id
        and (r.department_key is null or core.is_department_admin(r.department_key))
    )
  );
drop policy if exists role_module_access_write on core.role_module_access;
create policy role_module_access_write on core.role_module_access
  for all to authenticated
  using (
    core.is_admin()
    or (
      exists (select 1 from core.roles r
              where r.id = role_module_access.role_id
                and r.department_key is not null and not r.is_system_role
                and core.is_department_admin(r.department_key))
      and exists (select 1 from core.modules m
                  where m.key = role_module_access.module_key
                    and core.is_department_admin(m.department_key))
    )
  )
  with check (
    core.is_admin()
    or (
      exists (select 1 from core.roles r
              where r.id = role_module_access.role_id
                and r.department_key is not null and not r.is_system_role
                and core.is_department_admin(r.department_key))
      and exists (select 1 from core.modules m
                  where m.key = role_module_access.module_key
                    and core.is_department_admin(m.department_key))
    )
  );

-- user_role_assignments
drop policy if exists user_role_assignments_select on core.user_role_assignments;
create policy user_role_assignments_select on core.user_role_assignments
  for select to authenticated
  using (
    core.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from core.roles r
               where r.id = user_role_assignments.role_id
                 and r.department_key is not null
                 and core.is_department_admin(r.department_key))
  );
drop policy if exists user_role_assignments_write on core.user_role_assignments;
create policy user_role_assignments_write on core.user_role_assignments
  for all to authenticated
  using (
    core.is_admin()
    or (
      exists (select 1 from core.roles r
              where r.id = user_role_assignments.role_id
                and r.department_key is not null
                and core.is_department_admin(r.department_key))
      and core.user_in_department(user_role_assignments.user_id,
            (select department_key from core.roles where id = user_role_assignments.role_id))
      and not core.user_is_global_admin(user_role_assignments.user_id)
    )
  )
  with check (
    core.is_admin()
    or (
      exists (select 1 from core.roles r
              where r.id = user_role_assignments.role_id
                and r.department_key is not null
                and core.is_department_admin(r.department_key))
      and core.user_in_department(user_role_assignments.user_id,
            (select department_key from core.roles where id = user_role_assignments.role_id))
      and not core.user_is_global_admin(user_role_assignments.user_id)
    )
  );

-- user_module_access
drop policy if exists user_module_access_select on core.user_module_access;
create policy user_module_access_select on core.user_module_access
  for select to authenticated
  using (
    core.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from core.modules m
               where m.key = user_module_access.module_key
                 and core.is_department_admin(m.department_key))
  );
drop policy if exists user_module_access_write on core.user_module_access;
create policy user_module_access_write on core.user_module_access
  for all to authenticated
  using (
    core.is_admin()
    or (
      exists (select 1 from core.modules m
              where m.key = user_module_access.module_key
                and core.is_department_admin(m.department_key))
      and core.user_in_department(user_module_access.user_id,
            (select department_key from core.modules where key = user_module_access.module_key))
      and not core.user_is_global_admin(user_module_access.user_id)
    )
  )
  with check (
    core.is_admin()
    or (
      exists (select 1 from core.modules m
              where m.key = user_module_access.module_key
                and core.is_department_admin(m.department_key))
      and core.user_in_department(user_module_access.user_id,
            (select department_key from core.modules where key = user_module_access.module_key))
      and not core.user_is_global_admin(user_module_access.user_id)
    )
  );

-- access_change_log — read only; writes happen through the SECURITY DEFINER
-- trigger functions (owned by a bypassrls role), never directly from a client.
drop policy if exists access_change_log_select on core.access_change_log;
create policy access_change_log_select on core.access_change_log
  for select to authenticated
  using (
    core.is_admin()
    or changed_by = auth.uid()
    or (
      target_user is not null and exists (
        select 1 from core.users tu,
          unnest(coalesce(tu.departments,'{}'::text[]) || coalesce(tu.department_admin_for,'{}'::text[])) d
        where tu.id = access_change_log.target_user and core.is_department_admin(d)
      )
    )
  );
drop policy if exists access_change_log_noinsert on core.access_change_log;
create policy access_change_log_noinsert on core.access_change_log
  for insert to authenticated with check (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants (schema core is already exposed to PostgREST; new objects need grants)
-- ─────────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on
  core.modules, core.roles, core.role_module_access,
  core.user_role_assignments, core.user_module_access to authenticated;
grant select on core.access_change_log to authenticated;

grant execute on function core.module_access_level(uuid, text)      to authenticated;
grant execute on function core.my_module_access()                   to authenticated;
grant execute on function core.effective_module_access(uuid)        to authenticated;
grant execute on function core.user_is_global_admin(uuid)           to authenticated;
grant execute on function core.user_in_department(uuid, text)       to authenticated;

notify pgrst, 'reload schema';
