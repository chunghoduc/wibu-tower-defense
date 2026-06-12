# Loot / Reward Tile Name-Plate Redesign

**Date:** 2026-06-12
**Status:** Design approved (full-auto session)

## Problem

Item / material / reward names rendered on tiles spill **outside** the tile
background and read as broken. The cause is structural, repeated across every
loot-style tile in the game:

1. The tile draws a **fixed-size** rounded-rect background.
2. A name `Text` is then placed at a hand-picked `y` near the bottom with
   `wordWrap: { width: tileW - pad }` — but the background was never sized to
   reserve that text band.
3. A long, multi-word name wraps to a 2nd (or 3rd) line whose baseline falls
   *below* the tile's bottom edge, so the glyphs hang off the plate.
4. There is no shrink-to-fit or ellipsis floor, so name length alone drives the
   overflow.

Concrete offenders (all confirmed in code):

| File | Line | Tile box | Name band | Overflow mode |
|------|------|----------|-----------|---------------|
| `boxOpenOverlay.ts` | 130 | `86×72`, bottom `y=36` | text at `y=22`, wrap `78`, no reserved band | 2-line name (e.g. "Legendary Boss Chest ×2") runs to `y≈44`, **below the plate** |
| `spinReel.ts` | 43 | `132×104`, bottom `y=52` | text at `y=30`, wrap `120` | long prize labels wrap past the cell |
| `jewelOverlay.ts` | 131 | `88×78`, bottom `y=39` | text at `y=20`, wrap `82` | long jewel names wrap past the tile |
| `ExpeditionScene.ts` | 125 | `~102×76` | text at `y=h/2-16`, wrap `w-8` | long character names wrap past the tile |
| `summonResultOverlay.ts` | ~150 | `~84×96` | character name band | same pattern |
| `rewardPanel.ts` | 185 | `56×56`, in `ROW_H=78` row | rarity word only (not a full name) | fits today, but inconsistent styling |

## Goal

Names are **always** rendered fully inside a dedicated, visually distinct band
that is part of the tile background — a "name plate". Text never spills off the
plate regardless of name length: it auto-shrinks within a font range, then
ellipsis-truncates at the floor. One shared component drives every loot/reward
tile so the look is consistent and the bug cannot recur per-call-site.

## Approach (chosen)

**Reserve a name-plate band in the tile background + a shared auto-fit text
helper.** Considered alternatives:

- *Auto-fit text only (no plate)* — fixes horizontal spill but not the vertical
  case in `boxOpenOverlay` where the label sits below the box; rejected.
- *Background grows to fit text (dynamic plate height)* — variable tile heights
  make grids ragged and break the existing centered grid math; rejected.
- *Reserved plate band + auto-fit text* — fixed tile footprint (grids stay
  clean), text is structurally contained, and one component standardises the
  look. **Chosen.**

### Component 1 — pure fit planner: `src/scenes/labelFit.ts` (Phaser-free, tested)

```ts
export interface FitOpts {
  maxWidth: number;   // px the text band allows
  maxLines: number;   // hard cap (default 2)
  basePx: number;     // preferred font size
  minPx: number;      // smallest font before ellipsis kicks in
}
export interface FitPlan {
  fontPx: number;
  lines: string[];    // already word-wrapped, ready to join with "\n"
  truncated: boolean; // true if an ellipsis was applied
}
export type Measure = (text: string, fontPx: number) => number; // width in px

export function fitLabel(text: string, opts: FitOpts, measure: Measure): FitPlan;
```

Algorithm:

1. For `px` from `basePx` down to `minPx`: greedily word-wrap `text` at
   `maxWidth` using `measure`. If the wrap yields `≤ maxLines` lines and every
   line measures `≤ maxWidth`, return `{ fontPx: px, lines, truncated: false }`.
2. If nothing fits down to `minPx`: wrap at `minPx`, keep the first `maxLines`
   lines, and ellipsis-truncate the **last kept** line (drop trailing chars,
   append `…`) until it measures `≤ maxWidth`. Return `truncated: true`.
3. A single word wider than `maxWidth` is hard-broken at the character level so
   it can never overflow (degenerate guard).

The function is pure and deterministic given an injected `measure`, so tests use
a synthetic monospace measure (`width = chars * fontPx * k`) and assert: short
names keep `basePx` on one line; medium names drop a font step or wrap to 2
lines; very long names end `…` and never exceed `maxWidth`/`maxLines`.

### Component 2 — presenter: `src/scenes/namePlate.ts` (thin Phaser layer)

```ts
export interface PlateOpts {
  width: number;        // tile width
  topY: number;         // y of the plate's top edge (plate spans topY..topY+height)
  height: number;       // plate band height
  radius: number;       // bottom-corner radius (matches the tile)
  accent: number;       // rarity / reward color for the divider line
  color: string;        // text color
  basePx?: number; minPx?: number; maxLines?: number;
}
export function addNamePlate(
  scene: Phaser.Scene, container: Phaser.GameObjects.Container,
  text: string, opts: PlateOpts,
): void;
```

Responsibilities:

- Draw the plate band into a `Graphics`: a darker fill (`0x0b1119`, the existing
  tile fill darkened) covering the band, with only the **bottom** corners
  rounded to match the tile, and a 1px `accent`-colored divider line at the
  band's top edge at low alpha (~0.5). This makes the name region read as an
  intentional "plate", visually separated from the icon area.
- Build a `measure` from a cached offscreen `CanvasRenderingContext2D` using the
  same font family as `crispText` (`canvas.measureText` matches Phaser's own
  text metrics), call `fitLabel`, then add the name via `crispText` with the
  planned `fontPx` and `lines.join("\n")`, vertically centered in the band.

Text geometry is owned by `fitLabel`; the presenter only draws and places.

### Component 3 — wire the shared component into every loot/reward tile

Each call site swaps its ad-hoc background + name `Text` for: (a) an icon region
sized to the tile minus the plate band, and (b) one `addNamePlate(...)` call.
Tile **footprints stay the same width**; height grows only where a reserved band
demands it, and grid layout math is updated in lockstep:

- `boxOpenOverlay.ts` — tile `86×84` (was `72`): icon region top `~56px`, plate
  bottom `28px`. Count suffix (`×N`) stays in the name string.
- `spinReel.ts` — keep `132×104`; carve a `~30px` plate at the bottom for the
  prize label.
- `jewelOverlay.ts` — tile `88×84` (was `78`); plate `~28px`. The `✕` affordance
  stays top-right.
- `ExpeditionScene.ts` — reserve a `~26px` plate at the bottom of the existing
  tile for the character name.
- `summonResultOverlay.ts` — reserve a plate for the character name.
- `rewardPanel.ts` — adopt the same plate styling for its rarity-word label so
  the loot panel matches the rest (no layout-breaking change; the `ROW_H=78`
  row already reserves space below the `56×56` tile). Full item names stay in
  the hover tooltip, per existing design — the plate just standardises the
  small label's look and guarantees containment.

## Out of scope

- Inventory bag tiles (`HeroScene.makeTile`) show only a fallback emoji string,
  not names — untouched except where they already share the component.
- Shop hover labels (`ShopScene`) render names in a separate bottom-of-screen
  label, not on the tile — untouched.
- No change to which names/text each tile shows (icons-carry-meaning design for
  `rewardPanel` is preserved); this is purely about containment and styling.

## Testing

- `labelFit.test.ts` (Vitest, pure): one-line-fits, font-step-down, two-line
  wrap, ellipsis floor, never-exceeds-maxWidth/maxLines, single-long-word hard
  break, empty string.
- A guard test asserting the presenter places text within the plate band
  (compute expected bounds from `fitLabel` output; no Phaser render needed —
  assert on the plan + geometry).
- `tsc --noEmit`, full Vitest suite, `npm run build` all green.
- CDP self-playtest: open a boss chest and a lucky spin, confirm names sit
  inside their plates (visual montage to chat).

## Risks

- `canvas.measureText` font must match `crispText`'s font family exactly or the
  plan under/over-estimates width. Mitigation: share one font-family constant
  between `ui.ts` and the presenter's measure.
- Tile height changes ripple into grid centering math at each call site — update
  the per-site totals (`tw`/`ty`, `CELL` height, grid row height) together and
  eyeball each in the playtest.
