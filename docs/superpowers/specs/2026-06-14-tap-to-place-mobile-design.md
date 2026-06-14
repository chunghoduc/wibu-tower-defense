# Tap-to-place: mobile select feedback — design spec

Date: 2026-06-14
Status: approved (full-auto session)

## Problem

On the mobile web build, placing a tower by **dragging** a build-bar card onto the
map is fiddly: a touch-drag fights the camera pan/pinch gestures, and a slip past
`TAP_SLOP_PX` cancels the placement. We want the alternative "select, then tap the
map" flow to be a first-class, discoverable mobile gesture.

### What already exists (do NOT rebuild)

The tap-to-place *mechanic* is already implemented and wired:

- `core/placementMode.ts` — pure arm/disarm state machine (`armedId`, `armPlacement`
  toggles, `resolveFieldTap` → `"place" | "blocked" | "idle"`).
- `BattleScene.buildBuildBar()` — a build-bar card's `pointerup` distinguishes tap
  from drag via `TAP_SLOP_PX` and calls `this.toggleArm(def.id)`.
- `battleScenePlacement.toggleArm()` — arms the card and shows a ghost.
- `battleSceneInput.bindInput()` — a field `pointerup`, when a card is armed, runs
  `resolveFieldTap` and commits via `battle.placeTowerAt`, then `cancelPlacement()`.

So the gesture works. **The gap is feedback, not mechanism** — and three concrete
bugs make it feel broken on touch:

1. **No "selected" cue on the card.** After tapping a card to arm it, nothing on the
   card changes. The player has no idea a tower is selected or which one.
2. **Stale red ghost parked on the build bar (touch only).** `toggleArm` previews the
   ghost at `this.input.activePointer`. On a mouse that pointer is wherever the cursor
   hovers; on touch the active pointer is still **on the just-tapped card** (y ≈ 520,
   inside the bottom build-bar strip at y ≥ 500). `updateGhost` therefore draws a
   **red "blocked" ring sitting on top of the build bar** — it looks like a glitch,
   not a preview.
3. **No instruction or cancel affordance.** Nothing tells the player to "tap the map",
   and the only way to cancel is to re-tap the exact same card (undiscoverable).

## Goal

Make "select a card → tap the map to place" obviously work on touch, with clear
selected/armed feedback, a sensible on-field ghost preview, an instruction, and an
easy cancel — without touching the underlying placement math or the drag path.

## Non-goals (YAGNI)

- No change to `placeTowerAt`, `canPlaceAt`, costs, or which spots are valid.
- No removal of the drag-to-place path; both stay.
- No new art assets.
- No multi-select / queue. One armed tower at a time (matches `placementMode`).

## Design

### 1. Selected-card highlight (pure decision + per-frame presenter)

`refreshBuildBar()` already runs every frame from `draw()` and iterates `avatarTiles`
to dim unaffordable cards. We extend that same pass to also reflect the armed state,
so the highlight is always consistent with `placement.armedId` with zero extra wiring.

A new pure helper decides each tile's visual from three booleans:

```ts
// core/placementHud.ts
export interface TileVisual { alpha: number; scale: number; selected: boolean; }
export function armedTileVisual(o: {
  anyArmed: boolean;      // is ANY card currently armed?
  isArmedTile: boolean;   // is THIS the armed card?
  affordable: boolean;    // gold >= cost
}): TileVisual;
```

Rules:

| state | alpha | scale | selected (border) |
|-------|-------|-------|--------------------|
| this card armed | 1.0 | 1.12 | true (bright accent) |
| something else armed, affordable | 0.6 | 1.0 | false |
| something else armed, unaffordable | 0.45 | 1.0 | false |
| nothing armed, affordable | 1.0 | 1.0 | false |
| nothing armed, unaffordable | 0.45 | 1.0 | false |

The presenter applies `alpha`/`scale` to the tile container and toggles a per-tile
"selected" highlight Graphics (a bright accent rounded-rect outline behind the card
body, created lazily and stored on the tile via `setData`). Dimming the *other* cards
while one is armed focuses attention on the choice in flight.

### 2. On-field ghost preview (fix the stale red blob)

The ghost should preview *on the battlefield*, never on the build bar. A pure helper
picks the anchor world-point used when arming:

```ts
export const BUILD_BAR_TOP = 500; // screen y; matches the existing y>=500 strip guard
export function ghostAnchor(o: {
  pointerScreenY: number;        // active pointer's screen y
  pointerWorld: { x: number; y: number };
  camCenter: { x: number; y: number }; // camera worldView center
}): { x: number; y: number };
```

If the active pointer is within the build-bar strip (`pointerScreenY >= BUILD_BAR_TOP`,
the touch case) the ghost anchors at the **camera-view center** (visible on the field);
otherwise it follows the real pointer world-point (the desktop-hover case). `toggleArm`
uses this anchor for the initial preview. Desktop `pointermove` keeps tracking the
cursor exactly as today (unchanged).

### 3. Arm hint banner + tap-to-cancel

A single reused `Text` on the UI layer, centered just above the build bar. Pure text:

```ts
export function armHintText(name: string | null): string;
// null → "" ; name → `Tap the map to place ${name}  ·  tap card to cancel`
```

Shown when armed, hidden otherwise (driven from the same `refreshBuildBar` pass).
The banner is interactive: tapping it calls `cancelPlacement()` — a large, obvious
mobile cancel target in addition to re-tapping the card (which already toggles off).

## Components & data flow

```
build-bar card tap ─► toggleArm(id)               (existing)
                         │ placement = armPlacement(...)         core/placementMode
                         └─ makeGhost + park at ghostAnchor(...)  core/placementHud  ← new
draw() ─► refreshBuildBar()                         (existing, extended)
            ├─ armedTileVisual(...) per tile  ──────► alpha/scale/selected  core/placementHud ← new
            └─ armHintText(armedName) ───────────────► hint Text show/hide   core/placementHud ← new
field tap ─► resolveFieldTap ─► placeTowerAt ─► cancelPlacement   (existing)
hint tap  ─► cancelPlacement()                      (new affordance)
```

- **`core/placementHud.ts` (new, pure, Phaser-free):** `armedTileVisual`,
  `ghostAnchor`, `armHintText`, `BUILD_BAR_TOP`. Fully unit-tested.
- **`scenes/battleScenePlacement.ts` (extend, has room — 100 lines):** apply the tile
  visuals + hint each frame (`refreshArmedBar`), create/destroy the hint banner, use
  `ghostAnchor` in `toggleArm`. The drag handlers are untouched.
- **`scenes/BattleScene.ts` (minimal):** `refreshBuildBar()` delegates the armed pass
  to `this.refreshArmedBar()` so BattleScene gains ~1 line, not a block (the file is
  already at the 500-code-line ceiling).

## Error handling / edge cases

- Outcome not `ongoing`: `toggleArm` already no-ops; hint stays hidden, tiles render
  their plain affordability dim.
- Re-tapping the armed card disarms (existing `armPlacement` toggle) → highlight clears,
  ghost clears, hint hides — all via the next `refreshArmedBar` pass.
- Arming a second card switches selection (existing) → only the new card highlights.
- Placing commits then `cancelPlacement()` → highlight/hint clear next frame.
- Unaffordable armed card: still highlightable (you can select then earn gold); the
  field tap resolves `"blocked"` and keeps it armed (existing behaviour) — the ghost
  ring already reads red via `updateGhost` so no extra cue needed.

## Testing

Pure unit tests (`tests/placementHud.test.ts`) — the only logic with branches:

- `armedTileVisual` truth table: armed tile (1.0/1.12/selected), other-armed dim (0.6),
  unaffordable (0.45), nothing-armed affordable (1.0/1.0/not selected).
- `ghostAnchor`: pointer in build-bar strip → camera center; pointer on field →
  pointer world-point; boundary at `BUILD_BAR_TOP`.
- `armHintText`: null → `""`; a name → contains the name and the word "place".

Presenter (Phaser) is verified by a live CDP playtest: arm a card → card lifts +
accent border, others dim, hint appears, ghost shows on the field (green on a valid
spot); tap map → tower placed, highlight/hint clear; re-tap card and tap hint → cancel.

## File-size discipline

`placementHud.ts` is small and new. `battleScenePlacement.ts` (100 → ~150) stays well
under 500. `BattleScene.ts` gains ~1 line (delegation). No file crosses the limit.
