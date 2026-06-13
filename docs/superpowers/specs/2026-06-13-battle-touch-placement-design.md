# Battle touch-gesture pass — tap-to-place + double-tap zoom

**Date:** 2026-06-13
**Status:** Approved (autonomous session)
**Predecessor:** `2026-06-13-web-gesture-feel-design.md` (shared slop + list momentum + cancel-safety). This pass extends that work into the **battlefield** interactions specifically.

## Problem

Player feedback: *"I can't move screen or place tower."* Real-pointer CDP playtest (`scripts/playtest/repro_input.mjs`, driving synthetic `PointerEvent`s through the live canvas) pinned the root cause — **nothing is broken; the gesture model is undiscoverable on web/touch:**

| Test (real pointer events) | Result | Meaning |
|---|---|---|
| Drag a build-bar avatar onto the field | towers 0→1, gold 170→125 | Drag-and-drop placement **works** |
| **Tap** a build-bar avatar | towers stays 1 | Tapping does **nothing** — placement is drag-only |
| Drag the map at fit-zoom (0.75 = minZoom) | scroll Δ = **0** | Pan is gated off at base zoom |
| Drag the map after zooming in (1.27) | scroll Δ = **114** | Pan **works** once zoomed in |

So:
1. **"Can't place tower"** — placement is *drag-and-drop only* (`battleSceneInput.ts setupPlacementDrag`, `dragstart→drag→dragend`). On touch this is fiddly: the finger occludes the ghost and the drop must land exactly on a valid tile. Tapping an avatar — the most natural touch action — does nothing.
2. **"Can't move screen"** — at the fit-to-screen base zoom the whole 1280×720 world is already visible, so pan is correctly disabled (`battleCamera.ts:120`, `!this.isZoomedIn` early-return). But the zoom→pan path is undiscoverable: a first-time player drags the field, the hero walks instead, and it reads as "the screen won't move."

This is the same class of issue as the predecessor spec ("web gesture is bad") — ergonomics, not logic.

## Goals

- Let players **tap a tower avatar, then tap the field** to place it (the dominant mobile-TD idiom), keeping drag-to-place intact.
- Give players a **discoverable way to zoom in** (double-tap), which immediately makes drag-to-pan meaningful and answers "can't move screen."
- Keep the logic in **pure, unit-tested modules**; presenters stay thin.

## Non-goals (YAGNI)

- Pinch-to-zoom rework, pan momentum/inertia, or lowering the min zoom / changing battle framing.
- Changing hero-walk-on-tap semantics, or the existing drag-to-place path.
- Any change to non-battle scenes.

## Design

### 1. Tap-to-place towers

**New pure module `src/core/placementMode.ts`** — a tiny state machine for "which avatar is armed for tap-placement," with zero Phaser/DOM:

```ts
export interface PlacementState { armedId: string | null; }
export function emptyPlacement(): PlacementState;            // { armedId: null }
export function armPlacement(s, id): PlacementState;          // arm id (toggle off if same id already armed)
export function disarmPlacement(s): PlacementState;           // { armedId: null }
export function isArmed(s): boolean;

/** Decide what a field tap does while armed, given board validity + affordability. */
export type PlaceDecision = "place" | "blocked" | "idle";
export function resolveFieldTap(s, opts: { canPlace: boolean; affordable: boolean }): PlaceDecision;
//   not armed            -> "idle"   (fall through to normal hero/tower tap)
//   armed & canPlace & affordable -> "place"
//   armed & otherwise    -> "blocked" (keep armed; give feedback, don't walk the hero)
```

**Wiring (`BattleScene` + `battleSceneInput.ts`):**

- Each build-bar avatar (`BattleScene.buildBuildBar`) gains a `pointerup` (tap) handler. A genuine tap (no drag) on an avatar calls `armPlacement(id)`:
  - arms that tower, shows a persistent ghost + range/validity ring that **follows the pointer on `pointermove`** (reuse `makeGhost`/`updateGhost`), and highlights the armed tile.
  - tapping the **same** armed avatar again, or any other avatar, toggles/swaps via the state machine.
- The scene `pointerup` field handler (`bindInput`) consults `resolveFieldTap` **before** the existing tower-select / `commandHero` logic:
  - `"place"` → `battle.placeTowerAt(armedId, world)`, `sfx.place()`, then `disarmPlacement` + clear ghost.
  - `"blocked"` → swallow the tap (no hero walk), keep armed, brief "can't place here" feedback (reuse the red ring already drawn by `updateGhost`).
  - `"idle"` → unchanged behaviour (select tower / walk hero).
- **Cancellations:** arming is cleared on successful place, on tapping an interactive HUD widget, on opening the tower panel, on `dragstart` (drag-to-place takes over), and on battle end. The existing `dragend` placement path is untouched.
- Affordability/validity come from the same sources the drag ghost already uses: `battle.canPlaceAt`, `battle.gold >= def.cost`, `pointer.y < 500`.

This adds a second placement path without disturbing the first; both end at `battle.placeTowerAt`.

### 2. Double-tap to zoom

**Extend `src/core/gesture.ts`** with one pure helper:

```ts
export const DOUBLE_TAP_GAP_MS = 280;   // max gap between the two taps
export const DOUBLE_TAP_DIST_PX = 24;   // max separation between tap points
export function isDoubleTap(prev: {t:number; x:number; y:number} | null,
                            cur:  {t:number; x:number; y:number}): boolean;
```

**Wiring (`battleCamera.ts`):** the controller records the last committed tap (time + position, from `scene.time.now` and pointer). On a new tap that satisfies `isDoubleTap`, it calls `zoomToward(stepFactor, x, y)` (the same path the `＋` button uses) and sets `consumedGesture = true` so the scene's hero-command tap is suppressed. A double-tap while already zoomed-in continues to zoom further toward the point (capped by `maxZoom`). This gives an obvious "get closer and look around" affordance; drag-to-pan then works (already verified).

Double-tap detection lives next to the camera (it owns zoom); only the pure predicate is shared.

## Components & boundaries

| Unit | Purpose | Depends on | Tested |
|---|---|---|---|
| `core/placementMode.ts` | arm/disarm + field-tap decision (pure) | — | unit |
| `core/gesture.ts` (`isDoubleTap`) | pure double-tap predicate | — | unit |
| `BattleScene.buildBuildBar` | avatar tap → arm | placementMode | via repro |
| `battleSceneInput.ts bindInput` | field tap → place/blocked/idle | placementMode | via repro |
| `battleCamera.ts` | double-tap → zoomToward | gesture | via repro |

## Testing

- **Unit (Vitest, TDD):** `placementMode.ts` — empty/arm/toggle-same/swap/disarm; `resolveFieldTap` truth table (idle when unarmed; place when armed+canPlace+affordable; blocked otherwise). `isDoubleTap` — within gap+dist = true; too slow = false; too far = false; null prev = false.
- **Integration (real pointer):** extend `scripts/playtest/repro_input.mjs` — (a) tap avatar then tap field ⇒ towers +1, gold −cost; (b) tap avatar then tap UI ⇒ disarmed, towers unchanged; (c) double-tap field ⇒ camera zoom increases and `isZoomedIn` true; (d) regression: drag-place still works.
- **Gates:** `npm run typecheck`, `npm run lint` (0 errors; new files < 500 lines), full `npx vitest run` green (modulo the pre-existing unrelated `firebaseCachePolicy.test.ts`), `npm run build`.

## Risks

- **Tap vs drag ambiguity on avatars:** a press that becomes a drag must NOT also arm. Mitigation: arm only on the avatar's `pointerup` when no drag occurred (Phaser suppresses `pointerup`-as-click after a drag; additionally guard with `TAP_SLOP_PX`), and clear any arm on `dragstart`.
- **Armed-state leaks across battle end / scene re-entry:** reset placement state in the same teardown that already clears `placeGhost`; per the scene-reentry memory, initialise the field in `create()`.
