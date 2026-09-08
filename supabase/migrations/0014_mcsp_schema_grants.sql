-- 0014_mcsp_schema_grants.sql
--
-- P0 blocker fix (audit 2026-09-08). Migration 0007 exposed the `mcsp` schema
-- to PostgREST (pgrst.db_schemas) but never ran the role GRANTs, so EVERY
-- frontend request to any mcsp table/RPC returned HTTP 403 for every role,
-- including global admins — the module was non-functional end to end.
--
-- This grants the same shape the other department schemas already have
-- (purchase / core / yaamya / core_management): USAGE + full table/sequence/
-- routine access for `authenticated` and `service_role`, read-only for `anon`
-- (RLS still gates every row), plus default privileges for future objects.
--
-- Numbered 0014 (next sequential local file) rather than 0009 — 0009–0013 were
-- already taken by the Sales department pivot + notification RPC migrations.

grant usage on schema mcsp to authenticated, anon, service_role;

grant all on all tables in schema mcsp to authenticated, service_role;
grant all on all sequences in schema mcsp to authenticated, service_role;
grant all on all routines in schema mcsp to authenticated, service_role;

grant select on all tables in schema mcsp to anon;

alter default privileges in schema mcsp grant all on tables to authenticated, service_role;
alter default privileges in schema mcsp grant all on sequences to authenticated, service_role;
alter default privileges in schema mcsp grant all on routines to authenticated, service_role;
alter default privileges in schema mcsp grant select on tables to anon;

notify pgrst, 'reload schema';
