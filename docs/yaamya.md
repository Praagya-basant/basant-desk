# Yaamya Industries — department detail

Referenced from the root CLAUDE.md. Full detail lives here so the root file stays short.

## Origin
Ported from a standalone app (`../Yaamya Industries`, Supabase ref `xvgclfsikyndkpumbcvn`,
now considered legacy). Only the **Wood Inward** module was ported. The old app also had
Issue-to-Hall, Quality Check, Chamber Status, DSP Machining, BOM-vs-Actual, Wood Inventory,
Hall Dashboard, Executive Summary and Reports — none of those came across; port them later
as deliberate steps if still needed. The old app talked to its own Supabase project with the
anon key and open RLS; this port uses `core.users` identity + real per-department RLS.

## Structure
One module under Yaamya so far:
- **Wood Inward** — built. Piece-by-piece timber measurement + full receiving log.

Routes (mounted in `src/App.tsx` via `YaamyaModule`, same pattern as `PurchaseModule`):
```
/yaamya                 YaamyaHome — module cards
/yaamya/wood-inward     WoodInward — entry form + Today's Log tab   (any Yaamya member)
/yaamya/inward-log      InwardLog  — history, summaries, Excel export (Yaamya admin only)
```

## Wood Inward (`/yaamya/wood-inward`)
Touch-first entry form, meant for a tablet at the yard gate. Two tabs: **Entry** and **Today's Log**.

Flow ("one truck at a time"):
1. Set up the truck once: Location (Bhandu / Boranada), Wood Condition, Source, Wood Type,
   Bill No, Checker Name, Height/Thickness.
   - Unseasoned ⇒ Source auto-set to "Outsourced" (locked).
   - Seasoned ⇒ choose "Outsourced" (asks Supplier Name) or "Basant Chambers" (asks Batch Code).
2. Per plank: tap Length (ft) / Width (in) / Pieces on the on-screen keypad, pick Good/Bad,
   hit **SAVE PIECE**. The row is inserted optimistically (form resets instantly; a slow or
   failed insert never blocks the next measurement) and the running truck total updates.
3. **END TRUCK** shows a 3-second summary overlay (bill no, pieces, good/bad Cft) then clears
   the setup for the next truck.

### CFT formula (do not "simplify")
Length is **feet**, width and height are **inches**:
```
total_cft = (length_ft × width_in × height_in × pieces) / 144
```
`/144`, **not** `/1728`. `/1728` is only correct when all three dimensions are inches; using
it here silently under-reports every entry by 12×. Lives in `computeCft()` in
`src/lib/yaamya/db.ts`.

`entry_date` / `entry_time` are computed client-side (yard wall-clock, not UTC).

## Inward Log (`/yaamya/inward-log`)
Manager view — gated to `role = 'admin' OR 'yaamya' = ANY(department_admin_for)`.
Today stat tiles (always "today", independent of filters) + filters (date range, supplier,
wood type, location, condition, quality) + three tables: Bill-wise summary, Supplier-wise
totals, All entries. "Export to Excel" dumps the filtered detail rows via SheetJS
(`src/lib/yaamya/exportToExcel.ts`).

Live: `useWoodMeasurements` subscribes to `postgres_changes` on `yaamya.wood_measurements`,
so entries appear as workers save them.

## Database — `yaamya` schema
Migration: `create_yaamya_schema_wood_measurements`.

`yaamya.wood_measurements` (column shape kept identical to the old app for export continuity):
```
id bigint identity PK, created_at, entry_date, entry_time,
location, wood_type, wood_condition, source, supplier_name, batch_code,
bill_no, checker_name, height_inches, length_ft, width_inches, pieces,
total_cft, quality ('Good' | 'Bad'), user_id → core.users(id) ON DELETE SET NULL
```

RLS (mirrors the purchase-schema policy shape):
- **select / insert** — global admin, Yaamya dept admin, anyone with a `yaamya.*` fine-grained
  permission, or any user whose `departments` contains `'yaamya'`.
- **update / delete** — global admin or Yaamya dept admin only (entry corrections are a
  manager action).

Realtime: table added to the `supabase_realtime` publication, `replica identity full`.

### ⚠️ Manual step (done, but verify)
The migration adds `yaamya` to `pgrst.db_schemas` via `ALTER ROLE authenticator`, but the
**Supabase dashboard → Settings → API → Exposed schemas** is the canonical source and will
overwrite that on the next save there. Confirm `yaamya` is listed in the dashboard.

## Access — assigning users
No Yaamya users page was built. Assign access the same way as any department:
- Yard workers: add `'yaamya'` to `core.users.departments`.
- Yard managers: add `'yaamya'` to `core.users.department_admin_for`.
Currently only Praagya (global admin) has access.

## Not ported / open
- The old app's `worker` role + full-screen kiosk shell has no equivalent here — the entry
  form renders inside the normal Layout (sidebar + breadcrumb). Workers just get a `departments`
  entry, not a special role.
- Old modules listed under "Origin" above.
- Keypad feedback sounds were ported (`src/lib/yaamya/sound.ts`).
