# Squad No-Drag Editing — Design Spec

**Date:** 2026-06-14
**Scene:** `SquadScene`
**Status:** Approved (full-auto)

## Problem

Building the battle squad currently requires **drag-and-drop**: drag a grid
character onto one of the 7 ordered slots to add/swap, drag a slotted character
off the slots to remove. Tapping a character only *inspects* it (right info
panel). Drag-and-drop is fiddly and imprecise — especially on the mobile
viewport this game targets, where the slots are small (94×48) and a slightly-off
release does nothing.

## Goal

**Keep the current drag flow exactly as-is, and add tap-only paths** so a player
can build a full squad without ever dragging.

## Non-Goals

- Removing or changing the existing drag-and-drop behaviour.
- Redesigning the slot/grid layout or the info panel structure.
- Auto-balancing by role/synergy — auto-fill picks by a simple power score only.

## Design Overview

Three additive, tap-only paths, all routed through ONE new pure module so the
drag controller and the new taps share a single source of truth for squad
mutation.

### A. Info-panel action button (primary no-drag path)

When a **character** (not the hero) is selected, the right info panel shows a
full-width action button below its details:

| Squad state of selected char | Button label                | Action on tap                      |
|------------------------------|-----------------------------|------------------------------------|
| In squad                     | `✓ In Squad — tap to Remove`| remove it from its slot            |
| Not in squad, slot free      | `+ Add to Squad`            | add to the first empty slot        |
| Not in squad, squad full     | `Squad Full (7/7)` (dimmed) | no-op; hint: drag onto a slot to swap |

This is the main path: tap a character (already shows its info) → tap **Add**.
The button reflects live state and re-renders on every `redraw()`.

### B. Tap an empty slot to place the selected character (ordered placement)

If a character is currently selected and **not** already in the squad, tapping
an **empty** slot assigns that character to that exact slot. This gives players
control over slot ordering without dragging. Empty slots become interactive
zones that call into the same placement mutation the drag path uses.

If no character is selected (or the hero is selected), tapping an empty slot does
nothing (unchanged).

### C. Auto-fill and Clear (bulk convenience)

A small control row near the slots:

- **`⚡ Auto`** — fills every *empty* slot with the player's best not-yet-squadded
  characters, ranked by a deterministic power score (rarity weight, then stars,
  then name for stable ties). Already-slotted members are never disturbed and
  never duplicated. If the grid is empty / squad already full, it is a safe
  no-op (with a transient toast).
- **`Clear`** — empties all slots (after it runs, `0/7 chosen`). Safe no-op when
  already empty.

Both show a transient toast via the existing `flashMsg` (e.g. `Filled 4 slots`,
`Squad cleared`).

## Architecture

### New pure module: `src/scenes/squadEdit.ts` (Phaser-free, unit-tested)

The single source of truth for squad-array mutation. All functions are pure:
they take the current `slots: (string|null)[]` and return a **new** array plus a
small result describing what changed (for toasts). No Phaser, no persistence.

```ts
const SQUAD_MAX = 7;

export interface SquadEditResult {
  slots: (string | null)[];
  changed: boolean;
  filled?: number;   // for autoFill
  reason?: "added" | "removed" | "placed" | "full" | "noop" | "cleared";
}

/** Add id to the first empty slot (no-op if present or full). */
export function squadAdd(slots, id): SquadEditResult;

/** Remove id from wherever it sits (no-op if absent). */
export function squadRemove(slots, id): SquadEditResult;

/** Place id at a specific slot; moves it if already slotted (no duplicates). */
export function squadPlaceAt(slots, id, slot): SquadEditResult;

/** Fill empty slots from `candidates` (already power-sorted desc), skipping
 *  any already present; never disturbs filled slots. */
export function autoFillSquad(slots, candidates: string[]): SquadEditResult;

/** Empty every slot. */
export function clearSquad(slots): SquadEditResult;

/** Deterministic power score for ranking auto-fill candidates. */
export function charSquadScore(rarity: Rarity, stars: number): number;
```

`charSquadScore` = `RARITY_ORDER[rarity] * 1000 + stars`. Auto-fill candidates
are the owned, not-currently-squadded characters sorted by score desc, then name
asc (stable). The score lives here (not in the scene) so it is unit-tested.

### `SquadScene` changes (thin presenter)

- **Reuse the module everywhere.** Refactor the existing `assignToSlot` and the
  drag controller's inline `removeFromSquad` to delegate to `squadPlaceAt` /
  `squadRemove`, so drag and tap can never diverge. The drag path keeps its
  current "data-mutation-in-drop, redraw-in-dragend" discipline (see
  `squadDrag.ts` / the Phaser drop-destroy trap) — the module only replaces the
  array arithmetic, not the lifecycle.
- **Action button (A):** add an `onAction` callback param to `drawPanel` →
  `renderCharInfo` (or render the button in `drawPanel` directly to avoid
  bloating `squadInfoPanel.ts`). It calls `squadAdd` / `squadRemove`, persists,
  and `redraw()`s. Rendered in the scene keeps the info-panel module Phaser-light.
- **Empty-slot tap (B):** in `drawSlots`, for empty slots add an interactive
  zone whose `pointerup` (guarded by `!this.didDrag`) calls a new
  `placeSelectedAt(slot)` that uses `squadPlaceAt` when a non-squadded character
  is selected.
- **Auto/Clear row (C):** two `crispText` buttons (near the `n/7 chosen`
  label), guarded by `!this.didDrag`, calling `autoFillSquad` / `clearSquad`
  then `persist()` + `flashMsg()` + `redraw()`.
- All squad writes funnel through one private `commit(result)` helper:
  `this.slots = result.slots; this.persist();` then the caller redraws/toasts.

### Persistence

Unchanged: `persist()` → `mgr.setSquad(slots.filter(Boolean))`. The slot array is
the working copy; persistence drops nulls as today.

## Data Flow

```
tap char tile ─► select(id) ─► redraw ─► drawPanel renders Add/Remove button
       │
       └─ tap Add ─► squadAdd ─► commit ─► redraw (button now "Remove")

tap empty slot (char selected) ─► squadPlaceAt ─► commit ─► redraw

tap ⚡Auto ─► autoFillSquad(sorted owned) ─► commit ─► flashMsg ─► redraw
tap Clear ─► clearSquad ─► commit ─► flashMsg ─► redraw

drag tile → slot (UNCHANGED) ─► squadPlaceAt (in drop) ─► dragend redraw
drag slotted off (UNCHANGED) ─► squadRemove (in dragend) ─► redraw
```

## Testing

`src/scenes/squadEdit.test.ts` (vitest, pure):

- `squadAdd`: adds to first empty slot; no-op when already present; no-op +
  `reason:"full"` when all 7 filled; preserves order of existing members.
- `squadRemove`: removes wherever it sits; no-op when absent.
- `squadPlaceAt`: places into empty slot; moving an already-slotted char clears
  its old slot (no duplicate); placing onto a filled slot overwrites (swap
  semantics matching today's drag).
- `autoFillSquad`: fills only empty slots in order; never duplicates a present
  char; never disturbs filled slots; respects candidate order; safe when no
  candidates / already full; returns correct `filled` count.
- `clearSquad`: empties all; no-op when already empty.
- `charSquadScore`: higher rarity outranks lower; within a rarity more stars
  win; ordering is total/stable.

Plus a CDP playtest script `scripts/playtest/repro_squad_noDrag.mjs` proving the
end-to-end tap paths on a real build: tap a grid char → tap **Add** → slot fills;
tap **Auto** → remaining slots fill; tap **Clear** → `0/7`. Reuses the harness
from `repro_squad_drag.mjs`.

## Risks / Mitigations

- **Divergence between drag and tap mutations** → eliminated by funnelling both
  through `squadEdit.ts`.
- **File size** (`SquadScene.ts` is ~477 lines, limit 500) → the new logic lives
  in `squadEdit.ts`; the scene only gains thin button/zone wiring. If it crosses
  500, extract the Auto/Clear/action-button wiring into a small
  `squadControls.ts` presenter.
- **Drop-destroy trap regression** → the drag lifecycle is untouched; the module
  swap is array-only. Covered by the existing `repro_squad_drag.mjs`.

## Out of Scope / Future

- Role-aware or synergy-aware auto-fill ("best comp", not just best power).
- Saved squad presets / multiple loadouts.
