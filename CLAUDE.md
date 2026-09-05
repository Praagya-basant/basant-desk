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

---

## Infrastructure
- **Supabase project**: `basant-desk`, ref `fwedvwhjscdrvgjsdzyk`, region `ap-northeast-1`
- **GitHub repo**: `Praagya-basant/basant-desk`
- **Hosting**: Vercel, domain `desk.basant.info` (live)
- **MCP/MCS** (`ztxqksvexjonqmfyjijf`) and **Yaamya Industries** (`xvgclfsikyndkpumbcvn`, paused) are separate, older Supabase projects — untouched, migrate later as a deliberate step, not now.

## Database pattern
One Supabase project. Every department gets its own Postgres schema (not a new project, not `public`). New schemas must be manually added to Supabase → Settings → API → Exposed schemas — cannot be done via SQL.

Current schemas: `core` (shared users/roles/departments, built), `purchase` (in progress).

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
| sales | Sales | MCSP may fold in here later — not decided |
| hr | HR | |
| yaamya | Yaamya Industries | separate dept |
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
- **Production, Sales, HR, Yaamya, Admin**: not started

## Known gotchas
- New Postgres schemas need manual exposure in Supabase dashboard — caused a real outage during `core` setup (blank page, 406 errors).
- Postgres arrays (`departments text[]`) — verify frontend reads these correctly; caused a "no departments assigned" bug despite correct DB data.
- Vercel MCP connector has had permission issues (403 on deployment creation/listing) — first deploy sometimes needs a manual git push or dashboard trigger.
- Any parsing/extraction logic must be tested against real multi-item input before considered done — subtle boundary bugs (e.g. off-by-one lookup windows, false-positive pattern matches) only surface under real testing, not code review alone.
- Every new table needs RLS enabled **at creation time**, not added later — an admin-allowlist table (`core.core_management_admins`) shipped without it and sat exposed to the anon/authenticated key until fixed in `supabase/migrations/0001_core_management_admins_rls.sql`. Run Supabase's security advisor against any new table before considering it done.
