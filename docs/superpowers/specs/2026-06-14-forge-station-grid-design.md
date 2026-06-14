# Forge Station Grid — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto session)

## Problem

`ForgeScene` is a vertical scroll of text panels. Every function — Spotlight/Spark,
Craft Wings, Awakening, Alchemy recipes, Copy→Crystal exchange — is a line of text
with a single right-aligned chip button (`Awaken`, `Craft`, `Exchange`, `Claim
Spark Reward`). The player reads sentences like
`5× Soul Jewel → 1× Awakening Crystal` and presses one word. There is no visual
sense of *what goes in* and *what comes out*. The one exception — Craft Wings —
already opens a rich drag-and-drop "machine" dialog, which proves the bar the rest
of the screen should meet.

The request: **redesign the Forge into a grid view where every function has a cool
UI that shows the input and the output of the forge, not just one text button.**

## Goals

1. Replace the text-scroll home with a **grid of station cards**. Each card is a
   tappable tile showing the station's emblem, name, a **mini input → output
   preview** (real icons + an arrow), and a readiness badge.
2. Every station opens a **focused forge dialog** that lays out the transformation
   visually: **INPUT slots → forge arrow → OUTPUT slots**, with the action button
   living *inside* that visual (not a bare word on a text row).
3. **Zero mechanic / balance changes.** All crafting logic (`SaveManager`,
   `core/awakening`, `core/banner`, `data/alchemy`, `core/wingCraft`) is reused
   verbatim. This is a presentation redesign only.
4. **No new art assets** (so no `ASSET_VERSION` bump). Icons come from existing
   textures via `makeFitIcon` (texture-or-emoji fallback); station emblems are
   emoji glyphs on accent panels, matching the codebase's procedural-fallback
   philosophy.
5. Respect the **<500 code-lines per file** rule via a pure-core / Phaser-presenter
   split, consistent with `homeLayout↔homeBarFx`, `mapTiles↔battleTilemap`, etc.

## The five stations

| Station | Input (shown) | Output (shown) | Logic reused |
|---|---|---|---|
| ✦ **Awakening** | N× Awakening Crystal | chosen 5★ tower, ✦ rank +1 (+10% atk/hp) | `awakeningRank/canAwaken/awaken`, `awakeningCost`, `MAX_AWAKENING` |
| ⚗ **Alchemy** | recipe inputs (material icons) | recipe outputs (material icons) | `ALCHEMY_RECIPES`, `craftAlchemy` |
| ♻ **Copy Exchange** | 3× dupe tower copies | 1× Awakening Crystal | `exchangeCopies`, `COPIES_PER_CRYSTAL` |
| 🪽 **Craft Wings** | 5+ gear + Jewel of Chaos + Feather | random-rarity Wings (odds bar) | existing `openWingCraftDialog` / `craftWings` (unchanged) |
| ★ **Spark Spotlight** | 200× Spark | guaranteed featured Unique | `sparks/canClaimSpark/claimSpark`, wishlist `setWishlist`, `SPARK_PITY` |

Awakening and Copy Exchange both depend on banked copies/5★ rosters that vary per
save; their cards show the single most-actionable target (the awakenable tower, the
tower with the most banked copies) and the dialog lets the player pick among all.

## Architecture

Three new modules + a rewritten scene. Wings keeps its bespoke drag machine.

### `src/core/forgeStations.ts` — pure (Phaser-free, unit-tested)

The view-model layer. Knows nothing about Phaser; takes plain counts/ids and
produces icon descriptors and layout rects.

```ts
export interface ForgeIngredient {
  iconKey: string;   // assetKeys texture; "" → emoji
  emoji: string;     // fallback glyph
  color: number;     // rarity/accent tint (hex int)
  qty: number;       // amount in/out
  have?: number;     // owned (input only) — drives have<qty "short" coloring
  label?: string;    // short name under the tile
}

export interface ForgeRecipeVM {
  id: string;
  label: string;                 // e.g. "Soul → Crystal", tower name
  inputs: ForgeIngredient[];
  outputs: ForgeIngredient[];
  canCraft: boolean;
  note?: string;                 // "+10% atk/hp", "random rarity", "Need 200 sparks"
}

export interface StationVM {
  id: "awaken" | "alchemy" | "copies" | "wings" | "spark";
  title: string;
  emoji: string;                 // station emblem glyph
  accent: number;
  ready: boolean;                // hot border on the card
  badge: string;                 // "Ready" | "MAX" | "Need X" | count
  recipes: ForgeRecipeVM[];      // [] for wings (handled by its own dialog)
  preview: { input: ForgeIngredient; output: ForgeIngredient } | null; // card mini-preview
}
```

Pure builders (each takes only primitives the scene reads from `SaveManager`/data,
so they are trivially testable):

- `alchemyRecipeVMs(haves: Record<string,number>): ForgeRecipeVM[]`
- `awakeningVMs(towers: {id,name,rank,crystalsCost,have,canCraft}[]): ForgeRecipeVM[]`
- `copyExchangeVMs(towers: {id,name,copies}[]): ForgeRecipeVM[]`
- `sparkVM(sparks, pity, featuredName): ForgeRecipeVM`
- `wingsStationVM(jewels, feathers, gearCount): StationVM` (preview only)
- `stationPreview(recipes): {input,output} | null` — pick the dominant ready recipe
  (or first) and surface its lead input + lead output for the card.
- `forgeGridLayout(count, width, top): {x,y,w,h}[]` — a 2-column card grid (mirrors
  `homeNavLayout`'s style), returns rects in scene space.

### `src/scenes/forgeStationCard.ts` — presenter

`buildStationCard(scene, rect, vm, onOpen): Container`. Draws: accent rounded panel
(`accentPanel`, `hot=vm.ready`), emblem glyph, title + badge, and a **mini
input→output strip**: `makeFitIcon(input)` · "→" · `makeFitIcon(output)`. The whole
card is interactive (`interactive()` button-feel) and calls `onOpen(vm)`.

### `src/scenes/forgeRecipeDialog.ts` — presenter

`openForgeDialog(scene, {station, confirm, onClose})`. A modal (`dimBackdrop` +
`closeModal`) that renders the chosen station's transformation:

- **Header:** station emblem + title.
- **Recipe selector** (only when `recipes.length > 1`): a vertical strip of compact
  rows (label + a tiny ✓/✗ ready dot); tap to select. Single-recipe stations skip
  it.
- **Transformation panel:** a horizontal lane —
  `[ INPUT slots ]  →⚒→  [ OUTPUT slots ]`. Each slot is an icon tile
  (`makeFitIcon`) with its `qty` and, for inputs, a `have/qty` readout that turns
  red (`COLORS.bad`) when short. The arrow is a styled `⚒` between two chevrons.
- **Note line:** `vm.note` (e.g. "+10% atk/hp", odds).
- **Forge button:** a prominent `interactive` button, enabled only when
  `vm.canCraft`; label reflects the gate ("Forge", "Need 200 Sparks", "MAX").
  Pressing it calls `confirm(stationId, recipeId)` and the scene re-derives + the
  dialog re-renders in place (the selected slots flash / button updates).

The Spark station's output slot shows the featured Unique's tower icon and a
"Cycle Wishlist" secondary action lives in its dialog header.

### `src/scenes/ForgeScene.ts` — rewritten (stays the orchestrator, <500 lines)

`create()`:
1. Title + Back (unchanged).
2. **Resource bar:** a row of icon chips — Awakening Crystal, Spark, Jewel of Chaos,
   Feather — each `makeFitIcon` + a tweened count. Replaces the text currency line.
3. **Station grid:** build `StationVM`s from `SaveManager`, lay out with
   `forgeGridLayout`, render via `buildStationCard`. `staggerIn` the cards.
4. Card tap → `openForgeDialog` (or `openWingCraftDialog` for Wings). On a
   successful craft the scene rebuilds the grid (counts/badges refresh) and toasts.

The data-gathering helpers (which 5★ towers, dupe copies, recipe haves) move into
small private methods that feed the pure builders. No scrolling needed — five
stations + a resource bar fit one 960×540 screen in a 2-column grid.

## Data flow

```
SaveManager / data ─(primitives)→ forgeStations.ts (pure VMs) ─→ ForgeScene
   forgeGridLayout → rects                                          │
   StationVM[]    →  buildStationCard ── tap ──→ openForgeDialog ──┐ │
                                                                   ↓ │
                                       confirm(station,recipe) → SaveManager.<craft>
                                                                   │
                                          re-derive VMs ← rebuild grid + toast
```

## Testing

- **`tests/forgeStations.test.ts`** (pure, TDD-first):
  - `alchemyRecipeVMs`: inputs/outputs map to the right icons & qty; `canCraft`
    true only when every input `have >= qty`; `have` populated.
  - `awakeningVMs`: cost from `awakeningCost(rank)`; `canCraft` honors crystals;
    MAX rank → `canCraft=false`, note "Fully Awakened".
  - `copyExchangeVMs`: only towers with `copies >= COPIES_PER_CRYSTAL`; output is
    one crystal.
  - `sparkVM`: `canCraft` iff `sparks >= pity`; note shows shortfall otherwise.
  - `stationPreview`: prefers a ready recipe; returns null for an empty list.
  - `forgeGridLayout`: N rects, 2 columns, non-overlapping, inside `width`.
- **Presenters** are smoke-covered by the live CDP playtest (open Forge, open each
  dialog, craft one alchemy recipe, confirm counts change), since Phaser rendering
  isn't unit-tested in this repo.
- Full suite + lint + build must stay green.

## Out of scope

- No change to Craft Wings' interaction (its drag machine already satisfies the
  brief); it is merely launched from a station card instead of a text row.
- No new crafting recipes, currencies, balance, or art.
- No persistence/schema changes.
```
