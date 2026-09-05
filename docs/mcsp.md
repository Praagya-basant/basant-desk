# MCSP — department detail

Referenced from the root CLAUDE.md. Full detail lives here so the root file stays short.

## Origin

Ported from a standalone app — **BASANT MCSP** (package `basant-ssm`), Supabase project
`ztxqksvexjonqmfyjijf` ("MCP/MCS", currently paused), live at `mcsp.basant.info`. Its source
was dropped into this repo at `MCP-MCS/` for reference during the port — **that folder is not
committed** (huge sample-image asset dump, not appropriate for git; read it locally if you need
to check the original implementation) and the old project/app stay untouched and live until
migration is fully verified — see "Not yet done" below.

The original app tracked two parallel modules — **MCS** (signed samples) and **MCP** (counter
panels) — sharing one codebase, four roles (`super_admin`/`hall_manager`/`merchant`/`custom`),
desktop-only, dark/light themed. Only **MCS (samples)** has been ported so far; MCP (panels) and
several admin-platform pages (validity/shift request queues, notifications, feedback, styled
Excel export, dashboards) are not yet built here — see "Not yet done".

## Structure

One module under MCSP so far:
- **Samples** — built: add, issue, return, movements log, buyers/halls admin, users.
- **Panels (MCP)** — not built yet, schema exists (see below).

Routes (mounted in `src/App.tsx` via `McspModule`, same pattern as `PurchaseModule`/`YaamyaModule`):
```
/mcsp             McspHome   — module cards
/mcsp/samples     Samples    — list, add, issue, return          (any MCSP member)
/mcsp/movements   Movements  — full checkout/return/forward log  (any MCSP member)
/mcsp/buyers      Buyers     — buyer CRUD                        (MCSP admin only)
/mcsp/halls       Halls      — hall CRUD                         (MCSP admin only)
/mcsp/users       McspUsers  — user management scoped to MCSP     (MCSP admin only)
```

## Identity mapping — MCSP roles → `core.users`

No separate `profiles` table (unlike the original app) — identity comes entirely from
`core.users`, same as every other department:

| Original MCSP role | `core.users` mapping |
|---|---|
| `super_admin` (global, e.g. Praagya) | `role='admin'` |
| `super_admin` (MCSP-only admin) | `role='custom'`, `departments @> {mcsp}`, `department_admin_for @> {mcsp}` |
| `hall_manager` | `role='manager'`, `departments @> {mcsp}`, `hall = '<hall name>'` — `core.users.hall` is a plain text field, matched **by name** against `mcsp.halls.name` (see `mcsp.current_hall_id()`) |
| `merchant` | `role='merchant'`, `departments @> {mcsp}`, `buyers = {'<buyer name>', ...}` — `core.users.buyers` is already a text[] free-text field (pre-existing in the schema, wired into `UserFormModal`'s "Buyers (comma-separated)" field before this department existed), matched **by name** against `mcsp.buyers.name`. Natively supports multi-buyer merchants — no separate `merchant_buyers` join table needed. |
| `custom` (fixed 6-toggle `custom_permissions` jsonb) | `role='custom'`, `departments @> {mcsp}`, plus fine-grained `core.permissions`/`core.user_permissions` rows (`mcsp.view_all_buyers`, `mcsp.manage_samples`, `mcsp.manage_panels`, `mcsp.view_movements`, `mcsp.manage_users`, `mcsp.export_data`) — same shape as Purchase's permission keys, checked via `core.has_department_permission('mcsp')` in RLS and `useHasAccess('mcsp.<key>')`/`RequirePermission` on the frontend. |

Because names (not ids) are the matching key for `hall`/`buyers`, **renaming a hall or buyer
breaks the match** for any user pointed at the old name — re-save the affected users' `hall`/
`buyers` fields after a rename. Same trade-off the platform already made for Purchase's user
model; not new to MCSP.

## Database — `mcsp` schema

Migrations: `supabase/migrations/0002`–`0007_mcsp_*.sql`. Column shapes kept close to the
original app for a straightforward data copy.

`mcsp.halls`, `mcsp.buyers`, `mcsp.samples`, `mcsp.movements` (hop-chain forwarding via
`hop_number`), `mcsp.panels`, `mcsp.panel_movements` (schema exists, no frontend yet),
`mcsp.sample_comments`, `mcsp.recall_requests`, `mcsp.shift_requests`, `mcsp.validity_requests`,
`mcsp.validity_changes`, `mcsp.notifications` (in-app bell rows only — no email/push yet).

### Helper functions (mirrors `core.is_admin()`/`core.is_department_admin()` pattern)
- `mcsp.current_hall_id()` — resolves the caller's `core.users.hall` name to an `mcsp.halls.id`.
- `mcsp.is_hall_manager_of(hall_id)` — true for a `role='manager'` MCSP member whose hall matches.
- `mcsp.owns_buyer(buyer_id)` — true for a `role='merchant'` MCSP member whose `buyers` array
  contains that buyer's name.

### RLS shape
Three-tier, same as every department: global admin (`core.is_admin()`) or MCSP dept admin
(`core.is_department_admin('mcsp')`) see/manage everything; a `manager` sees/acts on their own
hall only; a `merchant` sees their own buyers' items only; a `custom` user with an `mcsp.*`
permission grant (`core.has_department_permission('mcsp')`) gets blanket read access, same as
Purchase/Yaamya's custom-role pattern — RLS doesn't distinguish which specific `mcsp.*` key was
granted, only the frontend's `RequirePermission`/`useHasAccess` narrows which page/button that
unlocks.

### RPCs (all `SECURITY DEFINER`, ported 1:1 from the original app's logic)
`checkout_sample`/`return_sample`/`forward_sample`, `checkout_panel`/`return_panel`/
`forward_panel`, `retire_panel`, `admin_update_validity`, `review_validity_request` (admin **or**
the item's own hall manager), `review_shift_request`, `delete_sample`, `delete_buyer`,
`set_sample_image`/`set_panel_image`, `clear_movement_history`. Every status transition goes
through one of these — no direct `UPDATE` policy exists for `samples.status`/`panels.status`,
matching the original app's judgment (status + its movement-row audit trail can never drift out
of sync this way).

### Storage
Public bucket `mcsp-images` (upload/update: any MCSP member; delete: admin/dept-admin/manager).

### ⚠️ Manual step (done, but verify)
The `0007` migration adds `mcsp` to `pgrst.db_schemas` via `ALTER ROLE authenticator`, but the
**Supabase dashboard → Settings → API → Exposed schemas** is the canonical source and will
overwrite that on the next save there. Confirm `mcsp` is listed in the dashboard.

## Not yet done (later phases)

- **Data migration from the old project.** `ztxqksvexjonqmfyjijf` is currently paused — needs a
  temporary restore (user-initiated, not done by Claude — see root CLAUDE.md) to dump `buyers`,
  `halls`, `samples`, `movements`, `panels`, `panel_movements`, `sample_comments`,
  `recall_requests`, `shift_requests`, `validity_requests`, `validity_changes`, plus the
  `sample-images` storage bucket's objects, then transform+load into the tables above (auth users
  recreated via the existing `create-placeholder-users` pattern, matched by email).
- **MCP (panels) frontend.** Schema/RLS/RPCs exist (`mcsp.panels`/`mcsp.panel_movements` +
  `checkout_panel`/`return_panel`/`forward_panel`/`retire_panel`/`set_panel_image`); no pages yet.
- **Forward** (multi-hop) isn't wired in the Samples UI yet — only Issue/Return. `forwardSample()`
  exists in `src/lib/mcsp/db.ts`, just not called from a page.
- **Recalls, per-sample comments, hall-shift requests, validity extension requests/alerts** — all
  have schema + RPCs, no frontend.
- **Email/Web Push notifications.** `mcsp.notifications` is in-app-bell-only for now; the
  original app's Resend + Web Push `send-notification` edge function equivalent hasn't been
  ported.
- **Bulk Excel import + embedded-image matching** for samples (the original app's
  `UploadSamplesModal`/`extractSpreadsheetImages` logic) — not ported yet.
- **Dashboards, styled Excel export.**
- **`core.core_management_admins`` RLS fix note**: unrelated to MCSP, but see root CLAUDE.md's
  Known Gotchas — fixed on `master` (migration `0001`) before this branch started.
