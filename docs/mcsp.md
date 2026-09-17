# MCSP — module detail (lives under Sales)

Referenced from the root CLAUDE.md. Full detail lives here so the root file stays short.

**⚠️ Placement changed 2026-09-05**: MCSP was originally built as its own top-level department
(`mcsp`, sort_order 13 in `core.departments`). That decision was **reversed** the same day — MCSP
now lives *under* the **Sales** department (`sales`, already existed in `core.departments`/
`src/config/departments.ts`, sort_order 3). The `mcsp` Postgres schema/tables/RPCs kept their
names unchanged (no data moved) — only the department-scoping string literals changed, from
`'mcsp'` to `'sales'`, across every RLS policy, RPC, and permission key (migrations `0009`–`0011`).
The stale `core.departments` row for key `mcsp` was left in place (harmless — Core Management's
category tracker also reads that table and this wasn't the moment to audit it) but no longer means
anything for MCSP access; **`'sales'` is the only department key that matters for MCSP now.**

## Origin

Ported from a standalone app — **BASANT MCSP** (package `basant-ssm`), Supabase project
`ztxqksvexjonqmfyjijf` ("MCP/MCS", currently paused), live at `mcsp.basant.info`. Its source was
dropped into this repo at `MCP-MCS/` for reference during the port — **that folder is not
committed** (huge sample-image asset dump, not appropriate for git; read it locally if you need to
check the original implementation). The old project/app stay untouched and live until migration is
fully verified.

The original app tracked two parallel modules — **MCS** (signed samples) and **MCP** (counter
panels) — sharing one codebase, four roles (`super_admin`/`hall_manager`/`merchant`/`custom`),
desktop-only, dark/light themed, with a fixed left sidebar MCS/MCP pill switcher. Both modules are
now built here (see "Structure" below), reskinned to `docs/design-system.md` rather than the
original's own dark-theme component library.

## Structure

```
/sales                        SalesHome    — Sales department landing, module-card grid
/sales/mcsp                   McspModule   — MCS|MCP pill-switcher sidebar + notification bell
  /sales/mcsp/mcs              (index)      McsArea -> Dashboard
  /sales/mcsp/mcs/samples                   Samples list (badges, tabs, search, drawer)
  /sales/mcsp/mcs/movements                 Movements log + Excel export
  /sales/mcsp/mcp              (index)      McpArea -> Dashboard
  /sales/mcsp/mcp/panels                    Panels list (badges, tabs, search, drawer)
  /sales/mcsp/mcp/movements                 Panel movements log + Excel export
  /sales/mcsp/buyers                        Buyer CRUD                     (Sales admin only)
  /sales/mcsp/halls                         Hall CRUD                     (Sales admin only)
  /sales/mcsp/users                         User management scoped to Sales (Sales admin only)
  /sales/mcsp/validity-requests             Approve/reject queue      (Sales admin + hall manager)
  /sales/mcsp/shift-requests                Approve/reject queue      (Sales admin + hall manager)
  /sales/mcsp/recalls                       Recall review queue           (Sales admin only)
```

`SalesModule` (`src/pages/sales/SalesModule.tsx`) mounts `McspModule` — MCSP is Sales' only module
block today. `McspModule` (`src/pages/mcsp/McspModule.tsx`) renders its own local sidebar
(`McspSidebar.tsx`, MCS/MCP pill switcher + nav, "Manage" section gated to Sales admins) beside the
routed content, inside the platform's normal `Layout`/breadcrumb shell — not a new nav pattern,
same tokens as the main `Sidebar.tsx`/`PurchaseModule` tab styling.

## Identity mapping — MCSP roles → `core.users`

No separate `profiles` table (unlike the original app) — identity comes entirely from
`core.users`, same as every other department:

| Original MCSP role | `core.users` mapping |
|---|---|
| `super_admin` (global, e.g. Praagya) | `role='admin'` |
| `super_admin` (Sales-only admin) | `role='custom'`, `departments @> {sales}`, `department_admin_for @> {sales}` |
| `hall_manager` | `role='manager'`, `departments @> {sales}`, `hall = '<hall name>'` — `core.users.hall` is a plain text field, matched **by name** against `mcsp.halls.name` (see `mcsp.current_hall_id()`) |
| `merchant` | `role='merchant'`, `departments @> {sales}`, `buyers = {'<buyer name>', ...}` — `core.users.buyers` is already a text[] free-text field (pre-existing in the schema, wired into `UserFormModal`'s "Buyers (comma-separated)" field before this department existed), matched **by name** against `mcsp.buyers.name`. Natively supports multi-buyer merchants — no separate `merchant_buyers` join table needed. |
| `custom` (fine-grained) | `role='custom'`, `departments @> {sales}`, plus access-control roles / per-module overrides (see below) |

**Access control (updated 2026-09-09).** MCSP now uses the platform access-control system
(`docs/access-control.md`). Sales modules: `sales.mcs`, `sales.mcp` (member baseline `view`,
manager `edit`), `sales.mcsp_validity` / `sales.mcsp_shift` (manager `edit`), `sales.mcsp_recalls`
/ `sales.mcsp_buyers` / `sales.mcsp_halls` / `sales.mcsp_users` (admin only). The old
`sales.*` permission keys were migrated to `view` on `sales.mcs`+`sales.mcp` and frozen;
`core.has_department_permission('sales')` (still used throughout the mcsp RLS) is now a shim over
the new engine — **no mcsp RLS policy changed**. Grant access via **/admin/access-control**
(roles "MCSP Merchant", "MCSP Hall Manager", or per-user overrides). Row-scoping (own hall / own
buyers) is still enforced by the `mcsp.*` RLS helpers on top of module-level access. The MCSP
admin-surface routes (buyers/halls/users/recalls) still use `<RequireAdminOrDeptAdmin>` pending a
later sweep to `<RequireModule min="admin">`.

Because names (not ids) are the matching key for `hall`/`buyers`, **renaming a hall or buyer
breaks the match** for any user pointed at the old name — re-save the affected users' `hall`/
`buyers` fields after a rename.

## Database — `mcsp` schema

Migrations: `supabase/migrations/0002`–`0017_mcsp_*.sql` (schema/RLS/RPCs in `0002`–`0008`;
department pivot to Sales in `0009`–`0011`; `panel_code` made optional in `0012`; in-app
notification RPCs in `0013`; **audit fix pass 2026-09-08 in `0014`–`0017`** — see "Audit fix
pass" below).

`mcsp.halls`, `mcsp.buyers`, `mcsp.samples`, `mcsp.movements` (hop-chain forwarding via
`hop_number`), `mcsp.panels`, `mcsp.panel_movements`, `mcsp.sample_comments`,
`mcsp.recall_requests`, `mcsp.shift_requests`, `mcsp.validity_requests`, `mcsp.validity_changes`,
`mcsp.notifications` (in-app bell rows only — no email/push, see "Not yet done").

### Helper functions
- `mcsp.current_hall_id()` — resolves the caller's `core.users.hall` name to an `mcsp.halls.id`.
- `mcsp.is_hall_manager_of(hall_id)` — true for a `role='manager'`, `'sales' = any(departments)` user whose hall matches.
- `mcsp.owns_buyer(buyer_id)` — true for a `role='merchant'`, `'sales' = any(departments)` user whose `buyers` array contains that buyer's name.

### RLS shape
Three-tier, same as every department: global admin (`core.is_admin()`) or Sales dept admin
(`core.is_department_admin('sales')`) see/manage everything; a `manager` sees/acts on their own
hall only; a `merchant` sees their own buyers' items only; a `custom` user with a `sales.*`
permission grant (`core.has_department_permission('sales')`) gets blanket read access.

### RPCs (all `SECURITY DEFINER`)
`checkout_sample`/`return_sample`/`forward_sample`, `checkout_panel`/`return_panel`/
`forward_panel`, `retire_panel`, `admin_update_validity`, `review_validity_request` (admin **or**
the item's own hall manager), `review_shift_request`, `delete_sample`, `delete_buyer`,
`set_sample_image`/`set_panel_image`, `clear_movement_history`, plus `notify_checkout`/
`notify_return`/`notify_shift_requested`/`notify_users` (in-app notification writers — see below).
Every status transition goes through one of these — no direct `UPDATE` policy exists for
`samples.status`/`panels.status`.

### Storage
Public bucket `mcsp-images` (upload/update: any Sales member; delete: admin/dept-admin/manager).

### Function grants
Postgres grants `EXECUTE` to `PUBLIC` by default on function creation — closed at the grant layer
for the whole `mcsp` schema (migration `0008`, re-verified after every later migration that adds a
new function): `revoke execute ... from public`, with the intended `authenticated`-only access
re-granted explicitly per function. **Any future new function in this schema needs the same
treatment** — `CREATE OR REPLACE` preserves existing grants, but a brand-new function name starts
back at the `PUBLIC`-executable default.

### Manual step (done, verified)
`mcsp` is confirmed listed in Supabase dashboard → Settings → API → Exposed schemas.

## In-app notifications

No email/Resend or Web Push infra exists in basant-desk (unlike the original standalone app) —
`mcsp.notifications` is written to by three `SECURITY DEFINER` RPCs (`notify_checkout`,
`notify_return`, `notify_shift_requested`) that resolve recipients server-side, since a regular
manager/merchant's RLS on `core.users` only permits reading their own row. Called fire-and-forget
from `src/lib/mcsp/db.ts` (`checkoutSample`/`returnSample`/`raiseShiftRequest`) — a failed
notification write is logged to the console, never blocks or rolls back the action it describes.
Read via `McspNotificationBell.tsx`, a bell dropdown scoped to `mcsp.notifications` (same UI shape
as the platform's Core Management `NotificationBell.tsx`, kept as a separate component since that
one is tightly coupled to `core_management`'s schema/dbTypes). **Validity-expiry alerts (30/15
days) are not implemented** — the original app's `send_validity_alerts()` needs a `pg_cron` job,
not built this pass.

## Frontend structure

- `src/lib/mcsp/dbTypes.ts` — all types (Hall, Buyer, Sample, Movement, Panel, PanelMovement,
  ShiftRequest, ValidityRequest, ValidityChange, SampleComment, RecallRequest) + `getValidityStatus()`
  (valid / expiring_soon ≤30 days / expired, mirrors the original app's threshold).
- `src/lib/mcsp/db.ts` — every Supabase call (CRUD + RPC wrappers), schema-scoped via
  `supabase.schema('mcsp')`.
- `src/lib/mcsp/exportExcel.ts` — styled Excel export (Calibri, header row with buyer name + date,
  fixed auto-fit-ish column widths) for Samples, Movements, Panels, Panel Movements — via
  `exceljs`, client-side blob download.
- `src/pages/mcsp/` — shared pieces: `McspModule`/`McspSidebar`/`McspNotificationBell`, `Badges.tsx`
  (`StatusBadge`, `ValidityBadge`), `Buyers.tsx`/`Halls.tsx`/`McspUsers.tsx` (+ form modal) admin
  pages, `ManageValidityModal.tsx` + `RaiseShiftRequestModal.tsx` (shared by both MCS and MCP
  drawers), `ValidityRequestsQueue.tsx`/`ShiftRequestsQueue.tsx` admin approval queues.
- `src/pages/mcsp/mcs/` — Dashboard (per-role: manager/merchant/admin), Samples list, SampleDrawer
  (Details/Movement History/Comments tabs), Issue/Add/Return/RaiseRecall modals, Movements log.
- `src/pages/mcsp/mcp/` — mirrors `mcs/` for panels: Dashboard, Panels list (retired items excluded
  from the active list, own "Retired" filter tab), PanelDrawer (Details/Movement History — no
  Comments tab, `mcsp.panels` has no comments table), Issue/Add/Retire modals, Movements log.

## Data migration (Phase 2, done 2026-09-05, unaffected by the Sales pivot)

Pulled from `ztxqksvexjonqmfyjijf` (temporarily restored) directly into the tables above, ids
preserved 1:1: `mcsp.buyers` (21), `mcsp.halls` (7), `mcsp.samples` (115), `mcsp.movements` (3, all
test/dev data). The live source project only had the **original minimal schema** applied (no
panels/validity/shift/notifications tables or hop-chain columns at all) — nothing existed there to
migrate for those. All 115 sample images (~4.9MB) copied from the old `sample-images` bucket to the
new `mcsp-images` bucket; every `image_url` rewritten to the new domain/bucket.

**Not migrated**: no `core.users` rows created for the old app's 21 profiles yet (Praagya and
`amitjain@basant.info` were both `super_admin` there) — create via `McspUsers` → Add user when
ready.

## Audit fix pass — 2026-09-08 (migrations `0014`–`0017`)

A full per-role audit found the module non-functional end to end and ~30 issues. Fixed:

- **`0014` — schema grants.** `mcsp` had `USAGE`/table grants for **nobody** but `postgres`, so
  every PostgREST request 403'd for every role (the dashboard "Exposed schemas" toggle sets the
  config but hadn't run the grants). Granted `authenticated`/`service_role` full access, `anon`
  read, + default privileges. This was the P0 blocker — nothing worked before it.
- **`0015` — access control.** Hall managers can raise `validity_requests`; anyone who can see a
  sample can comment (was merchant-only); `movements`/`panel_movements` got an UPDATE policy so
  return-condition photos actually save; global admins (`departments = []`) can upload images;
  `notify_shift_requested` no longer notifies **every user in the system** when an admin raises a
  request; the notification bell is strictly `recipient_id = auth.uid()` (admins/dept-admins no
  longer see everyone's notifications).
- **`0016` — manager reviews + data integrity.** `review_shift_request` accepts the from/to hall
  manager, not just admins; `validity_changes` is readable by the item's hall manager / assigned
  merchant; unique (case-insensitive) buyer + hall names; `current_hall_id()` trims + lower-cases
  so a stray space in `core.users.hall` no longer silently hides a manager's whole hall.
- **`0017` — buyer/hall CRUD + realtime.** `delete_buyer` now refuses if ANY sample/panel still
  references the buyer (it used to CASCADE-delete them); added `update_buyer`, `update_hall`,
  `delete_hall`; `mcsp.notifications` added to the `supabase_realtime` publication for the bell.

Frontend: `canAccessDepartment()` now lets merchants (and managers) into a department they're a
member of — merchants were fully locked out. New `RecallsQueue` page + sidebar item (recalls were
written to the DB but nothing read them). MCP dashboard got the manager/merchant/admin variants
MCS already had; both dashboards show a real error state instead of silent zeros. Manager
"Incoming (shift requests)" is a real count now. Add Sample/Panel lock the hall picker to a
manager's own hall. Buyers/Halls got inline rename + delete. Design-system: badges + inline pills
use `--success`/`--warning`/`--info` tokens (no raw Tailwind palette); primary buttons in the
manage pages use `--accent` not `bg-text`. Movement-history timeline connector no longer dangles.
Excel export is awaited + surfaces failures. `uploadImage` falls back to a MIME-derived extension.

## Bulk Excel import (built 2026-09-17)

One upload handles both row data and embedded images for either Samples or Panels — the
"Upload Excel" button next to Add Sample/Add Panel opens `UploadExcelModal`
(`src/pages/mcsp/UploadExcelModal.tsx`), which posts a buyer + item type + `.xlsx`/`.xls` file to
the `extract-excel-data` edge function (`supabase/functions/extract-excel-data/index.ts`) via
`uploadExcelImport()` in `db.ts`. Server-side: parses the sheet with SheetJS, maps columns by a
case/punctuation-insensitive alias table (e.g. "BT-Code"/"SKU" → `bt_code`, "Buyer Ref" →
`product_ref`, "Hall No" → hall, matched by name or numeric `hall_number`), pulls embedded images
straight out of the `.xlsx` zip (`xl/drawings/*.xml` anchors → `xl/media/*`) and matches each to
its row by position, uploads them to `mcsp-images/[buyer]/[code].[ext]`, and inserts — skipping
rows whose BT/panel code already exists (in-file or in the DB) rather than failing the batch.
Returns `{ imported, skipped, skipped_codes, images_uploaded, errors }`, which the modal renders
as a summary plus collapsible skipped-codes/error lists. Ported from and replaces the original
app's `UploadSamplesModal` + `extractSpreadsheetImages.js`, but server-side and covering panels too
(the original was samples-only, client-side).

## Not yet done

- **Email/Web Push + validity-expiry cron alerts** — in-app notifications only (see above).
- **`forwardSample()`/`forwardPanel` multi-hop** — RPC + `db.ts` wrapper exist, no UI calls it yet
  (only Issue/Return are wired into the drawers).
- **Panel comments** — `mcsp.panels` still has no comments table, so `PanelDrawer` has no Comments
  tab (only samples do).
- Author/requester names in comments + the recall/request queues are resolved with a plain
  `core.users` lookup, which returns nothing for a manager/merchant viewing another user's row
  (their `core.users` RLS only exposes their own row) — shows "—"/"Unknown" in that case rather
  than a name. A `SECURITY DEFINER` name-resolver would fix it if it becomes annoying.
- No automated tests added for the MCSP module (mirrors the rest of the platform — only
  `extractHCRows.test.ts` exists repo-wide).
