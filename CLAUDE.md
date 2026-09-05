# CLAUDE.md — Master brain for basant-desk

**Auto-loaded by Claude Code at the start of every session in this repo. This is the single source of truth. If information here conflicts with anything a person says from memory, this file wins unless they explicitly say they're updating it.**

## Rules for every session
1. Read this file fully before making changes.
2. Big/structural changes (navigation, schema, auth) → work on a separate git branch, not `main`.
3. Never touch business logic, calculations, Supabase queries, or RLS checks unless the task explicitly asks for that.
4. This project is worked on across many separate sessions/chats. Trust this file as current state — don't assume something's missing just because this conversation didn't build it.
5. After any new Postgres schema, remind the user: Supabase → Settings → API → Exposed schemas (manual step, easy to forget, has caused outages).
6. When a session makes a real decision or finishes a feature, update this file (or the relevant `docs/*.md` file) before ending the session.
7. For deep detail on a specific department, read `docs/<department>.md`. Keep this file itself high-level — an index, not the full detail.
8. **Design system is locked**: read `docs/design-system.md` before building or changing ANY UI. Applies platform-wide, every department, every module — not decided per-module. Do not introduce new colors, fonts, or component styles outside this file.

---

## Infrastructure
- **Supabase project**: `basant-desk`, ref `fwedvwhjscdrvgjsdzyk`, region `ap-northeast-1`
- **GitHub repo**: `Praagya-basant/basant-desk`
- **Hosting**: Vercel, domain `desk.basant.info` (live)
- **MCP/MCS** (`ztxqksvexjonqmfyjijf`, currently paused) is MCSP's old standalone Supabase
  project, live at `mcsp.basant.info` — untouched, migration in progress on branch
  `mcsp-migration`, see `docs/mcsp.md`. **Yaamya Industries** (`xvgclfsikyndkpumbcvn`) is a
  separate, older Supabase project — untouched, migrate later as a deliberate step, not now.

## Database pattern
One Supabase project. Every department gets its own Postgres schema (not a new project, not `public`). New schemas must be manually added to Supabase → Settings → API → Exposed schemas — cannot be done via SQL.

Current schemas: `core` (shared users/roles/departments, built), `purchase` (in progress),
`core_management` (built), `yaamya` (in progress — `wood_measurements` table),
`mcsp` (in progress — samples built, panels schema-only, see `docs/mcsp.md`).

## core.users format
```
id, full_name, email,
role ('admin' | 'manager' | 'merchant' | 'custom'),
departments (text[]),
department_admin_for (text[]),
hall, buyers, created_at
```

## Access control model — applies to every module, every department
Three tiers:
1. **Global Admin** — `role = 'admin'`. Sees/controls everything.
2. **Department Admin** — `department_admin_for` contains a department key. Full control (data, users, approvals) scoped ONLY to that department. Cannot see or touch other departments or the global Admin area.
3. **Regular member** — `departments` contains the key. Can use tools, cannot manage/approve.

Every "admin-only" check — in RLS policies AND frontend UI — must check `role = 'admin' OR department_key = ANY(department_admin_for)`, never `role = 'admin'` alone.

Known real example: Yash Jain (yashjain@basant.info) is department_admin_for `['purchase']`. Was previously miscreated as global `role='admin'` — fixed directly in Supabase. Frontend must show him a "Purchase Admin" badge, not "Admin", and must not show him the global /admin area.

## Departments (core.departments table)
| key | label | notes |
|---|---|---|
| purchase | Purchase | building first — see docs/purchase.md |
| production | Production | includes Quality Inspection, no separate dept |
| sales | Sales | |
| hr | HR | |
| yaamya | Yaamya Industries | separate dept |
| mcsp | MCSP | own department (decided) — see docs/mcsp.md |
| admin | Admin | control/settings area |

Flexible — decided incrementally, not fixed upfront.

## Navigation shell (platform-wide)
- Dashboard landing page (`/`) — department cards, no sidebar, only departments the user has access to
- Inside a department: sidebar with department switcher at top + grouped module sections below
- Notion-style tabs at top of content area — multiple pages open at once, each keeps own state, persisted in sessionStorage
- Shared/reusable shell components across all departments via config, not hardcoded per department
- Status: spec written, build in progress

## Departments — build status
- **Purchase**: in progress, see `docs/purchase.md` for full detail
- **Yaamya Industries**: in progress — Wood Inward module ported from the old standalone app,
  see `docs/yaamya.md`
- **MCSP**: in progress — Samples module ported from the old standalone BASANT MCSP app
  (`mcsp.basant.info`), panels not yet built, old project not yet migrated/decommissioned,
  see `docs/mcsp.md`
- **Production, Sales, HR, Admin**: not started

## Core Management (not a department)
Internal task-tracking module, restricted to Praagya + Amit only (see `core.core_management_admins`
allowlist + `core.is_core_management_admin()`). Deliberately outside the department switcher and
`DEPARTMENTS` config — mounted directly in `src/App.tsx` at `/core-management`, plus a separate
minimal staff surface at `/my-tasks`. Full detail: `docs/core-management.md`.

## Known gotchas
- New Postgres schemas need manual exposure in Supabase dashboard — caused a real outage during `core` setup (blank page, 406 errors).
- Postgres arrays (`departments text[]`) — verify frontend reads these correctly; caused a "no departments assigned" bug despite correct DB data.
- Vercel MCP connector has had permission issues (403 on deployment creation/listing) — first deploy sometimes needs a manual git push or dashboard trigger.
- Any parsing/extraction logic must be tested against real multi-item input before considered done — subtle boundary bugs (e.g. off-by-one lookup windows, false-positive pattern matches) only surface under real testing, not code review alone.
- Yaamya Wood Inward CFT formula is `(L_ft × W_in × H_in × pieces) / 144` — NOT `/1728`. Do not "simplify" it (see `docs/yaamya.md`).
- Every new table needs RLS enabled **at creation time**, not added later — an admin-allowlist table (`core.core_management_admins`) shipped without it and sat exposed to the anon/authenticated key until fixed (`supabase/migrations/0001_core_management_admins_rls.sql`). Run Supabase's security advisor against any new table before considering it done.
- MCSP's `hall`/`buyers` scoping matches by **name**, not id (`core.users.hall`/`core.users.buyers` are plain text/text[], not FKs) — renaming a hall or buyer in `mcsp.halls`/`mcsp.buyers` silently breaks that match for any user still pointed at the old name. See `docs/mcsp.md`.
