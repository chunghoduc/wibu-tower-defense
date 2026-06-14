# Ring multi-slot compare-and-replace — design

Date: 2026-06-14

## Problem

When a player taps a **ring** in the bag while **both** ring slots (`Ring1`,
`Ring2`) are already occupied, the compare-and-replace modal only ever shows
the ring sitting in `Ring1`. `HeroScene.openItemAction` hardcodes
`candidates[0]` as the displaced slot, so `Ring2` is unreachable from a bag tap —
the player cannot choose to replace the second ring without first manually
unequipping.

Reported intent (verbatim): *"the comparison for ring slots should show 2
comparison windows if 2 rings equipped, each windows have its own replace
button."*

This only affects equip categories that map to more than one concrete slot.
Today that is exactly `Ring` (`equipSlotsFor("Ring") → ["Ring1", "Ring2"]`).
Every other category maps to a single slot, so its behaviour must not change.

## Goal

When all concrete slots for the tapped bag item's category are full, the modal
compares the SELECTED item against **every** occupied candidate slot at once,
and gives **each** equipped item its own Replace button that swaps *that* slot.

- Both rings equipped → SELECTED column + two equipped columns, two Replace
  buttons (one per ring).
- One ring slot free → unchanged (enhance dialog with an Equip button fills the
  free slot).
- Single-slot items (Weapon, Helmet, …) → visually unchanged 2-column compare.

## Architecture

Three layers, matching the existing pure-logic + presenter split.

### 1. Pure decision module — `src/data/equipRoute.ts` (new, tested)

```ts
export type EquipRoute =
  | { kind: "equip"; slot: ItemSlot }        // a candidate slot is free
  | { kind: "compare"; slots: ItemSlot[] };  // all candidates full → compare these

export function equipRoute(
  defSlot: ItemDefSlot,
  equipped: Partial<Record<ItemSlot, string>>,
): EquipRoute;
```

- `slots` for `compare` preserves candidate order (`Ring1` before `Ring2`).
- A single-slot category full → `{ kind: "compare", slots: [theSlot] }`.
- This is the sole owner of the "which slots does a full drop compare against"
  rule. It replaces the inline `candidates.find(free)` / `candidates[0]` logic
  in `HeroScene.openItemAction`.

Phaser-free, unit-tested in `tests/equip-route.test.ts`.

### 2. Presenter — `src/scenes/itemCompareDialog.ts` (generalized)

`renderCompareDialog` changes its `equipped`/`slot`/`onReplace` parameters from
singular to a **list of targets**:

```ts
export interface CompareTarget {
  ref: ItemRef;          // the equipped item in this slot
  slot: ItemSlot;        // Ring1 / Ring2 / Weapon / …
  onReplace: () => void; // swap THIS slot for the bag item
}

export function renderCompareDialog(
  scene, dialog,
  bag: ItemRef,
  targets: CompareTarget[],   // 1 or 2 entries (extensible to N)
  heroLevel: number,
  cb: { onEnhance: () => void; onClose: () => void },
): void;
```

Layout (column-per-item, `SELECTED` first then one column per target):

- N = `targets.length`; total columns = `N + 1`.
- Each column width is fixed (~180px); dialog width = `PAD*2 + (N+1)*colW +
  N*COL_GAP`. With N = 2 that is ≈ 600px, well within the 960 stage. Centred.
- The **delta bracket moves to each equipped column** (`equippedValue (Δ)`,
  green up / red down, Δ = bag − equipped). The SELECTED column shows the bag's
  own values plainly. This makes per-target deltas unambiguous when there are
  two equipped items (each ring has its own delta). For the N = 1 case the look
  is equivalent information, just with the bracket on the equipped side.
- Rows are the **union of stat keys across the bag and all targets**, so every
  column lines up row-for-row. `compareItems(bag, target.ref)` is still the per
  pair source of truth; the dialog unions the row labels and looks up each
  pair's row by label.
- Footer: one **Enhance** button under the SELECTED column; one gated
  **Replace** button under each equipped column, each wired to its target's
  `onReplace` (its own level gate via the bag item's required level).

No change to `itemCompare.ts` (`compareItems` stays a pair function). The
dialog composes N pairwise comparisons.

### 3. Orchestration — `src/scenes/HeroScene.ts`

`openItemAction` calls `equipRoute(def.slot, save.inventory.equipped)`:

- `equip` → `openEnhance(inst.id, route.slot)` (unchanged path).
- `compare` → resolve each slot's equipped instance+def (skipping any whose
  instance equals the bag item or whose def is missing), build a
  `CompareTarget[]`, and call the generalized `openCompare`. Each target's
  `onReplace` calls `this.mgr.equipItem(bagInst.id, target.slot)`.

If, after filtering, zero valid targets remain, fall through to
`openEnhance(inst.id)` (today's final fallback) — defensive, e.g. a dangling
equipped id.

## Data flow

```
tap bag ring (both slots full)
  → equipRoute("Ring", equipped) = { compare, slots: [Ring1, Ring2] }
  → HeroScene resolves [{Ring1 item}, {Ring2 item}] → CompareTarget[]
  → renderCompareDialog(bag, [t1, t2], …)
      SELECTED | EQUIPPED·Ring (Ring1) | EQUIPPED·Ring (Ring2)
                 [Replace→Ring1]          [Replace→Ring2]
  → tap a Replace → mgr.equipItem(bag, thatSlot) → toast + refresh
```

## Testing

- `tests/equip-route.test.ts` (new, pure):
  - both ring slots free → `equip Ring1`.
  - one ring slot free → `equip` the free one (order: `Ring1` then `Ring2`).
  - both ring slots full → `compare [Ring1, Ring2]` (order preserved).
  - single-slot category full → `compare [thatSlot]`.
  - single-slot category free → `equip thatSlot`.
- `tests/item-compare.test.ts` — unchanged (pure pair logic untouched).
- Dialog rendering stays Phaser and is not unit-tested directly (matches house
  style); the generalization keeps the N = 1 path behaviourally identical.

## Out of scope / YAGNI

- No N > 2 category exists today; the list-based design supports it for free but
  we do not add new multi-slot categories.
- No drag-to-specific-ring-slot gesture; the modal's per-column Replace buttons
  are the slot chooser.
- No change to enhance flow, equip math, or save format.

## Risk

- Width growth: 3 columns ≈ 600px < 960 — safe; centred via existing `dx`.
- The single-target visual shifts the delta bracket from the SELECTED column to
  the EQUIPPED column. Acceptable and arguably clearer; no logic risk.
- File size: `itemCompareDialog.ts` is ~207 lines today; the generalization
  stays well under the 500-line ceiling.
