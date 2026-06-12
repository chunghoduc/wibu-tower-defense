# Auto-Recycle by Rarity — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session — author holds owner's standing approval)

## Problem

The Recycle (Shop → Recycle) view smelts gear into Jewels of Chaos one item at a
time: tap a card → confirm in the per-item dialog. Clearing out a backlog of
junk drops (Common/Magic, plus surplus Rares) is tedious — dozens of taps. The
owner wants a one-shot "auto recycle": pick the rarities to clear, smelt every
matching item at once.

## Goal

Add an **Auto Recycle** entry point to the Recycle view that lets the player
select one or more rarities (capped at **Rare** — "rare or lower") and smelt all
non-equipped inventory items of the selected rarities in a single confirmed
action, minting the summed Jewels of Chaos.

## Non-Goals

- No new rarity tiers in scope; Legendary/Unique are intentionally **excluded**
  (they are too valuable to bulk-destroy, and Rare-tier reforge fuel is the
  highest a careless tap should ever touch).
- No "undo". Smelting is already irreversible; the bulk action keeps that
  contract behind one explicit confirm.
- No change to single-item Smelt/Reforge flow.

## Decisions (locked)

1. **Selectable rarities:** `Common`, `Magic`, `Rare` only. Enforced in the pure
   layer (a guard list), not just the UI — passing `Legendary`/`Unique` to the
   bulk function is a no-op for those tiers.
2. **Default selection:** `Common` + `Magic` ON, `Rare` OFF. Rare is reforge
   fuel / the better drops; the safe default never clears it unless the player
   opts in.
3. **Inventory scope:** operates on the **entire** inventory by rarity, ignoring
   the Recycle view's category sub-filter (Weapon/Armor/Accessory). The dialog
   is rarity-scoped, so applying the category filter too would be a hidden
   surprise. Equipped items are **never** smelted (same rule as single smelt).
4. **One confirm:** the dialog itself is the confirmation. A live preview shows
   the exact item count and total chaos for the current selection; "Smelt All"
   executes immediately and is disabled when the count is 0.

## Architecture

### Pure logic — `src/core/smelt.ts` (extend; stays well under 500 lines)

```ts
/** Rarities the bulk/auto smelt is allowed to touch ("rare or lower"). */
export const AUTO_SMELT_RARITIES: Rarity[] = ["Common", "Magic", "Rare"];

export interface BulkSmeltPreview {
  count: number;
  chaos: number;
}

/** Non-mutating: how many items + how much chaos a bulk smelt of `rarities`
 *  would yield, excluding equipped items and any rarity not in AUTO_SMELT_RARITIES. */
export function bulkSmeltPreview(save: HeroSave, rarities: Rarity[]): BulkSmeltPreview;

export interface BulkSmeltResult {
  count: number;
  chaos: number;
}

/** Smelt every non-equipped inventory item whose rarity is in `rarities`
 *  (intersected with AUTO_SMELT_RARITIES). Mutates `save`; mints chaos. */
export function bulkSmelt(save: HeroSave, rarities: Rarity[]): BulkSmeltResult;
```

- Both share one selector: filter `save.inventory.items` to non-equipped
  instances whose def rarity is in `requested ∩ AUTO_SMELT_RARITIES`.
- Chaos per item reuses `smeltYield(rarity)`.
- `bulkSmelt` removes the matched instances and adds the summed chaos to
  `save.materials[CHAOS_JEWEL]` — same mutation shape as `smeltItem`, just
  batched (single wallet write).
- An item with an unknown/missing def is treated as Common (chaos 1), matching
  `smeltItem`'s existing fallback, but only if its def _is_ resolvable to an
  allowed rarity; unresolvable defs are skipped (can't classify rarity safely).

### SaveManager — `src/core/saveManagerCore.ts` (extend)

```ts
/** Bulk-smelt all non-equipped items of the given rarities into chaos. */
bulkSmeltItems(rarities: Rarity[]): BulkSmeltResult {
  const r = bulkSmelt(this.save, rarities);
  if (r.count > 0) { this.persist(); this.emit(...); }  // mirror smeltItem's persistence/events
  return r;
}
```

Follows the exact persistence + event pattern of the existing `smeltItem`
wrapper (lines ~335–342).

### UI — new `src/scenes/autoRecycleDialog.ts`

A small presenter module (Phaser-aware but self-contained) exporting one
function:

```ts
export function openAutoRecycleDialog(
  scene,
  opts: {
    preview(rarities: Rarity[]): BulkSmeltPreview;
    confirm(rarities: Rarity[]): void; // performs the smelt, then redraw/flash
    onClose(): void;
  },
): Phaser.GameObjects.Container;
```

Contents:

- Dimmed backdrop + panel (same visual language as `openRecycle`).
- Three rarity toggle chips (`Common`, `Magic`, `Rare`), colored by
  `RARITY_INT`, default Common+Magic selected. Tapping toggles and re-renders
  the preview line.
- Live preview line: `"Smelt N items → ❖ C Chaos"` (updates on every toggle).
- **Smelt All** button — disabled (greyed, inert) when N = 0; on tap calls
  `confirm(selected)` and closes.
- **Cancel** button — calls `onClose`.

Extracting to its own file keeps `ShopScene.ts` focused and under the 500-line
cap; the dialog owns its toggle state internally.

### ShopScene — `src/scenes/ShopScene.ts` (wire only)

- Add an **♻ Auto** button, visible only in `recycle` mode, placed top-right
  where the Buy view's Refresh button sits (they're mutually exclusive by mode).
- On tap: `openAutoRecycleDialog(this, { preview: (rs) => bulkSmeltPreview(save, rs), confirm, onClose })`.
  `confirm` calls `this.mgr.bulkSmeltItems(rs)`, flashes
  `"Recycled N items → ❖ C Chaos"`, and `this.redraw()`.
- Track the dialog in the existing `confirmDialog` slot so `create()`'s reset
  and `closeConfirm()` tear it down on scene re-entry (see
  [[project_scene_reentry_reset]]).

## Data Flow

```
[♻ Auto tap] → openAutoRecycleDialog
   toggle chip → preview(selected) → "Smelt N → ❖ C"   (pure, no mutation)
   Smelt All   → confirm(selected) → mgr.bulkSmeltItems → bulkSmelt(save) mutates
              → persist + emit → flash + redraw (grid + chaos counter refresh)
```

## Error / Edge Handling

- **Nothing selected / nothing matches:** preview shows `0`, Smelt All disabled.
  No mutation, no persist.
- **All matches equipped:** excluded by the selector → count 0.
- **Legendary/Unique requested:** intersected out by `AUTO_SMELT_RARITIES`.
- **Scene re-entry mid-dialog:** dialog lives in `confirmDialog`, destroyed in
  `create()`.
- **Idempotent persistence:** `bulkSmeltItems` only persists/emits when
  `count > 0`, avoiding a redundant save on an empty confirm.

## Testing (TDD)

Extend `tests/smelt.test.ts`:

1. `AUTO_SMELT_RARITIES` is exactly `[Common, Magic, Rare]`.
2. `bulkSmeltPreview` counts only non-equipped items of the selected rarities and
   sums `smeltYield`; does **not** mutate the save.
3. `bulkSmelt` removes exactly those items, adds summed chaos, leaves others
   (incl. equipped, incl. Legendary/Unique) intact; returns matching
   `{count, chaos}`.
4. Requesting `Legendary`/`Unique` smelts nothing (guard holds even if the UI is
   bypassed).
5. Empty selection → `{count: 0, chaos: 0}`, no inventory change.
6. Preview and bulk agree (same count/chaos) for the same selection.

Pure module → fast Vitest unit tests, no Phaser. UI wiring verified via the
standard tsc + build + CDP playtest pass.

## Files Touched

- `src/core/smelt.ts` — add `AUTO_SMELT_RARITIES`, `bulkSmeltPreview`, `bulkSmelt`.
- `src/core/saveManagerCore.ts` — add `bulkSmeltItems` wrapper.
- `src/scenes/autoRecycleDialog.ts` — **new** dialog presenter.
- `src/scenes/ShopScene.ts` — add ♻ Auto button + wiring.
- `tests/smelt.test.ts` — add bulk-smelt cases.
