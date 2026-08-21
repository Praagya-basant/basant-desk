# Design System — BASANT Desk

Applies to every department and module, platform-wide. Not decided per-module. Refines (does not replace) the original minimal direction — adds a real accent color, concrete type scale, and component rules.

## Direction
Calm, confident work tool — not a marketing site. Notion/Linear-level restraint, with one deliberate accent color for actions (inspired by Zoho/Notion's use of a single strong blue for CTAs against mostly black/white/grey). No gradients, no decorative illustration, no heavy shadows.

## Color
```
--bg:            #FFFFFF
--surface-1:     #F8F8F7   (cards, sidebar)
--surface-2:     #F1F1EF   (nested/hover surfaces)
--border:        #E8E8E5
--text-primary:  #1A1A1A
--text-secondary:#6B6B6B
--text-muted:    #9B9B96

--accent:        #2563EB   (primary buttons, links, active nav, focus rings)
--accent-hover:  #1D4ED8

--success:       #16A34A
--warning:       #D97706   (flagged/error rows)
--info:          #2563EB   (defaulted/assumption rows — same as accent, lower emphasis via lighter tint)
```
Accent is used sparingly: primary CTA buttons, active sidebar item, links, focus states. Never as a background fill for large areas.

## Typography
Font: Inter (unchanged).
```
Display   32px / 600 / -0.02em   — page-level headers only (e.g. "Purchase")
H1        24px / 600             — section headers (e.g. "HC Price Grid")
H2        18px / 600             — card/module titles
Body      14px / 400             — default text, table cells
Small     13px / 400             — secondary text, captions, badges
Label     12px / 500 / uppercase / 0.03em letter-spacing — section labels (e.g. "COSTING TOOLS")
```

## Spacing
8px base unit. Use multiples: 4, 8, 12, 16, 24, 32, 48.
Card padding: 20px. Section gaps: 32px. Inline element gaps: 8–12px.

## Components

**Buttons**
- Primary: `--accent` background, white text, 8px radius, no shadow. Hover: `--accent-hover`.
- Secondary: white background, `--border` outline, `--text-primary` text.
- Destructive: white background, red outline/text, filled red only on hover.

**Inputs**
- White background, `--border` 1px outline, 8px radius, 10px vertical padding.
- Focus: `--accent` outline, 2px.

**Cards**
- `--surface-1` background, `--border` 0.5–1px outline, 12px radius, no shadow (or a barely-there 1px soft shadow at most).

**Tables**
- Header row: `--surface-2` background, `Label` style text.
- Row borders: `--border`, 1px, bottom only.
- Numeric columns: right or center aligned, never left.

**Status badges / flags**
- Flagged/error: `--warning` left-border accent (3px) + light warning-tint background, `Small` text.
- Defaulted/assumption (e.g. "Cell defaulted to 12"): `--info` left-border accent, lighter tint than warning — visually distinct, not alarming.
- Success/saved: `--success`, used sparingly (e.g. a small dot or checkmark, not a full badge).

## What NOT to do
No gradients. No drop shadows beyond a 1px soft shadow. No more than one accent color. No illustration/emoji-style icons — line icons only (current icon set is fine). No centered marketing-style hero sections inside the app — this is a tool, not a landing page.
