# Hero Total-Stats Panel — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session)

## Problem

The Inventory loadout screen (`HeroScene`) shows an equipment paper-doll and a
draggable bag, but nowhere does it surface the **hero's aggregate stats**. A
player equipping gear can't see what the gear actually does to their hero's
totals (ATK, HP, crit, etc.). The request: _show the hero's total stats
beside/under the doll._

## Constraints

- Canvas is fixed **960×540** (`GAME_WIDTH`/`GAME_HEIGHT`).
- Current layout: doll panel `DOLL_PANEL = { x:26, y:94, w:300, h:418 }` (bottom
  y512); inventory `invRect = { x:360, y:96, w:580, h:380 }` (bottom y476). The
  34px gap beside the doll and the 28px strip below it are both too small for a
  multi-row stat block.
- `HeroScene.ts` is 478 lines — must stay under the hard 500-line limit, so new
  rendering goes in its own module.
- The hero's resolved stats already have a single tested home:
  `resolveHeroBattleStats(save, base)` in `src/core/heroStats.ts`. We reuse it —
  no new stat math.

## Approach

**Shrink the doll panel and add a stats panel beneath it in the left column.**

The doll's slots are positioned by _normalized_ anchors (`nx`/`ny` in `0..1`) and
the mannequin image auto-scales to the panel, so reducing the panel height
reflows everything cleanly. This frees vertical room in the left column for a
dedicated stats panel directly under the doll — grouping the doll + totals as one
"character sheet" on the left, with the bag on the right.

Rejected alternatives:

- _Beside the doll_ (in the 34px gap) — too narrow for labels + values.
- _Below the inventory_ (right column, 64px strip) — physically far from the
  doll and disconnected from the loadout the player is editing.

## Layout changes

- `DOLL_PANEL.h`: **418 → 300** (`heroDoll.ts`). Doll now spans y94..394.
- New **Total Stats panel**: left column, `{ x:26, y:398, w:300, h:136 }`
  (bottom y534, inside the 540 canvas). Rounded-rect frame matching the doll
  panel's style (`0x0e1622` fill, `0x2a3a56` stroke).

## New module: `src/scenes/heroStatsPanel.ts`

Two exports — one pure (testable), one presentational.

### `heroStatRows(stats: Stats): { label: string; value: string }[]` (pure)

Selects the ~12 hero-relevant stats in display order and formats each:

| key         | label     | format                |
| ----------- | --------- | --------------------- |
| atk         | ATK       | integer               |
| attackSpeed | Atk Spd   | 1 decimal             |
| range       | Range     | integer               |
| critRate    | Crit      | percent               |
| critDamage  | Crit Dmg  | `×` multiplier (1 dp) |
| maxHp       | HP        | integer               |
| hpRegen     | HP Regen  | 1 decimal             |
| armor       | Armor     | integer               |
| magicResist | M.Resist  | integer               |
| skillPower  | Skill Pwr | `×` multiplier (1 dp) |
| omnivamp    | Omnivamp  | percent               |
| moveSpeed   | Move Spd  | integer               |

Formatters mirror the conventions already used in `squadInfoPanel.ts`
(`n0`/`n1`/`pct`/`mult`). This function is the unit under test.

### `renderHeroStats(scene, container, box, save)` (presentation)

1. Resolve totals: `resolveHeroBattleStats(save, defaultHeroStats()).stats`.
2. Draw the panel frame + a "Total Stats" header.
3. Lay `heroStatRows(stats)` into a 2-column grid (label left, value
   right-aligned), 6 rows per column, ~15px row pitch — matching
   `squadInfoPanel`'s stat-grid idiom.

All game objects are appended to the passed `container` so the caller owns
lifecycle (clear-and-rebuild on refresh).

## HeroScene wiring

- Add a `private statsBox!: Phaser.GameObjects.Container` created in `create()`.
- Draw the static panel frame once in `create()`; render rows into `statsBox`.
- In `refresh()` (already called on every equip/unequip/drop), clear `statsBox`
  and call `renderHeroStats(...)` again so totals update **live** as gear
  changes.

## Testing (TDD)

`tests/heroStatsPanel.test.ts`:

- `heroStatRows` returns rows in the documented order with the documented labels.
- Formatting: `atk` → integer string; `critRate` 0.25 → `"25%"`; `critDamage`
  1.5 → `"1.5×"`; `attackSpeed` 1.1 → `"1.1"`.
- A representative `defaultStats()`-derived input produces a complete 12-row
  list (no missing/extra keys).

No rendering is unit-tested (Phaser scene objects); the presenter is exercised by
the existing playtest harness.

## Out of scope

- Stat tooltips / breakdown by source (gear vs passives) — totals only.
- Comparison deltas while hovering a bag item (the compare dialog already covers
  per-item deltas).
- Re-theming the doll panel beyond the height change.
