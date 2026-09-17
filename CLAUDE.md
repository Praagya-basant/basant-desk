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
`mcsp` (built — MCS + MCP both live, under the **Sales** department; see `docs/mcsp.md`).

## core.users format
```
id, full_name, email,
role ('admin' | 'manager' | 'merchant' | 'custom'),
departments (text[]),
department_admin_for (text[]),
hall, buyers, created_at
```

## Access control model — applies to every module, every department

**Centralized RBAC system, built 2026-09-09 (migrations `0018`–`0019`). Full spec + the
mandatory rules for building any module: `docs/access-control.md` — read it before touching
permissions. Every new feature registers a row in `core.modules` and gates on
`core.module_access_level()` / `<RequireModule>` / `useCan()`. Do not invent per-module
permission logic.**

- **Modules** (`core.modules`): every page/feature, keyed `department.slug`. Access **levels**
  `none < view < edit < approve < admin` (enum `core.access_level`).
- **Roles** (`core.roles`): reusable named bundles of `(module, level)` grants — global, or scoped
  to a department. `is_system_role` ones are seeded (Viewer/Editor/Approver per dept + a few named).
- Resolution per `(user, module)`, first match wins: `role='admin'` → admin; dept in
  `department_admin_for` → admin; per-user override (`core.user_module_access`, incl. `none`=deny)
  → its level; highest assigned-role grant; department-member baseline (`manager_baseline` if
  `role='manager'`, else `member_baseline`); else `none`.
- `core.users.departments` / `.department_admin_for` are unchanged and still mean what they did —
  this system layers on top. Legacy `core.permissions` / `core.user_permissions` are frozen (nothing
  reads them; `core.has_department_permission()` is now a shim over the new engine so no existing
  RLS changed) and get dropped in a later cleanup.
- Every access change is auto-logged to `core.access_change_log`.

**Admin UI**: `/admin/access-control` (Users / Roles / Audit Log tabs). Global admins see all;
a **department admin can now enter `/admin`** — scoped to just this page, just their department(s).
They cannot create global roles, edit system roles, touch other departments, or grant
`department_admin_for` (that stays on the global-admin **Admin → Users** form).

Known real example: Yash Jain (yashjain@basant.info) is department_admin_for `['purchase']`. Was
previously miscreated as global `role='admin'` — fixed directly in Supabase. Frontend shows him a
"Purchase Admin" badge, not "Admin", and his `/admin` area is only Access Control for Purchase.

## Departments (core.departments table)
| key | label | notes |
|---|---|---|
| purchase | Purchase | building first — see docs/purchase.md |
| production | Production | includes Quality Inspection, no separate dept |
| sales | Sales | MCSP (samples + panels) lives here — see docs/mcsp.md |
| hr | HR | |
| yaamya | Yaamya Industries | separate dept |
| admin | Admin | control/settings area |

Note: `core.departments` still has a stale `mcsp` row (sort_order 13) from MCSP's brief stint as
its own department — harmless, unused for access-control purposes, not removed since Core
Management's category tracker also reads this table.

Flexible — decided incrementally, not fixed upfront.

## Navigation shell (platform-wide) — built 2026-09-17

**One sidebar, whole app — never a second one.** `src/components/Sidebar.tsx` swaps its content by
route: the department switcher at `/`, that department's own modules once inside it, and a
module's own nav (e.g. MCS/MCP) once inside that — each in `src/components/sidebar/*Nav.tsx`
(`DepartmentNav`, `SalesNav`, `McspNav`, `PurchaseNav`, `YaamyaNav`; departments with nothing built
yet fall back to `DepartmentNav`). Going back up a level is the **breadcrumb** at the top of the
content area (`Layout.tsx`, driven by `src/config/subModules.ts` → `getBreadcrumbTrail()`), not a
nested nav panel — Dashboard icon → department → every registered level, each a link except the
current one. Register a new sub-page's breadcrumb entry in `subModules.ts` when you build it.

MCSP's MCS/MCP pill switch keeps both areas mounted (`McspModule.tsx` gives each its own frozen
`<Routes location=...>`, shown/hidden via CSS) instead of unmounting/refetching on every switch —
no reload flash, filters/scroll survive a round trip. Same pattern to reach for anywhere else a
top-level tab switch feels like a page reload.

- Shared/reusable shell components across all departments via config, not hardcoded per department.
- Notion-style tabs (multiple pages open at once, each keeps its own state, persisted in
  sessionStorage) — **not built yet**, separate from the sidebar/breadcrumb work above.

## Departments — build status
- **Purchase**: in progress, see `docs/purchase.md` for full detail
- **Yaamya Industries**: in progress — Wood Inward module ported from the old standalone app,
  see `docs/yaamya.md`
- **Sales**: built — MCSP (both MCS/samples and MCP/panels) ported from the old standalone BASANT
  MCSP app (`mcsp.basant.info`); full workflow (issue/return/retire, validity management, hall
  shift requests, recalls queue, per-role dashboards, Excel export, in-app notifications) lives at
  `/sales/mcsp`. **Full audit + fix pass done 2026-09-08** (migrations `0014`–`0017`): the schema
  had never been GRANTed to `authenticated`/`anon` so every request 403'd — fixed; merchants were
  locked out of the department gate — fixed; hall managers can now raise/review validity + shift
  requests for their own hall; notification bell is per-recipient with realtime; buyers/halls got
  rename + guarded delete with unique names; role-differentiated MCP dashboard; design-system token
  cleanup. **2026-09-17**: merged into `master` along with the platform access-control system
  (migrations `0018`–`0020` — see "Access control model" above); MCS/MCP switch no longer
  unmounts/refetches (see Navigation shell); MCS dashboard stat cards are now links straight into
  Samples pre-filtered by that status (`?status=`); moved onto the single context-aware sidebar,
  its old standalone `McspSidebar` removed. See `docs/mcsp.md`. Old project not yet decommissioned.
- **Production, HR, Admin**: not started

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
- MCSP's `hall`/`buyers` scoping matches by **name**, not id (`core.users.hall`/`core.users.buyers` are plain text/text[], not FKs) — renaming a hall or buyer in `mcsp.halls`/`mcsp.buyers` silently breaks that match for any user still pointed at the old name. The `hall` match is now case/whitespace-insensitive (`mcsp.current_hall_id()`, migration `0016`) and buyer/hall names are unique, but a genuine rename still needs affected users re-saved. See `docs/mcsp.md`.
- Exposing a new Postgres schema in the Supabase dashboard ("Exposed schemas") sets the PostgREST config but does **not** always run the `GRANT USAGE`/table grants — `mcsp` sat 403ing every request for days because of this (migration `0014`). After adding a schema, verify `has_schema_privilege('authenticated','<schema>','USAGE')` is true and that `information_schema.role_table_grants` has rows for it.
- **⚠️ Migration `0020` (`supabase/migrations/0020_access_control_narrow_has_department_permission.sql`) may not be applied yet — check before trusting MCSP row-scoping.** `0019` accidentally made `core.has_department_permission(dept)` return true for anyone with a plain department-membership baseline, not just an explicit grant — which let every Sales manager/merchant bypass `mcsp.is_hall_manager_of` / `mcsp.owns_buyer` and see every hall's/buyer's samples. `0020` fixes it. Verify with a live user before assuming this is safe: a hall manager should see only their hall's samples, a merchant only their buyers'.
- MCSP's Postgres schema is still named `mcsp`, but it lives under the **Sales** department now (not its own department) — every RLS policy/RPC checks `'sales'`, not `'mcsp'`. Don't assume the schema name tells you the department key for anything built after 2026-09-05.
