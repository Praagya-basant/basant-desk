# Access Control — platform standard

**Every module in basant-desk, current and future, uses this system. Read this before touching any permission logic. Do not invent per-module permission checks — register the module in `core.modules` and gate on `core.module_access_level()`.**

Built 2026-09-09 (migrations `0018`–`0019` + branch `access-control-system`). Replaces the flat `core.permissions` / `core.user_permissions` model, which is kept **frozen** (nothing reads it) and will be dropped in a later cleanup migration.

**Frontend entry points:** `AuthContext.moduleAccess` (a `Map<module_key, AccessLevel>` from `core.my_module_access()`), `useModuleAccess(key)` / `useCan(key, min)` hooks, `<RequireModule moduleKey min>` route guard, `src/config/modules.ts` (static mirror of `core.modules` for department grouping + routes), `src/lib/admin/accessControl.ts` (the admin-UI data layer).

---

## Concepts

| Object | What it is |
|---|---|
| **Module** (`core.modules`) | A feature/page. Key is `department.slug` (`purchase.honeycomb`, `sales.mcs`). Every feature registers one. Supports nesting via `parent_module_key`. |
| **Access level** (`core.access_level` enum) | `none < view < edit < approve < admin`. Ordered — `level >= 'edit'` works in SQL. |
| **Role** (`core.roles`) | A named, reusable bundle of `(module, level)` grants. Scoped to a department, or global (`department_key IS NULL`, global-admin only). `is_system_role` = seeded, editable only by a global admin. |
| **Role grant** (`core.role_module_access`) | One `(role, module, level)` row. |
| **Role assignment** (`core.user_role_assignments`) | `(user, role)` — the user inherits that role's grants. |
| **Per-user override** (`core.user_module_access`) | `(user, module, level)` — an explicit grant/deny for one person on one module. Beats roles. `level = 'none'` = explicit deny. |
| **Audit** (`core.access_change_log`) | Every change (role assign/unassign, override set/clear, role lifecycle, `department_admin_for` grant/revoke) written automatically by triggers. |

### Level semantics (platform-wide)
- **view** — read the module's pages and data
- **edit** — create / update rows; day-to-day work
- **approve** — act on approval workflows (flagged HC rows, validity/shift requests)
- **admin** — module settings + manage who else can access it (price grid, buyers/halls, module users)

---

## Resolution order — `core.module_access_level(user, module)`

First match wins:

| # | Condition | Result |
|---|---|---|
| 1 | `users.role = 'admin'` | `admin` |
| 2 | `module.department_key = ANY(users.department_admin_for)` | `admin` |
| 3 | a `core.user_module_access` row exists for `(user, module)` | **its level** (including `none` → deny) |
| 4 | highest `level` across the user's assigned roles' grants for this module (a department-scoped role only counts for modules in its own department) | that level |
| 5 | `module.department_key = ANY(users.departments)` → `manager_baseline` if `role = 'manager'`, else `member_baseline` (when not `none`) | that baseline |
| 6 | nothing matched | `none` |

`department_admin_for` (step 2) and `departments[]` (step 5) are the **existing** `core.users` fields — unchanged in meaning. This system layers roles + overrides on top.

Steps 5's baselines are columns on `core.modules`:
- `member_baseline` — what a plain `departments[]` member (custom/merchant) gets with no role or override.
- `manager_baseline` — what a `role = 'manager'` member of the department gets.
- Both `none` = an **admin-only surface** (price grid, buyers/halls, module-users pages). Reached only via steps 1–4.

### Reading it in code / RLS
```sql
-- RLS read policy
using ( core.module_access_level(auth.uid(), 'sales.mcs') >= 'view' )
-- RLS write policy
with check ( core.module_access_level(auth.uid(), 'sales.mcs') >= 'edit' )
-- an approval action in an RPC
if core.module_access_level(auth.uid(), 'purchase.honeycomb') < 'approve' then
  raise exception 'Not permitted';
end if;
```
```ts
// frontend
const level = useModuleAccess('sales.mcs')          // AccessLevel
const canEdit = useCan('sales.mcs', 'edit')          // boolean
<RequireModule moduleKey="sales.mcs" min="view">…</RequireModule>
```

`AuthContext` loads the current user's full map once via `core.my_module_access()`.
The admin UI reads one user's full resolved picture (with the winning source) via `core.effective_module_access(user_id)`.

---

## Compatibility — nothing existing breaks

`core.has_department_permission(dept)` — called by every current Purchase / Yaamya / MCSP RLS policy — was rewritten (migration `0020`) to answer from the new engine while keeping its **original narrow meaning**: "the user has an *explicitly assigned* grant in this department" — a per-user module override **or** a grant inherited from an assigned role. **Not** a department-membership baseline.

```sql
-- explicit grant only — override or assigned-role grant, ≥ view, in this dept
```

This matters because MCSP RLS policies OR in `has_department_permission('sales')` as the "custom user with blanket read" branch *alongside* the hall/buyer row-scoping (`mcsp.is_hall_manager_of` / `mcsp.owns_buyer`). If the helper also returned true for a plain member, every sales manager/merchant would bypass row-scoping and see all halls/buyers. (Migration `0019` first shipped the broad version; `0020` fixed it.)

**Zero existing RLS policies changed.** They keep calling the same helper. `core.is_admin()` and `core.is_department_admin()` are untouched.

`user_permissions` was empty when migrated, so `has_department_permission` returns false for everyone today — exactly matching pre-`0018`. A custom user given the "MCSP Merchant" role (or a `sales.mcs` override) gets it back to true → blanket read, same as an old `sales.*` permission holder.

---

## Retrofit behavior matrix (why the baselines are what they are)

| Module | `member` / `manager` baseline | Preserves today's behavior for… |
|---|---|---|
| `purchase.honeycomb` | none / edit | custom purchase member (no legacy perm) → no access; purchase manager → full; custom with `purchase.hc_extraction` → migrated `edit` override |
| `purchase.honeycomb_history` | none / edit | same as honeycomb |
| `purchase.honeycomb_price_grid` | none / none | dept-admin-only — route now `<RequireModule min="admin">` (an explicit per-user `admin` grant also gets in) |
| `purchase.marble` | none / edit | placeholder page, no real users — route unguarded, gate it when built |
| `purchase.users` | none / none | dept-admin-only — route now `<RequireModule min="admin">` |
| `yaamya.wood_inward` | edit / edit | any Yaamya `departments[]` member can enter rows today |
| `yaamya.inward_log` | none / none | `role='admin' OR yaamya dept-admin` only |
| `sales.mcs` / `sales.mcp` | view / edit | merchant/manager sales member sees the lists (RLS row-scopes); managers get the manage actions; custom with any legacy `sales.*` → migrated `view` override |
| `sales.mcsp_validity` / `_shift` | none / edit | hall managers review their hall's queue (`RequireMcspReviewAccess`); merchants don't |
| `sales.mcsp_recalls` | none / none | admin / dept-admin only |
| `sales.mcsp_buyers` / `_halls` / `_users` | none / none | dept-admin-only |

Legacy `sales.*` permission keys (`view_all_buyers`, `manage_samples`, `manage_panels`, `view_movements`, `manage_users`, `export_data`) **all** migrated to `view` on `sales.mcs` + `sales.mcp` — because in practice that is exactly what they granted (department entry + blanket read; the MCSP UI never gated edit on these keys and MCSP write-RLS never used `has_department_permission`). Richer levels are assigned deliberately from the new admin UI.

> **Note:** managers / merchants / plain members get RLS access exactly as before — via the department-specific clauses in each policy (`mcsp.is_hall_manager_of`, `mcsp.owns_buyer`, `'yaamya' = ANY(departments)`, etc.), **not** via `has_department_permission` (which is now explicit-grant-only — see Compatibility above). A hall manager still sees only their hall; a merchant only their buyers.

---

## Delegation boundary

A **department admin** (`dept = ANY(department_admin_for)`) can, **within their department(s) only**:
- create / edit / delete **non-system** roles (`is_system_role = false`, `department_key` = one of theirs)
- assign any of their department's roles (system or custom) to users **in that department**
- set / clear per-user module overrides for **their** department's modules, on users **in that department**

They **cannot**: touch other departments, see or edit global roles or system roles, create global roles, grant `admin` level outside their department, modify a `role='admin'` user, or grant `department_admin_for` (that stays on the global-admin **Admin → Users** form).

"User X is in department D" ≡ `D = ANY(X.departments) OR D = ANY(X.department_admin_for)`.

All of this is enforced in RLS `WITH CHECK` on the four tables (`roles`, `role_module_access`, `user_role_assignments`, `user_module_access`) and re-checked in the UI.

---

## Admin UI — `/admin/access-control`

Global admin sees everything; a department admin sees the same page scoped to their department(s).

- **Users** — pick a user → read-only "effective access" across every module (level + source: `global_admin` / `department_admin` / `override` / `role:<name>` / `manager_baseline` / `member_baseline` / `none`); assign/unassign roles; set/clear per-module overrides. Every control saves immediately.
- **Roles** — create/edit reusable roles (name + a `none…admin` grid over modules). Dept admins: their departments' modules only, non-system roles only.
- **Audit Log** — searchable `core.access_change_log`, scoped by RLS.

No publish step, no deploy — all changes are immediate DB writes.

---

## Adding a new module (do this for every new feature)

1. **Register it** in a migration:
   ```sql
   insert into core.modules (key, department_key, label, route, sort_order, member_baseline, manager_baseline)
   values ('production.qc', 'production', 'Quality Check', '/production/qc', 10, 'view', 'edit');
   ```
2. **Grant it to the department's system roles** if it should be part of Viewer/Editor/Approver:
   ```sql
   insert into core.role_module_access (role_id, module_key, level)
   select r.id, 'production.qc',
          case r.name when 'Viewer' then 'view' when 'Editor' then 'edit' else 'approve' end::core.access_level
   from core.roles r where r.is_system_role and r.department_key = 'production'
     and r.name in ('Viewer','Editor','Approver');
   ```
   (If `production` has no system roles yet, seed `Viewer`/`Editor`/`Approver` for it first — same shape as migration `0019`.)
3. **Add a row to `src/config/modules.ts`** (`key`, `department`, `label`, `route` — the static mirror, like `departments.ts`).
4. **Gate the route** with `<RequireModule moduleKey="production.qc" min="view">` and gate actions/buttons with `useCan('production.qc', 'edit'|'approve')`. Admin-only surfaces (settings, user management) → `min="admin"`.
5. **Write RLS** on the feature's tables using `core.module_access_level(auth.uid(), 'production.qc') >= '<level>'`. Do **not** copy the old `is_admin() OR is_department_admin() OR has_department_permission() OR departments @> …` boilerplate.
6. The admin UI (`/admin/access-control`) picks the new module up automatically — no UI change needed.

---

## Not covered by this system

**Core Management** (`/core-management`, `/my-tasks`) — its own 2-person allowlist (`core.core_management_admins` + `core.is_core_management_admin()`), deliberately outside departments and this system. Unchanged.
