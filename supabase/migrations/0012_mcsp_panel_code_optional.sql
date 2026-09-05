-- Spec: "Panel code (optional)" — was created NOT NULL in 0002 (mirroring
-- samples.bt_code, which IS required). No panel rows exist yet, so this is
-- a free alter. The existing UNIQUE constraint already permits multiple
-- NULLs in Postgres (NULLs are never considered equal to each other), so
-- dropping NOT NULL alone is sufficient — no need to swap to a partial
-- unique index.
alter table mcsp.panels alter column panel_code drop not null;
