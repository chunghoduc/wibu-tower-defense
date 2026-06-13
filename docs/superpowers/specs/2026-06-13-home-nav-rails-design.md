# Home navigation: side rails + bottom row

**Date:** 2026-06-13
**Status:** Approved (full-auto session)

## Problem

The main-menu home screen currently dumps all 11 secondary destinations into a
single 6×2 grid jammed into a bottom dock (`homeNavLayout` → `cells`). It reads
as an undifferentiated wall of icons, hides the painted diorama behind a tall
dock, and gives no visual hierarchy. The user asked to "re-arrange the icons …
1 left column, 1 right column and bottom rows", learning from other games.

## Reference (what other games do)

Idle/gacha home screens (AFK Arena, Summoners War, Idle Heroes, Seven Knights)
**frame the central character diorama** with two vertical rails of feature
buttons at the screen edges, and reserve a compact bottom bar for the primary
action + a few system/daily entries. The hero stays the focal subject; features
are reachable without burying the art.

## Design

Replace the single bottom grid with **three regions** around the diorama:

- **Left rail** — a vertical column of icon buttons at the left edge.
- **Right rail** — a vertical column at the right edge.
- **Bottom row** — the remaining icons in one centered row, beneath the wide
  primary **BATTLE** CTA, inside the existing framed dock panel.

### Why edges are safe

The diorama elements occupy the center and inner walls; the rails take the
extreme edges, so nothing collides:

| element            | x range            | rail x         |
| ------------------ | ------------------ | -------------- |
| gear hangers       | 0.13W / 0.87W      | ~42 / W−42     |
| squad stand        | 0.16W … 0.84W      | (outside)      |
| hero / Set-Squad   | 0.5W               | (outside)      |
| pet wander         | 0.4W … 0.6W        | (outside)      |

The rails sit **outside** the gear hangers — nav buttons frame the outer edge,
floating gear sits just inside them. Rails are vertically **centered** in the
mid-band (≈0.24H … 0.72H), clear of the top resource pills and the bottom dock.

### Item partition (11 secondary → 4 / 4 / 3)

Grouped by intent so each rail reads as a category:

- **Left rail (loadout / character):** Squad, Inventory, Skills, Passives
- **Right rail (acquire / economy):** Summon, Shop, Forge, Codex
- **Bottom row (daily / system):** Quests, Activities, Settings

BATTLE remains the promoted primary CTA in the bottom dock.

### Pure geometry (`homeNavLayout`)

Rewrite `homeNavLayout` to return regioned cells instead of a flat grid:

```ts
interface NavLayout {
  panel: Rect;      // bottom dock background (BATTLE + bottom row only)
  primary: Rect;    // BATTLE CTA
  left: NavCell[];  // left rail, top→bottom
  right: NavCell[]; // right rail, top→bottom
  bottom: NavCell[];// bottom row, left→right, centered
}
function homeNavLayout(
  counts: { left: number; right: number; bottom: number },
  W: number, H: number,
): NavLayout
```

- **Rails:** cell `RAIL_W×RAIL_H` (≈60×52). Each rail is a vertically centered
  stack about `H*0.46` with a fixed gap; left x = `MARGIN + RAIL_W/2`, right
  x = `W − MARGIN − RAIL_W/2`. Cells ordered top→bottom.
- **Bottom dock:** unchanged framing, but the panel only holds the primary CTA
  plus a single centered row of `counts.bottom` cells (no second grid row, no
  `rowDivider`).

### Presenter (`MainMenuScene.drawMenu`)

Split `SECONDARY_ITEMS` into `LEFT_ITEMS`, `RIGHT_ITEMS`, `BOTTOM_ITEMS`
constant arrays. Pass their lengths to `homeNavLayout`. Render the dock panel +
BATTLE as today; place rail/bottom items via the new `left/right/bottom` cells
through the existing `iconButton`. Badge/glyph/fallback logic is untouched.

## Invariants (tested)

1. `left.length/right.length/bottom.length` equal the requested counts.
2. Left rail cells are all near the left edge (x < W·0.15); right rail near the
   right edge (x > W·0.85); they don't overlap the center band.
3. Each rail's cells ascend in y (top→bottom), x constant within a rail.
4. Rails are vertically centered (stack midpoint ≈ H·0.46) and clear of the top
   band (y > H·0.18) and the bottom dock (cell bottoms < panel.y).
5. Bottom-row cells sit inside the dock panel, below the primary CTA, ascend in
   x, and are horizontally centered on W/2.
6. The dock stays in the lower part of the screen and on-screen.

## Out of scope

No art regen, no new icons (reuse `menuTex`), no change to destinations/scenes,
no change to the diorama, top bar, or `homeRoom` geometry. SDXL pipeline
untouched.
