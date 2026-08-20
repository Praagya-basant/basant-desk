# Purchase — department detail

Referenced from the root CLAUDE.md. Full detail lives here so the root file stays short.

## Structure
Two top-level modules under Purchase:
- **Honeycomb Calculator** — built: extraction, price grid, history, users
- **Marble Costing** — placeholder, not built

## Honeycomb Calculator

### Extraction logic (`extractHCRows`)
Deterministic regex-based parsing, no AI involved.
- Splits input on every real product-code token first (not just the first one found) — handles multiple codes in one paste correctly
- Filters out false-positive matches like "30MM" being mistaken for a code
- Thickness/Cell matched to the correct dimension via a lookup window immediately AFTER that dimension (not before/previous — this was a real off-by-one bug, fixed)
- Missing Cell defaults to 12, flagged visually as "defaulted" (distinct treatment from an actual error flag)
- Auto-saves immediately on extract — no manual "Save" button. Corrections happen via post-save edit (department admin only), which writes to an audit history table.

### Price grid
Supplier-aware, not a single fixed grid. Table keyed by (supplier, thickness_mm, cell).
Suppliers seeded from real data: Honeyshield, AB Craft, Vyanktesh, Greencore, N K Packers.
AB Craft is the default selected supplier on the extraction page; user can change it.
Rate formula: `(L × 0.0254) × (W × 0.0254) × price_per_m2[supplier][thickness][cell] × Sheet Qty`

### Access
- Yash Jain = department_admin_for `['purchase']` — full control within Purchase only
- Praagya = global admin, sees everything

## Navigation restructure (in progress)
Sidebar for Purchase specifically:
```
COSTING TOOLS
  Honeycomb Calculator
  Marble Costing

ADMIN
  Price Grid
  Users
  History
```
Part of the platform-wide nav shell — see root CLAUDE.md.

## Known gotchas specific to Purchase
- extractHCRows had two subtle bugs found only through real testing: (1) code-boundary detection must scan the WHOLE input for every real code, not grab everything after the first one found; (2) thickness/cell lookup window must look after the CURRENT dimension, not the previous one. Any future changes to this function must be tested against real multi-code, multi-size input before considered done.
