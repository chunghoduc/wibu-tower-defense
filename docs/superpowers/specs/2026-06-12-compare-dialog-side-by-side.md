# Spec — Side-by-side item compare dialog

**Date:** 2026-06-12
**Status:** Approved (full-auto; designer judgment stands in for user approval)

## Problem

The compare-and-replace modal (`itemCompareDialog.ts`) lists a **single** column: each
row shows the currently-equipped value plus the swap delta. The player can't see the
two items as two distinct things side by side, and the action buttons (Replace / Enhance)
sit in a shared footer with no spatial tie to the item each acts on.

## Request

Redesign the compare UI so:

1. **Two items sit side by side** — the **selected** (bag) item on the **left**, the
   **equipping** (currently-equipped) item on the **right**.
2. The button **under the left (selected) item is Enhance**; the button **under the
   right (equipping) item is Replace**.
3. The **compare deltas move to the left side** — shown in a bracket next to the
   _selected_ item's stat values. If the equipping item has a stat the selected item
   lacks, **add that row** (left side shows the selected value as 0 with its negative
   bracket).

## Design

Zero gameplay/sim change — pure UI + a small additive data change. `HeroScene`'s
`openCompare` call site and the `CompareCallbacks` interface are **unchanged**
(`onReplace` → right button, `onEnhance` → left button, `onClose`).

### Data layer — `src/data/itemCompare.ts`

`CompareRow` gains one additive field:

- `bag: string` — the **selected** item's value, formatted the same way as `equipped`
  (flat for base stats, `%` for fractional/affix). The number the player would _gain_.

Everything else is unchanged: `equipped` (the right column's value), `delta`
(`bag − equipped`, signed), `dir` (1 upgrade / 0 same / −1 downgrade). `compareItems`
already returns the **union** of both items' stat/affix keys, so requirement (3) — extra
rows for stats only the equipped item has — is already satisfied at the data level; the
new field just lets the left column render the selected value (0) for those rows.

### Presenter — `src/scenes/itemCompareDialog.ts` (rewrite)

Two-column card layout into the caller-owned `dialog` container. Dialog width grows to
**~430px** (fits the 960-wide stage), each column ~half.

```
┌───────────────────────────────────────────────[×]┐
│  [icon] Selected           │  [icon] Equipped      │
│  <bag name> +N             │  <eq name> +M         │
│  ─────────── Stats ─────── │ ─────── Stats ──────  │
│  ATK    50 (+10)           │  ATK    40            │
│  HP    100 (+100)          │  HP      0            │
│  Armor   0 (-5)            │  Armor   5            │   ← extra row from equipped
│  ──────── Affixes ──────── │ ────── Affixes ─────  │
│  Crit%  12% (+2%)          │  Crit%  10%           │
│                            │                       │
│      [ ⚒ Enhance ]         │     [ ⇄ Replace ]     │
└───────────────────────────────────────────────────┘
```

- **Headers:** each column shows the item's icon (`item__<defId>` via `makeFitIcon`,
  fallback glyph when the texture is absent — keeps it test/headless safe), name in its
  rarity colour, and `+enhanceLevel` when > 0.
- **Rows:** iterate the shared union list from `compareItems` once; for each entry draw
  it at the **same y** in both columns so the same stat lines up.
  - Left column: `label` (left-aligned) … `bag` value + `(±delta)` (the bracket,
    coloured green/red/neutral by `dir`), right-aligned within the left card.
  - Right column: `label` … `equipped` value, right-aligned within the right card.
- **Section labels** ("Stats", "Affixes") render once per column at the shared y.
- **Buttons:** `⚒ Enhance` centred under the left card → `cb.onEnhance`; `⇄ Replace`
  centred under the right card → `cb.onReplace`. Replace keeps its primary (blue) accent.
- **Chrome:** full-screen scrim closes (`cb.onClose`); a `✕` top-right closes; a faint
  legend "Green = upgrade vs equipped" at the bottom.
- **Sizing:** height grows with `max(stats+affixes rows)` exactly as today; the dialog
  is vertically centred and clamped to the top like the current one.

### Out of scope

- The enhance dialog (`itemEnhanceDialog.ts`) and the free-slot equip flow — untouched.
- Any change to equip/replace logic in `SaveManager`.

## Testing

- **Unit (RED→GREEN):** extend `tests/item-compare.test.ts` — assert the new `bag`
  field for the existing spec example (HP `bag:"100"`, Armor `bag:"50"`, M.Resist
  `bag:"0"`), an enhance-scaled case, and a fractional/affix `%` case. Existing
  assertions on `equipped`/`delta`/`dir` stay green (purely additive).
- **Build/typecheck:** `tsc` + `npm run build` clean.
- **Playtest (CDP):** open HeroScene, force the compare dialog, confirm two columns,
  left-side brackets, Enhance-left / Replace-right, no runtime errors.

## Files

- `src/data/itemCompare.ts` — add `bag` to `CompareRow` + populate in `row()`.
- `src/scenes/itemCompareDialog.ts` — two-column rewrite (stays < 500 lines).
- `tests/item-compare.test.ts` — new `bag`-field assertions.
