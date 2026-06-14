# Wing Craft UI Redesign — Design Spec

Date: 2026-06-14
Status: Approved (full-auto, self-approved)

## Problem

The Craft Wings dialog (`src/scenes/wingCraftDialog.ts`) is "super buggy". A code
audit found concrete defects, and three requested features are missing: an **Auto**
fill button, a **rarity filter**, and a **scrollable inventory**.

### Bugs found (audit)

1. **Tray has no scroll → overflow spill.** The tray rect is a fixed height
   (`craftBtn.y - trayY - 10` ≈ 128px ⇒ ~2 visible rows). Tiles are placed by an
   ever-incrementing `slot` index with no windowing or clip, so a player with more
   than ~22 unequipped items renders tiles *below the panel*, on top of the Forge /
   Close buttons and off the bottom of the screen — unreachable and visually broken.
   This is the primary "super buggy" symptom.

2. **Double-load on drag (jewel/feather).** Each tray tile image has BOTH a drag
   handler (`makeDraggable` → `dragend` → `onDrop` → `tryLoad`) AND an unconditional
   `pointerup` → `tryLoad` (the "tap fallback"). After a real drag, Phaser still
   fires `pointerup` on the object, so a single drag of the jewel tile increments
   `jewels` twice and a single drag of the feather double-fires. (Items happen to be
   masked because `selected.has(id)` blocks the second add, but materials are not.)

3. **Missing-texture items are invisible AND unselectable.** In `placeTile`, the
   draggable image and both interaction handlers are only created when
   `scene.textures.exists(texKey)`. If a def's icon is missing, the tile is a bare
   ring with no interactive target — the item can never be loaded into the machine.

4. **Drag vs scroll conflict (latent).** Any scroll added on top of the current
   drag-to-machine plumbing would fight the pointer (drag a tile out vs. drag the
   list). The drag interaction blocks the cleanest fix.

5. **Tap-out guard complexity.** A whole `dragging` flag + `dragstart`/`dragend`/
   `pointerdown` scene listeners exist *only* to stop a drag-release from being read
   as "tapped outside → close". Removing drag removes this entire class of bug.

## Decision: tap-to-load + windowed scroll (drop drag-to-machine)

Replace drag-to-machine with **tap-to-load**, and make the tray a **row-windowed
scrollable list** using the existing `scrollDrag.ts` / `gesture.ts` momentum scroll
(the same pattern as ShopScene/inventory). This single move:

- kills bugs #2, #4, #5 outright (no drag = no double-fire, no drag/scroll fight, no
  tap-out guard),
- fixes #1 (windowing renders only visible rows — nothing can spill),
- and matches the project's established direction away from drag (see
  `project_squad_no_drag_editing`, `project_tap_to_place_mobile`).

Tap a tray tile → load into the machine. Tap a loaded icon in the machine → unload
(already supported). Materials (Jewel of Chaos, Feather) are tiles in the same tray
and load by tap too.

### New features

- **Rarity filter chips.** A chip row above the tray: `All` + one chip per rarity
  actually present in the unequipped inventory, in ladder order
  (Common→Magic→Rare→Legendary→Unique). Selecting a chip filters the item list and
  resets the scroll offset. Materials always show regardless of filter (they sit in
  their own fixed mini-row above the filtered item grid, so the filter only touches
  gear).
- **Auto button.** Fills the *cheapest valid craft*: the lowest-rarity
  `MIN_ITEMS` (5) unequipped items not already loaded, plus 1 Jewel of Chaos (if
  owned) and the Feather (if owned). Cheapest = burn junk, keep good gear. Idempotent
  given current state.
- **Clear button.** Empties the machine (items + jewels + feather) in one tap.
- **Scroll.** Row-windowed vertical scroll over the filtered item grid via
  `attachDragScroll`; a flick flings with momentum. `didScroll()` suppresses the
  tap-load when the gesture was a scroll, not a tap.

### Missing-texture fallback

Every tile renders a visible, tappable cell even when the icon texture is absent: a
rarity-colored rounded rect with the item's initial letter. The cell's interactivity
lives on a hit `Zone`/ring, not on the (possibly absent) image, so any item is always
selectable (fixes #3).

## Module layout (keep every file < 500 code lines)

### Pure — `src/core/wingTray.ts` (new, fully unit-tested)

```ts
type Filter = Rarity | "all";

// distinct rarities present, in ladder order (for the chip row)
wingRarityFilters(items: WingItemLike[]): Rarity[]

// items matching the active filter ("all" → unchanged), original order preserved
filterWingItems(items: WingItemLike[], filter: Filter): WingItemLike[]

// cheapest valid auto-fill given current state
autoWingSelection(
  items: WingItemLike[],
  opts: { need: number; jewelCap: number; feathersOwned: number; selected: Set<string> },
): { ids: string[]; jewels: number; feather: boolean }
//   ids   = lowest-rarity `need` items not already selected (stable tie-break by input order)
//   jewels= min(1, jewelCap)
//   feather = feathersOwned >= 1

// row-window math for the scrollable grid
trayWindow(count: number, cols: number, rowsVisible: number, offset: number):
  { startRow: number; visibleCount: number; maxOffset: number; rows: number }
```

`WingItemLike = { id: string; rarity: Rarity }` (a structural subset of
`WingCraftItem`, so the dialog's richer type is assignable). Rarity ordering reuses
`RARITY_INT` / the existing rarity ladder — no new ordering source.

### Pure — extend `src/core/wingCraftMachine.ts`

`wingMachineLayout` gains a **filter-chip row** and an **Auto/Clear control row**, and
exposes `rowsVisible` + the per-cell `CELL`/`cols` the tray needs, so all geometry
stays pure and tested. The tray rect shrinks to make room for the chip row.

### Presenter — `src/scenes/wingCraftTray.ts` (new)

Owns the chip row + the windowed, scrollable, tap-to-load tile grid + the
missing-texture fallback tile. Exposes `render()` and a `destroy()`; takes callbacks
`onLoad(kind,id)`, `isLoaded(...)`, `owned(...)` and reads `filter`/`offset` from a
small state object. Wires `attachDragScroll`. This extraction keeps
`wingCraftDialog.ts` under 500 lines after the rewrite.

### Presenter — rewrite `src/scenes/wingCraftDialog.ts`

- Remove drag plumbing usage and the `dragging` tap-out guard.
- Render machine + sockets + readout (mostly unchanged) and delegate the tray to
  `wingCraftTray.ts`.
- Add Auto + Clear buttons wired to `autoWingSelection` / state reset.

### `src/scenes/wingCraftDrag.ts`

Keep `drawSocket` (still used). Remove `makeDraggable` and `machineZoneHit` (no longer
used). If only `drawSocket` remains, fold it into `wingCraftTray.ts`/dialog or keep
the file minimal — final placement decided in the plan.

## ForgeScene wiring

`ForgeScene.openWingCraft` is unchanged in contract: it still passes `items`,
`jewelsOwned`, `feathersOwned`, `preview`, `confirm`, `onClose`. No save-model or
pure-craft (`wingCraft.ts`) changes. This is a UI-only redesign.

## Testing

- `tests/wingTray.test.ts` — `wingRarityFilters` (distinct + ladder order, empty
  input), `filterWingItems` (all/each rarity, order preserved, no match), 
  `autoWingSelection` (picks lowest rarity, skips already-selected, respects `need`,
  jewel cap 1, feather gating, not enough items), `trayWindow` (maxOffset clamp,
  windowing at top/middle/bottom, fewer-than-one-page).
- Extend `tests/wingCraftMachine.test.ts` — chip row + control row rects nest inside
  the panel, tray shrinks, `rowsVisible ≥ 1`.
- Pure modules only; presenters stay untested (Phaser), consistent with the codebase.

## Out of scope / YAGNI

- No sorting controls (filter chips suffice).
- No slot/type filter (rarity is the meaningful axis for a gear sink).
- No multi-jewel auto (1 jewel = cheapest valid; players add more by tapping).
- No change to craft odds, success math, or rewards.
```
