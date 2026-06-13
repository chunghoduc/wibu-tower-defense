# Web Gesture Feel Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make web pointer/touch gestures feel responsive and consistent by unifying the tap-vs-drag slop distance, adding momentum (flick) scrolling to all list scenes, and making interrupted gestures end cleanly.

**Architecture:** A new pure, Phaser-free module `src/core/gesture.ts` owns the shared `TAP_SLOP_PX` constant and flick physics (velocity sampling + exponential decay). The existing `scrollDrag.ts` presenter gains momentum and `pointercancel`-safety while keeping its public interface unchanged, so the three consumer scenes (Collection, Hero, Shop) need no edits. `battleCamera.ts` adopts the shared slop and cancel-safety. Battle tap and equip thresholds switch their literal `8` to the shared constant.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure-logic/Phaser-presenter split (pure modules have no Phaser/Date.now/Math.random).

**Reference spec:** `docs/superpowers/specs/2026-06-13-web-gesture-feel-design.md`

---

### Task 1: Pure gesture constants + flick physics module

**Files:**
- Create: `src/core/gesture.ts`
- Test: `tests/gesture.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/gesture.test.ts`:

```ts
// tests/gesture.test.ts
import { describe, it, expect } from "vitest";
import {
  TAP_SLOP_PX,
  MIN_FLICK_VEL,
  MAX_FLICK_VEL,
  flickVelocity,
  decayVelocity,
  isFlick,
  type FlickSample,
} from "../src/core/gesture.ts";

describe("TAP_SLOP_PX", () => {
  it("is a single positive constant", () => {
    expect(TAP_SLOP_PX).toBeGreaterThan(0);
    expect(Number.isFinite(TAP_SLOP_PX)).toBe(true);
  });
});

describe("flickVelocity", () => {
  it("returns 0 for fewer than two samples", () => {
    expect(flickVelocity([])).toBe(0);
    expect(flickVelocity([{ pos: 10, t: 0 }])).toBe(0);
  });

  it("gives a non-zero, correctly-signed velocity for a fast recent swipe", () => {
    // finger moved from pos 300 -> 200 over 20ms (upward = negative): -5 px/ms
    const samples: FlickSample[] = [
      { pos: 300, t: 1000 },
      { pos: 250, t: 1010 },
      { pos: 200, t: 1020 },
    ];
    const v = flickVelocity(samples);
    expect(v).toBeLessThan(0);
    expect(Math.abs(v)).toBeCloseTo(5, 1);
  });

  it("ignores samples older than the recent window", () => {
    // An old stationary stretch then a tiny recent move => near-zero velocity,
    // NOT dominated by the long-ago position.
    const samples: FlickSample[] = [
      { pos: 0, t: 0 },
      { pos: 0, t: 500 },
      { pos: 2, t: 520 },
    ];
    expect(Math.abs(flickVelocity(samples))).toBeLessThan(MIN_FLICK_VEL * 2);
  });
});

describe("decayVelocity", () => {
  it("strictly decreases magnitude over time and preserves sign", () => {
    const v0 = 4;
    const v1 = decayVelocity(v0, 16);
    expect(v1).toBeGreaterThan(0);
    expect(v1).toBeLessThan(v0);
  });

  it("snaps to exactly 0 once below MIN_FLICK_VEL", () => {
    const tiny = MIN_FLICK_VEL * 0.5;
    expect(decayVelocity(tiny, 16)).toBe(0);
  });

  it("clamps the input magnitude to MAX_FLICK_VEL", () => {
    const huge = MAX_FLICK_VEL * 100;
    expect(decayVelocity(huge, 0)).toBeLessThanOrEqual(MAX_FLICK_VEL);
  });

  it("a fling terminates in finite steps with finite, monotonic travel", () => {
    let v = MAX_FLICK_VEL; // start at the fastest allowed
    let travel = 0;
    let steps = 0;
    while (v !== 0 && steps < 100000) {
      v = decayVelocity(v, 16);
      travel += Math.abs(v) * 16;
      steps++;
    }
    expect(v).toBe(0);
    expect(steps).toBeLessThan(10000); // converges quickly, no infinite loop
    expect(Number.isFinite(travel)).toBe(true);
  });
});

describe("isFlick", () => {
  it("is true above MIN_FLICK_VEL and false below", () => {
    expect(isFlick(MIN_FLICK_VEL * 2)).toBe(true);
    expect(isFlick(-MIN_FLICK_VEL * 2)).toBe(true); // sign-agnostic
    expect(isFlick(MIN_FLICK_VEL * 0.5)).toBe(false);
    expect(isFlick(0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gesture.test.ts`
Expected: FAIL — cannot resolve `../src/core/gesture.ts` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/gesture.ts`:

```ts
// src/core/gesture.ts
//
// Pure gesture physics & constants shared across the input layer. No Phaser, no
// Date.now/Math.random — time is always passed in. The scene presenters
// (scrollDrag.ts, battleCamera.ts, battleSceneInput.ts) consume these so tap-vs-
// drag and list momentum behave identically everywhere.

/** Pointer travel (px) past which a press is a drag, not a tap. One source of
 *  truth across battle tap, list scroll, and camera pan. */
export const TAP_SLOP_PX = 8;

/** Exponential friction: fraction of velocity retained per ms (≈ halves every
 *  ~120ms). Lower = stops sooner. */
export const FLICK_FRICTION = 0.994;
/** px/ms below which a fling stops dead (snap to 0). */
export const MIN_FLICK_VEL = 0.05;
/** px/ms ceiling so a violent flick can't overshoot absurdly. */
export const MAX_FLICK_VEL = 6;
/** Only pointer samples newer than this (ms before release) feed release velocity,
 *  so a slow drag that pauses before lift-off does NOT fling. */
export const FLICK_SAMPLE_WINDOW_MS = 80;

/** A timestamped pointer sample: position (px) along the scroll axis, ms clock. */
export interface FlickSample {
  pos: number;
  t: number;
}

const clampMag = (v: number, max: number): number =>
  v > max ? max : v < -max ? -max : v;

/** Release velocity (px/ms) from the recent sample window. 0 if too sparse/stale. */
export function flickVelocity(samples: FlickSample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  // Oldest sample still inside the window relative to the final sample.
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > FLICK_SAMPLE_WINDOW_MS) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return clampMag((last.pos - first.pos) / dt, MAX_FLICK_VEL);
}

/** Advance a fling one frame: next velocity after `dtMs` of friction. Snaps to 0
 *  below MIN_FLICK_VEL; clamps input magnitude to MAX_FLICK_VEL. */
export function decayVelocity(vel: number, dtMs: number): number {
  const v = clampMag(vel, MAX_FLICK_VEL) * Math.pow(FLICK_FRICTION, dtMs);
  return Math.abs(v) < MIN_FLICK_VEL ? 0 : v;
}

/** True when a velocity is fast enough to start/continue a fling (sign-agnostic). */
export function isFlick(vel: number): boolean {
  return Math.abs(vel) >= MIN_FLICK_VEL;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/gesture.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/core/gesture.ts tests/gesture.test.ts
git commit -m "feat(gesture): pure TAP_SLOP_PX + flick physics module

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: scrollDrag — momentum, shared slop, cancel-safety

**Files:**
- Modify: `src/scenes/scrollDrag.ts`
- Test: `tests/scrollDrag.test.ts:1-35` (add a new describe block; keep existing `dragOffset` tests intact)

Note: `dragOffset` and the public `DragScrollConfig`/`DragScrollHandle` interfaces stay unchanged. We add a pure `offsetFromPixels` helper (so the fling's pixel→row conversion is testable) and wire momentum into `attachDragScroll`.

- [ ] **Step 1: Write the failing test**

Append to `tests/scrollDrag.test.ts` (after the existing `describe("dragOffset", ...)` block):

```ts
import { offsetFromPixels } from "../src/scenes/scrollDrag.ts";

describe("offsetFromPixels", () => {
  it("converts a positive pixel scroll (content moves up) into row offset", () => {
    // 120px of upward content travel at 50px/row, from offset 0 => +2 rows
    expect(offsetFromPixels(0, 120, 50, 9)).toBe(2);
  });

  it("converts a negative pixel scroll back toward the top", () => {
    expect(offsetFromPixels(5, -100, 50, 9)).toBe(3);
  });

  it("clamps at the top (0)", () => {
    expect(offsetFromPixels(1, -500, 50, 9)).toBe(0);
  });

  it("clamps at maxOffset", () => {
    expect(offsetFromPixels(7, 1000, 50, 9)).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scrollDrag.test.ts`
Expected: FAIL — `offsetFromPixels` is not exported from `scrollDrag.ts`.

- [ ] **Step 3: Write minimal implementation**

Edit `src/scenes/scrollDrag.ts`. 

(a) Add the import at the top (after the existing `import type Phaser from "phaser";`):

```ts
import {
  TAP_SLOP_PX,
  flickVelocity,
  decayVelocity,
  isFlick,
  type FlickSample,
  FLICK_SAMPLE_WINDOW_MS,
} from "../core/gesture.ts";
```

(b) Add the pure helper just after the existing `dragOffset` function:

```ts
/** Pure: clamped row-offset after `px` of content scroll (positive = content moves
 *  up, revealing lower rows) from `startOffset`. Used by the momentum fling. */
export function offsetFromPixels(
  startOffset: number,
  px: number,
  rowH: number,
  maxOffset: number,
): number {
  return clamp(startOffset + Math.round(px / rowH), 0, maxOffset);
}
```

(c) Replace the entire body of `attachDragScroll` (the function from `export function attachDragScroll(...)` to its closing `}`) with:

```ts
export function attachDragScroll(scene: Phaser.Scene, cfg: DragScrollConfig): DragScrollHandle {
  let tracking = false,
    startY = 0,
    startOffset = 0,
    scrolled = false;
  let samples: FlickSample[] = [];

  // Momentum fling state.
  let flinging = false;
  let flingVel = 0; // px/ms
  let flingPx = 0; // accumulated content-pixel travel since the fling began
  let flingStartOffset = 0;

  const inside = (px: number, py: number): boolean => {
    const r = cfg.rect();
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  };

  const stopFling = (): void => {
    if (!flinging) return;
    flinging = false;
    flingVel = 0;
    scene.events.off("update", onFlingStep);
  };

  function onFlingStep(_time: number, delta: number): void {
    if (!flinging) return;
    flingVel = decayVelocity(flingVel, delta);
    // A drag up (finger up) yields a negative velocity but should INCREASE the
    // offset (reveal lower rows) — same sign convention as dragOffset, so negate.
    flingPx += -flingVel * delta;
    const next = offsetFromPixels(flingStartOffset, flingPx, cfg.rowH, cfg.maxOffset());
    if (next !== cfg.getOffset()) {
      cfg.setOffset(next);
      cfg.onChange();
    }
    if (flingVel === 0 || next <= 0 || next >= cfg.maxOffset()) stopFling();
  }

  scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
    stopFling(); // touching the list halts momentum, like native scroll
    scrolled = false;
    if (cfg.enabled && !cfg.enabled()) return;
    if (cfg.blocked && cfg.blocked()) return;
    if (cfg.maxOffset() <= 0 || !inside(p.x, p.y)) return;
    tracking = true;
    startY = p.y;
    startOffset = cfg.getOffset();
    samples = [{ pos: p.y, t: scene.time.now }];
  });

  scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
    if (!tracking || !p.isDown) return;
    if (cfg.blocked && cfg.blocked()) {
      tracking = false;
      return;
    } // a tile-drag took over
    if (Math.abs(p.y - startY) > TAP_SLOP_PX) scrolled = true;
    samples.push({ pos: p.y, t: scene.time.now });
    // Keep only the recent window (plus the immediately-preceding sample).
    const cutoff = scene.time.now - FLICK_SAMPLE_WINDOW_MS;
    while (samples.length > 2 && samples[1].t < cutoff) samples.shift();
    const next = dragOffset(startOffset, startY, p.y, cfg.rowH, cfg.maxOffset());
    if (next !== cfg.getOffset()) {
      cfg.setOffset(next);
      cfg.onChange();
    }
  });

  const endGesture = (): void => {
    if (!tracking) return;
    tracking = false;
    const vel = flickVelocity(samples);
    samples = [];
    if (!isFlick(vel) || cfg.maxOffset() <= 0) return;
    flinging = true;
    flingVel = vel;
    flingPx = 0;
    flingStartOffset = cfg.getOffset();
    scene.events.on("update", onFlingStep);
  };

  scene.input.on("pointerup", endGesture);
  scene.input.on("pointercancel", () => {
    tracking = false;
    samples = [];
    stopFling();
  });
  // Defensive: tear down the fling loop when the scene shuts down / restarts.
  scene.events.once("shutdown", stopFling);
  scene.events.once("destroy", stopFling);

  return { didScroll: () => scrolled };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scrollDrag.test.ts`
Expected: PASS (existing `dragOffset` tests + new `offsetFromPixels` tests).

- [ ] **Step 5: Typecheck + lint the changed files**

Run: `npm run typecheck && npx eslint src/scenes/scrollDrag.ts src/core/gesture.ts`
Expected: no errors. (If `typecheck` flags the `onFlingStep` hoisting, it is a `function` declaration so it is hoisted — no change needed.)

- [ ] **Step 6: Commit**

```bash
git add src/scenes/scrollDrag.ts tests/scrollDrag.test.ts
git commit -m "feat(scroll): momentum fling + shared slop + cancel-safety in attachDragScroll

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: battleCamera — shared slop + cancel-safety

**Files:**
- Modify: `src/scenes/battleCamera.ts`

No new test: this is a constant-unification plus a defensive event handler; behavior is covered by typecheck + the existing build. (The pan threshold value moves 6→8 to match every other surface.)

- [ ] **Step 1: Adopt the shared slop constant**

In `src/scenes/battleCamera.ts`, add the import after `import Phaser from "phaser";`:

```ts
import { TAP_SLOP_PX } from "../core/gesture.ts";
```

Then delete the local constant line:

```ts
const PAN_THRESHOLD = 6; // px before a press becomes a pan
```

and in `handleMove`, change the threshold check from:

```ts
    if (!this.panning && Math.hypot(p.x - p.downX, p.y - p.downY) < PAN_THRESHOLD) return;
```

to:

```ts
    if (!this.panning && Math.hypot(p.x - p.downX, p.y - p.downY) < TAP_SLOP_PX) return;
```

- [ ] **Step 2: Add pointercancel safety**

In the constructor, after the existing `scene.input.on("pointerup", this.onUp);` line, add:

```ts
    scene.input.on("pointercancel", this.onUp);
```

And in `destroy()`, after the existing `this.scene.input.off("pointerup", this.onUp);` line, add:

```ts
    this.scene.input.off("pointercancel", this.onUp);
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/scenes/battleCamera.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/battleCamera.ts
git commit -m "feat(camera): shared TAP_SLOP_PX pan threshold + pointercancel safety

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Unify battle-tap & equip thresholds to the shared constant

**Files:**
- Modify: `src/scenes/battleSceneInput.ts:182`
- Modify: `src/scenes/HeroScene.ts:89`
- Modify: `src/scenes/SquadScene.ts:87`

These already use the literal `8`; switching them to `TAP_SLOP_PX` removes the duplication so the constant is genuinely the single source of truth (no behavior change).

- [ ] **Step 1: battleSceneInput.ts**

Add the import near the other `../core/...` imports at the top of `src/scenes/battleSceneInput.ts`:

```ts
import { TAP_SLOP_PX } from "../core/gesture.ts";
```

Change line 182 from:

```ts
        if (Math.hypot(pointer.x - this.tapX, pointer.y - this.tapY) > 8) return; // a drag, not a tap
```

to:

```ts
        if (Math.hypot(pointer.x - this.tapX, pointer.y - this.tapY) > TAP_SLOP_PX) return; // a drag, not a tap
```

- [ ] **Step 2: HeroScene.ts**

Add the import among the existing `../core/...` imports at the top of `src/scenes/HeroScene.ts`:

```ts
import { TAP_SLOP_PX } from "../core/gesture.ts";
```

Change line 89 from:

```ts
    this.input.dragDistanceThreshold = 8; // small moves = click (enhance), not drag
```

to:

```ts
    this.input.dragDistanceThreshold = TAP_SLOP_PX; // small moves = click (enhance), not drag
```

- [ ] **Step 3: SquadScene.ts**

Add the import among the existing imports at the top of `src/scenes/SquadScene.ts`:

```ts
import { TAP_SLOP_PX } from "../core/gesture.ts";
```

Change line 87 from:

```ts
    this.input.dragDistanceThreshold = 8;
```

to:

```ts
    this.input.dragDistanceThreshold = TAP_SLOP_PX;
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/scenes/battleSceneInput.ts src/scenes/HeroScene.ts src/scenes/SquadScene.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleSceneInput.ts src/scenes/HeroScene.ts src/scenes/SquadScene.ts
git commit -m "refactor(input): route battle-tap & equip thresholds through TAP_SLOP_PX

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Whole-project verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Lint (max-lines + cycles)**

Run: `npm run lint`
Expected: clean. Confirm `src/core/gesture.ts` and `src/scenes/scrollDrag.ts` are both well under 500 lines.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: all pass EXCEPT the single pre-existing, unrelated `tests/firebaseCachePolicy.test.ts` ("media glob must revalidate") failure. No new failures; `tests/gesture.test.ts` and `tests/scrollDrag.test.ts` green.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds (Vite + tsc), no type errors.

- [ ] **Step 5: Final report**

Summarize: root cause (inconsistent slop, no momentum, no cancel-safety), the fix (pure `gesture.ts` + momentum in `attachDragScroll` + cancel-safety + slop unification), and verification results. Note the pre-existing firebaseCachePolicy failure as out of scope. Do NOT push or deploy without explicit user confirmation.

---

## Self-Review

- **Spec coverage:** ✅ `TAP_SLOP_PX` single source (Tasks 1,3,4); flick physics (Task 1); momentum in `attachDragScroll` with unchanged public interface (Task 2); `pointercancel` safety in scrollDrag (Task 2) and battleCamera (Task 3); pure unit tests (Tasks 1,2); non-goals (camera pan momentum, pinch, hover, persistence) correctly excluded.
- **Placeholder scan:** ✅ none — every code step shows full code.
- **Type consistency:** ✅ `FlickSample {pos,t}`, `flickVelocity`/`decayVelocity`/`isFlick`, `offsetFromPixels(startOffset,px,rowH,maxOffset)`, `TAP_SLOP_PX` are named identically across all tasks; `clamp` reused from scrollDrag's existing top-level helper inside `offsetFromPixels`.
