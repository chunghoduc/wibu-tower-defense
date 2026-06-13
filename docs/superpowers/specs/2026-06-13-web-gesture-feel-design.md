# Web Gesture Feel Pass — Design Spec

Date: 2026-06-13
Status: Approved (full-auto session)

## Problem

User report: "the game gesture for web is bad." The input layer has accumulated
inconsistencies and missing affordances that make pointer/touch interaction feel
stiff and unreliable on the web build (desktop browser + mobile browser). An audit
of the input surfaces surfaced three concrete, high-leverage problems:

1. **Inconsistent tap-vs-drag thresholds.** The slop distance that decides "is this
   a tap or a drag?" differs per surface:
   - `scrollDrag.ts:80` — 4px
   - `battleCamera.ts:28` (`PAN_THRESHOLD`) — 6px
   - `HeroScene` equip drag — 8px (`dragDistanceThreshold`)
   - battle tap (`battleSceneInput.ts`) — 8px
   The same physical flick is classified differently depending on which scene the
   player is in. This is the single biggest cause of "my click registered as a
   drag" / "my drag registered as a click."

2. **No momentum / inertia scrolling.** Every list (`Collection`, `Hero` inventory,
   `Shop`) scrolls through the shared `attachDragScroll` helper, which maps raw
   pixel delta → row offset with no velocity. Releasing a fast swipe stops the list
   dead. On web (and especially mobile-web) this reads as heavy and broken compared
   to the native momentum scrolling players expect.

3. **Stuck drags on pointer interruption.** Neither `scrollDrag` nor `battleCamera`
   handles `pointercancel`. When the browser steals the gesture (iOS swipe-back,
   OS-level zoom, focus loss), the drag-tracking flag never clears and the next tap
   can mis-fire or the list can jump.

## Goals

- One source of truth for the tap-vs-drag slop distance.
- Momentum/flick scrolling on the shared list-scroll helper, so all three list
  scenes gain it at once.
- Gestures never get "stuck": a cancelled/interrupted pointer cleanly ends tracking
  and any in-flight fling.
- All new decision logic lives in a **pure, Phaser-free, unit-tested module** per
  the project's logic/presenter split convention.

## Non-Goals (explicitly out of scope — YAGNI / higher risk)

- Battle-camera **pan** momentum (bounds-clamped pan inertia is more invasive and
  riskier; wheel/pinch/pan classification is left as-is beyond the shared slop
  constant).
- Pinch-zoom robustness rework (multi-touch fallback).
- Mobile hover-state simulation for buttons.
- Persisting scroll offsets across scene re-entry.
- Long-press / double-tap gestures.

These are real follow-ups but are independent of the three fixes above and would
dilute a focused, low-risk "feel" pass.

## Architecture

### New pure module: `src/core/gesture.ts`

Phaser-free, no `Date.now()` / `Math.random()` (time is passed in), fully unit-
tested. It owns:

**Shared constants**
```ts
/** Pointer travel (px) past which a press is a drag, not a tap. One source of
 *  truth across battle tap, list scroll, and camera pan. */
export const TAP_SLOP_PX = 8;
```

**Flick / momentum physics (pure functions)**

The list scroll position is fundamentally a continuous pixel value that the grid
renders as integer row offsets. Momentum is therefore computed in *pixel* space and
converted to rows by the presenter.

```ts
/** A timestamped pointer sample (px position along the scroll axis, ms clock). */
export interface FlickSample { pos: number; t: number; }

/** Release velocity in px/ms from recent samples (most-recent window). Returns 0
 *  if samples are too sparse/stale to be a flick. */
export function flickVelocity(samples: FlickSample[]): number;

/** Advance a fling one frame: returns the next velocity after friction decay over
 *  `dtMs`. Velocity decays exponentially; below MIN_FLICK_VEL it snaps to 0. */
export function decayVelocity(vel: number, dtMs: number): number;

/** True when a velocity is fast enough to start/continue a fling. */
export function isFlick(vel: number): boolean;
```

Tuning constants (exported so they are testable and adjustable):
- `FLICK_FRICTION` — exponential decay per ms (e.g. velocity halves ~every 130ms).
- `MIN_FLICK_VEL` — px/ms below which a fling stops (snap to 0).
- `FLICK_SAMPLE_WINDOW_MS` — only samples newer than this contribute to release
  velocity (e.g. 80ms), so a slow drag that pauses before release does NOT fling.
- `MAX_FLICK_VEL` — clamp so a violent flick can't overshoot absurdly.

All four have unit tests pinning the qualitative behavior (decay monotonic toward
0, stale samples ignored, fast swipe → non-zero velocity, slow drag → 0).

### Wiring: `src/scenes/scrollDrag.ts`

`attachDragScroll` gains momentum and cancel-safety while keeping its existing
public interface (`DragScrollConfig` / `DragScrollHandle`) **unchanged** — so the
three consumer scenes need no edits.

Internal changes:
- Replace the inline `4` slop with `TAP_SLOP_PX` from `gesture.ts`.
- During a tracked drag, record `FlickSample[]` (pointer `y`, `scene.time.now`),
  keeping only the recent window.
- On `pointerup`, compute `flickVelocity`. If `isFlick`, start a fling: register a
  `scene.events.on('update', step)` loop that:
  - accumulates a fractional pixel position from `decayVelocity` each frame
    (using the frame `delta` ms),
  - converts the pixel displacement to a clamped row offset (reusing the existing
    `dragOffset` math / a shared pixel→row conversion),
  - calls `setOffset` + `onChange` only when the integer offset actually changes,
  - stops (and unregisters the update handler) when velocity hits 0 or the offset
    clamps at 0 / `maxOffset`.
- A new `pointerdown` (or a fresh tracked gesture) **cancels any in-flight fling**
  immediately — so touching the list stops it, exactly like native scroll.
- Add `pointercancel` handling (mirror of `pointerup`): stop tracking and end any
  fling cleanly. (`scrolled` flag semantics for tap-suppression are preserved.)
- `DragScrollHandle` cleanup: ensure the update handler is removed on scene
  shutdown to avoid a leak across scene re-entry (per the scene-reentry-reset
  convention).

### Wiring: `src/scenes/battleCamera.ts`

- Replace the local `PAN_THRESHOLD = 6` with `TAP_SLOP_PX` from `gesture.ts` so the
  pan threshold matches every other surface.
- Add `pointercancel` → same handler as `onUp` (clear `panning`/`pinching`/
  `pinchDist`) and unregister it in `destroy()`.
- No pan momentum (out of scope).

### Wiring: `src/scenes/battleSceneInput.ts` (and equip threshold)

- Replace the literal `8`/`SLOP`-style magic numbers for the battle tap-vs-drag and
  the Hero equip `dragDistanceThreshold` with `TAP_SLOP_PX` where they exist, so the
  constant is genuinely the single source of truth. (Values already happen to be 8;
  this removes the duplication, not the behavior.)

## Data Flow

```
pointerdown ──► cancel any fling ──► start tracking, record sample t0
pointermove ──► append FlickSample (windowed) ──► setOffset(dragOffset(...)) on change
pointerup   ──► v = flickVelocity(samples)
                 ├─ isFlick(v)? ──► fling loop on scene 'update':
                 │                    v' = decayVelocity(v, dt)
                 │                    pxPos += v' * dt
                 │                    offset = clamp(pxPos → rows)
                 │                    setOffset/onChange on integer change
                 │                    stop when v'==0 or offset clamped
                 └─ else ──────────► done (offset already where drag left it)
pointercancel ─► stop tracking + stop fling
```

## Testing

**Pure unit tests (`tests/gesture.test.ts`) — the bulk of the coverage:**
- `TAP_SLOP_PX` is a single exported positive constant.
- `flickVelocity`: fast recent samples → non-zero, correctly-signed velocity;
  sparse/stale samples (older than the window) → 0; single sample → 0.
- `decayVelocity`: strictly decreases magnitude over time; reaches exactly 0 below
  `MIN_FLICK_VEL`; sign-preserving; clamped by `MAX_FLICK_VEL` on input.
- `isFlick`: boundary around `MIN_FLICK_VEL`.
- An integration-style pure test: simulate a release velocity and iterate
  `decayVelocity` to confirm the fling **terminates** (no infinite loop) and total
  pixel travel is finite & monotonic.

**scrollDrag tests (`tests/scrollDrag.test.ts`, extend existing if present):**
- `dragOffset` math unchanged (regression).
- The pixel→row conversion used by the fling clamps to `[0, maxOffset]`.
- (Phaser-bound wiring — the `scene.events` fling loop — is validated via the pure
  physics + a thin fake-scene harness if one already exists; otherwise covered by
  the pure termination test, since the loop is a direct application of the pure
  functions.)

**Full suite + typecheck + eslint** must stay green (the one pre-existing,
unrelated `firebaseCachePolicy.test.ts` failure is out of scope and noted).

## Risk / Rollback

Low risk: the consumer scenes' public contract is unchanged; the new behavior is
additive (momentum) plus a constant-unification (no behavioral change, values were
already 8 in most places — the camera pan tightens 6→8). If momentum feels wrong,
the tuning constants are isolated in `gesture.ts` and adjustable without touching
wiring. Rollback = revert `scrollDrag.ts` to the row-only mapping; `gesture.ts`
becomes dead code.
