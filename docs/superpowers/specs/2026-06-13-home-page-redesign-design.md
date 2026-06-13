# Home Page (Main Menu) Redesign — Design Spec

**Date:** 2026-06-13
**Scene:** `src/scenes/MainMenuScene.ts`
**Status:** Approved (full-auto session — self-approved)

## Problem

The home page composites a genuinely beautiful SDXL cathedral background
(`public/assets/bg/menu-hall.png`) with several **flat, procedurally-drawn
foreground elements that visually clash with the painted hall**, making the
overall screen look cheap and "ugly":

1. **Cardboard throne** — `drawThrone()` paints the king's chair and dais as flat
   brown `fillRoundedRect` blocks with triangle "crown finials", sitting directly
   over the rendered cathedral. This is the single ugliest element: a 2D blocky
   prop in front of a painterly 3D scene.
2. **Inconsistent iconography** — the 12 nav buttons mix art styles. 9 are
   polished gold-framed painted SDXL emblems (`public/assets/ui/menu/*.png`), but
   **`quests`, `activities`, `forge` have no painted icon** and fall back to crude
   white-line procedural glyphs (`drawMenuGlyph`).
3. **Edge-scattered navigation** — 12 buttons are crammed onto three screen edges
   (left 5 / right 3 / bottom 4) with tiny 10px labels and no framing, overlapping
   the painted scene. Reads cluttered, not premium.
4. **Procedural wall-hangers** — equipped gear hangs on flat brown bars + drawn
   rope lines, again clashing with the painted walls.

## Goals

- A cohesive, premium "anime gacha home screen": a cinematic painted **diorama**
  up top, a clean **navigation dock** at the bottom.
- All-painted, consistent iconography (no procedural glyphs in the normal path).
- Remove every flat-procedural prop that fights the painted hall.
- Mobile-friendly (web + 2 mobile targets), deterministic, unit-testable.
- Built with the project's existing **SDXL art flow** (regenerate the background,
  generate the 3 missing icons) — no new art pipeline.

## Design Decisions

### 1. Throne — bake it into the SDXL background; delete the procedural prop

The 2026-06-12 "cinematic menu backdrop" pass deliberately removed the throne
from the painted hall (to avoid a "double-throne clash") and substituted a
procedural chair. **That procedural chair is the problem.** We invert the earlier
decision: regenerate `menu-hall.png` with a single **grand ornate throne on a
raised dais, centred in the lower third**, baked into the painting — then
**delete `drawThrone()` entirely**.

The hero sprite (already centred at `y = H*0.5`) then stands on/before the
painted dais — "the king before his throne" — and the squad stands on the dais
steps at `y = H*0.74`. One throne, fully painted, no clash.

- Regenerate via `scripts/sdart/genBackgrounds.mjs` with an updated prompt:
  ornate empty throne + broad dais steps, centred, seat around mid-height so the
  hero stands in front, steps in the lower third for the squad. Generate
  candidates, review, copy the best over `public/assets/bg/menu-hall.png`.
- Bump `ASSET_VERSION` (cache-bust the regenerated background).

### 2. Generate the 3 missing painted menu icons

Generate `quests.png`, `activities.png`, `forge.png` (128×128) via the local
Z-Image API, matching the existing gold-framed painterly emblem style
(crossed-swords-on-shield `battle`, coin-pouch `shop`, gem-star `passive`):

- **quests** — an unfurled parchment scroll with a wax seal / green check, gold frame.
- **activities** — a calendar/almanac page with a radiant star burst, gold frame.
- **forge** — a glowing anvil with hammer and sparks, gold frame.

Add the 3 ids to `PreloadScene`'s menu-icon load list. `drawMenuGlyph` stays only
as the missing-texture fallback (defensive), never the normal path.

### 3. Bottom navigation dock (6×2 grid) — replaces the edge-scatter

Replace the three-edge scatter with one cohesive **bottom dock**: a
semi-transparent framed panel holding all 12 destinations in a **6 columns × 2
rows** grid. This frees the upper ~70% of the screen as the painted diorama
stage (throne + hero + squad + pet + atmosphere) and gives a thumb-reachable,
mobile-friendly nav.

Logical grouping (row 1 = core loop, row 2 = meta):

- **Row 1:** Battle · Summon · Squad · Inventory · Forge · Shop
- **Row 2:** Quests · Activities · Skills · Passives · Codex · Settings

Each cell: painted icon (~48px) + label below + red notification badge
(unchanged behaviour). Hover/press tweens unchanged. The `side` field on
`MenuItem` is replaced by simple array order.

### 4. Wall-hangers — soften the procedural framing

Keep showing equipped gear on the side walls (it personalises the hall), but drop
the flat brown bar + hook + drawn rope. Float each item icon with a soft drop
shadow and the existing gentle sway. Less procedural, still readable.

### 5. Header — minor polish

Keep the logo + title. Put the gold counter in a small framed `uiKit` chip
instead of bare stroked text. Low-risk polish.

## Architecture

- **`src/scenes/menuLayout.ts`** (NEW, pure, Phaser-free): computes the nav-dock
  geometry — the dock panel rect and a per-item `{ x, y, cell }` for a 6×2 grid,
  given `W`, `H`, and item count. Unit-tested. Keeps `MainMenuScene` lean.
- **`scripts/sdart/genBackgrounds.mjs`**: updated prompt to bake throne + dais.
- **`public/assets/ui/menu/{quests,activities,forge}.png`**: new SDXL icons.
- **`src/scenes/PreloadScene.ts`**: load the 3 new icons.
- **`src/scenes/MainMenuScene.ts`**: delete `drawThrone`; rewrite `drawMenu` to
  use `menuLayout`; reorder `MENU_ITEMS`; soften `drawHangers`; chip header.
- **`src/data/assetVersion.ts`**: bump.

## Testing

- **`tests/menuLayout.test.ts`** (TDD red→green): 6×2 grid produces 12 cells;
  every cell sits inside the dock panel; cells don't overlap; the grid is
  horizontally centred; dock panel sits in the lower portion of the screen and
  within bounds; layout is pure (same input → same output).
- **Verify whole:** `tsc --noEmit` + full `vitest` + `vite build`.
- **Visual:** headless playtest screenshot of `MainMenuScene` before/after.

## Out of Scope / Non-Goals

- No change to navigation destinations or scene wiring (same 12 scenes).
- No change to homeRoom squad/hanger/pet anchor maths beyond the hanger visual.
- No new art-generation tooling — reuse `genBackgrounds.mjs` + direct Z-Image curl.
- Protected dirty working-tree files (tower sprites, `spriteManifest.ts`,
  `gacha.ts`, `scripts/sdart/regen_seeds.json`, `sync_manifest.mjs`) stay untouched.

## File-size discipline

`MainMenuScene.ts` is ~497 lines today and must stay < 500 code lines. Extracting
`menuLayout.ts` and deleting `drawThrone` + the now-unused procedural-glyph paths
for the 3 newly-painted icons should keep it comfortably under budget; if not,
split the procedural-glyph fallback into its own module.
