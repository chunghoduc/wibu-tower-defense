# Craft Wings — Drag-and-Drop Craft Machine

**Date:** 2026-06-13
**Status:** Approved (full-auto session)

## Problem

The current Craft Wings dialog (`src/scenes/wingCraftDialog.ts`) is a flat
tap-to-toggle grid. It works, but it reads like a spreadsheet, not a forge: the
player taps tiles, nudges a `−/+` jewel counter, and reads a one-line preview.
There is no sense of *loading a machine*, the materials (Jewel of Chaos,
Feather) are shown only as text counts (not interactive), and the outcome odds
are a cramped text run.

The request: a **craft machine** the player **drags items and materials into**.
The **Craft button stays locked until the minimum requirements are met**, and the
UI **shows the success rate and the chance of each wing rarity**.

## Goals

- Drag inventory items from a tray **into a central machine/cauldron**; each loaded
  item shows inside the machine. Drag (or tap) a loaded item to send it back.
- The two **materials are draggable stacks**: the Jewel of Chaos stack (each drop
  loads one jewel, 1–4, capped by owned) and the Feather stack (loads the single
  required feather). Loaded materials sit in dedicated machine sockets.
- The **Craft button is disabled until the gate passes** (≥5 items **and** ≥1 jewel
  **and** the feather), and visibly glows when ready.
- A **readout** shows: items loaded `N/5`, jewels `J/4`, feather ✓/✗, the **success
  rate %**, and a **stacked, color-coded bar of the outcome rarity odds** with labels.
- The drop zone **highlights while a draggable hovers** over it (drag affordance).

## Non-Goals (YAGNI)

- No change to the craft math or economy — `src/core/wingCraft.ts`
  (`wingSuccessChance`, `wingOutcomeOdds`, `craftWings`, the stake-always-paid rule)
  is untouched. This is a **UI re-skin + interaction model** over the same engine.
- No change to `ForgeScene`'s wiring contract: the existing `WingCraftOpts`
  (`items`, `jewelsOwned`, `feathersOwned`, `preview`, `confirm`, `onClose`) stays
  the public surface, so `ForgeScene.openWingCraft()` needs no edits.
- No persistent "saved loadout" — the machine resets when the dialog closes.

## Architecture

Two units, mirroring the repo's pure-core / Phaser-presenter split:

### 1. `src/core/wingCraftMachine.ts` — pure, Phaser-free, tested

The geometry + gating brain. No Phaser import.

```ts
export interface MachineGate {
  canCraft: boolean;
  needItems: number;   // how many MORE items required (0 when satisfied)
  hasJewel: boolean;   // ≥1 jewel loaded AND owned
  hasFeather: boolean; // feather loaded AND owned
}
export function wingCraftGate(input: {
  itemCount: number; jewels: number; feather: boolean;
  jewelsOwned: number; feathersOwned: number;
}): MachineGate;

export interface Rect { x: number; y: number; w: number; h: number; }
export interface MachineLayout {
  panel: Rect;        // the modal card
  machine: Rect;      // the cauldron / drop zone
  jewelSocket: Rect;  // where loaded jewels render (badge count)
  featherSocket: Rect;
  readout: Rect;      // success% + odds bar region
  oddsBar: Rect;
  craftBtn: Rect;
  tray: Rect;         // scrollable item tray
}
export function wingMachineLayout(W: number, H: number): MachineLayout;

// Arrange up to `count` loaded item icons in a centered grid inside `machine`.
export function loadedSlotLayout(
  count: number, machine: Rect, cell?: number,
): { x: number; y: number }[];

// Split the outcome odds into contiguous colored segments spanning `bar.w`.
export interface OddsSegment { rarity: Rarity; x: number; w: number; chance: number; }
export function oddsBarSegments(
  odds: { rarity: Rarity; chance: number }[], bar: Rect,
): OddsSegment[];
```

Rules:
- `wingCraftGate`: `canCraft = needItems===0 && hasJewel && hasFeather`.
  `needItems = max(0, MIN_ITEMS - itemCount)`. `hasJewel = jewels>=1 && jewelsOwned>=jewels`.
  `hasFeather = feather && feathersOwned>=1`. Jewels are conceptually clamped to
  `[1, min(MAX_JEWELS, jewelsOwned)]` by the caller, but the gate validates owned-coverage.
- `oddsBarSegments`: widths proportional to `chance` (which sum to 1 from
  `wingOutcomeOdds`), laid left→right from `bar.x`, last segment absorbs rounding so
  the segments exactly tile `bar.w`. Colors come from `RARITY_INT` in the presenter
  (the pure fn returns rarity + geometry only).
- `loadedSlotLayout`: grid that stays inside `machine` with padding; rows wrap;
  centered horizontally.

### 2. `src/scenes/wingCraftDialog.ts` — Phaser presenter (rewrite)

Keeps the **same exported `openWingCraftDialog(scene, opts)` signature and
`WingCraftOpts`/`WingCraftItem`/`WingCraftPreview` types** so `ForgeScene` is
unchanged. Internally rebuilt around the machine:

- **Layout** from `wingMachineLayout(W,H)`. Dim backdrop + tap-out to close
  (existing pattern), violet `0x9a59d6` accent.
- **Machine drop zone**: a Phaser `Zone` set `{ dropZone: true }`. On
  `dragenter`/`dragleave` it brightens/dims its border (drag affordance).
- **Tray**: draggable tiles for each unequipped item (reuses `itemTex`, rarity
  ring). Plus two material stacks rendered as draggable tiles: **Jewel of Chaos**
  (shows owned count) and **Feather** (shows owned count). If the tray overflows,
  the existing wheel/drag-scroll handling applies (cap kept generous; overflow
  count label retained).
- **Drag**: `scene.input.setDraggable(tile)`. A ghost image follows the pointer
  between `dragstart`/`drag`; on `drop` into the machine zone the source is
  *loaded* (added to `selected` / `jewels++` / `feather=true`), the tile dims in
  the tray, and the readout re-renders. Tiles already maxed (jewels at cap, feather
  present, item already loaded) reject the drop (ghost snaps back).
- **Unload**: loaded item icons inside the machine are tap-targets (and
  draggable back to the tray); the jewel socket has a small `−` to drop one jewel;
  the feather socket taps to clear. Keeps the interaction reversible without
  reopening.
- **Tap-to-load fallback**: tapping a tray tile also loads it (drag can be fussy
  on touch). Drag is the headline interaction; tap is the safety net.
- **Readout** (`render()`): items `N/5` (red until 5), jewels `J/4`, feather ✓/✗,
  big **`Success XX%`**, and the **odds bar** — a row of `oddsBarSegments`
  rectangles colored by `RARITY_INT[rarity]` with `% Rarity` labels above. Uses the
  injected `opts.preview(selectedIds, jewels)` for the numbers (unchanged math).
- **Craft button**: from `wingCraftGate`; dim+locked with a reason hint
  (`Load N more item(s)` / `Add a Jewel` / `Add a Feather`) until `canCraft`, then
  bright/`hot`. On click → `opts.confirm([...selected], jewels)` (caller crafts,
  toasts, closes — unchanged).

If the presenter approaches the 500-line cap, extract the drag plumbing into
`src/scenes/wingCraftDrag.ts` (a `makeDraggable(scene, tile, {onLoad, ghostTex})`
helper). Planned as a contingency, not upfront.

## Data Flow

```
ForgeScene.openWingCraft()                       (unchanged)
  └─ openWingCraftDialog(scene, opts)            (rewritten presenter)
       ├─ wingMachineLayout(W,H)                 (pure geometry)
       ├─ drag/drop → selected:Set, jewels:int, feather:bool   (local UI state)
       ├─ render():
       │    ├─ wingCraftGate(...)                (pure → button enable + hints)
       │    ├─ opts.preview(selected, jewels)    (unchanged: wingSuccessChance + wingOutcomeOdds)
       │    └─ oddsBarSegments(odds, oddsBar)     (pure → colored bar geometry)
       └─ craft → opts.confirm(selected, jewels) → mgr.craftWings(...)  (unchanged engine)
```

No new save fields, no engine change, no `ForgeScene` change.

## Error Handling / Edge Cases

- **0 jewels owned**: jewel stack tile shows greyed `0`; can't be dragged; gate
  reports `hasJewel=false`; button locked with "Add a Jewel".
- **Jewel cap**: loading is clamped to `min(MAX_JEWELS=4, jewelsOwned)`; extra
  drops bounce.
- **Feather absent**: feather tile greyed; gate `hasFeather=false`.
- **Fewer than 5 unequipped items**: button stays locked; readout shows the
  shortfall; this is expected, not an error.
- **Empty selection preview**: `oddsBarSegments([...], bar)` with the
  `["Common"]` fallback (as ForgeScene already does) renders a single segment;
  success shows `0%` until 5 items are loaded.
- **Equipped items** are already filtered out by `ForgeScene` before the dialog
  sees them, so the dialog never offers an equipped item.

## Testing (TDD)

`tests/wingCraftMachine.test.ts` (pure module — RED first):

1. `wingCraftGate`: <5 items → `canCraft=false, needItems>0`; exactly 5 +
   jewel + feather → `canCraft=true, needItems=0`; 5 items, 0 jewels →
   `hasJewel=false`; jewels exceed owned → `hasJewel=false`; no feather →
   `hasFeather=false`.
2. `wingMachineLayout`: machine rect sits inside panel; tray is below the
   machine and inside the panel; craftBtn inside panel; oddsBar inside readout.
3. `loadedSlotLayout`: returns exactly `count` points, all inside `machine`
   (respecting padding); horizontally centered for a single row.
4. `oddsBarSegments`: segments tile `bar.w` exactly (Σw === bar.w, first starts
   at `bar.x`, no gaps/overlap); widths proportional to chance; preserves rarity
   order from input.

Presenter is verified by `tsc --noEmit` + full build + a CDP self-playtest
(open Forge → Craft Wings, drag items + jewel + feather in, confirm button
unlocks, read odds bar). No DOM test harness for Phaser exists in-repo.

## Files

- **New:** `src/core/wingCraftMachine.ts` (pure), `tests/wingCraftMachine.test.ts`.
- **Rewritten:** `src/scenes/wingCraftDialog.ts` (same public signature).
- **Contingency:** `src/scenes/wingCraftDrag.ts` only if the presenter nears 500 lines.
- **Unchanged:** `src/core/wingCraft.ts`, `src/scenes/ForgeScene.ts`,
  `src/core/saveManagerCore.ts`, materials/data.
