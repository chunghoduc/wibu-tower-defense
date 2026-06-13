# Battle Touch-Gesture Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make battlefield gestures discoverable on web/touch — add tap-to-place towers and double-tap-to-zoom, without disturbing the existing drag-to-place or pan logic.

**Architecture:** Two new pure, Phaser-free modules carry the logic (`core/placementMode.ts` state machine; an `isDoubleTap` predicate in `core/gesture.ts`). Thin presenter wiring in `BattleScene.ts` / `battleSceneInput.ts` (avatar tap → arm; field tap → place; pointer-move ghost follow) and `battleCamera.ts` (double-tap → `zoomToward`). Real-pointer CDP playtest verifies the wired behaviour.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Chrome DevTools Protocol (headless) for the integration repro.

---

## File Structure

- **Create** `src/core/placementMode.ts` — pure arm/disarm state + field-tap decision. No Phaser.
- **Create** `tests/placementMode.test.ts` — unit tests for the above.
- **Modify** `src/core/gesture.ts` — add `DOUBLE_TAP_GAP_MS`, `DOUBLE_TAP_DIST_PX`, `isDoubleTap`.
- **Modify** `tests/gesture.test.ts` — unit tests for `isDoubleTap`.
- **Modify** `src/scenes/BattleScene.ts` — `placement` field + reset; avatar tap handler in `buildBuildBar`.
- **Modify** `src/scenes/battleSceneInput.ts` — arm/cancel methods; field-tap place; ghost-follow on pointermove; cancel on dragstart.
- **Modify** `src/scenes/battleCamera.ts` — double-tap zoom on pointerdown.
- **Modify** `scripts/playtest/repro_input.mjs` — add tap-place / cancel / double-tap-zoom assertions.

---

## Task 1: Pure placement state machine

**Files:**
- Create: `src/core/placementMode.ts`
- Test: `tests/placementMode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/placementMode.test.ts
import { describe, it, expect } from "vitest";
import {
  emptyPlacement,
  armPlacement,
  disarmPlacement,
  isArmed,
  resolveFieldTap,
} from "../src/core/placementMode.ts";

describe("placementMode", () => {
  it("starts unarmed", () => {
    expect(isArmed(emptyPlacement())).toBe(false);
    expect(emptyPlacement().armedId).toBe(null);
  });

  it("arms a tower id", () => {
    const s = armPlacement(emptyPlacement(), "yamo");
    expect(isArmed(s)).toBe(true);
    expect(s.armedId).toBe("yamo");
  });

  it("re-arming the SAME id toggles back to unarmed", () => {
    const s = armPlacement(armPlacement(emptyPlacement(), "yamo"), "yamo");
    expect(isArmed(s)).toBe(false);
  });

  it("arming a DIFFERENT id swaps the armed tower", () => {
    const s = armPlacement(armPlacement(emptyPlacement(), "yamo"), "pip");
    expect(s.armedId).toBe("pip");
  });

  it("disarm clears", () => {
    expect(isArmed(disarmPlacement(armPlacement(emptyPlacement(), "yamo")))).toBe(false);
  });

  it("resolveFieldTap is idle when unarmed", () => {
    expect(resolveFieldTap(emptyPlacement(), { canPlace: true, affordable: true })).toBe("idle");
  });

  it("resolveFieldTap places when armed + valid + affordable", () => {
    const s = armPlacement(emptyPlacement(), "yamo");
    expect(resolveFieldTap(s, { canPlace: true, affordable: true })).toBe("place");
  });

  it("resolveFieldTap is blocked when armed but invalid or unaffordable", () => {
    const s = armPlacement(emptyPlacement(), "yamo");
    expect(resolveFieldTap(s, { canPlace: false, affordable: true })).toBe("blocked");
    expect(resolveFieldTap(s, { canPlace: true, affordable: false })).toBe("blocked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/placementMode.test.ts`
Expected: FAIL — cannot find module `../src/core/placementMode.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/placementMode.ts
//
// Pure state machine for "tap-to-place": which build-bar tower avatar (if any)
// is armed for a follow-up field tap. No Phaser, no time, no DOM — the scene
// presenter owns the ghost visuals and calls battle.placeTowerAt. Keeping the
// decision here makes the tap-vs-place rules unit-testable.

export interface PlacementState {
  /** Tower def id armed for the next field tap, or null when nothing is armed. */
  armedId: string | null;
}

export function emptyPlacement(): PlacementState {
  return { armedId: null };
}

/** Arm `id`; tapping the already-armed id toggles back to unarmed. */
export function armPlacement(s: PlacementState, id: string): PlacementState {
  return { armedId: s.armedId === id ? null : id };
}

export function disarmPlacement(_s: PlacementState): PlacementState {
  return { armedId: null };
}

export function isArmed(s: PlacementState): boolean {
  return s.armedId !== null;
}

/** What a tap on the battlefield should do given board validity + affordability. */
export type PlaceDecision = "place" | "blocked" | "idle";

export function resolveFieldTap(
  s: PlacementState,
  opts: { canPlace: boolean; affordable: boolean },
): PlaceDecision {
  if (!isArmed(s)) return "idle";
  return opts.canPlace && opts.affordable ? "place" : "blocked";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/placementMode.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/placementMode.ts tests/placementMode.test.ts
git commit -m "$(printf 'feat(placement): pure tap-to-place state machine\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: `isDoubleTap` predicate

**Files:**
- Modify: `src/core/gesture.ts` (append after `isFlick`)
- Test: `tests/gesture.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/gesture.test.ts`:

```ts
import { isDoubleTap, DOUBLE_TAP_GAP_MS, DOUBLE_TAP_DIST_PX } from "../src/core/gesture.ts";

describe("isDoubleTap", () => {
  it("is false with no previous tap", () => {
    expect(isDoubleTap(null, { t: 100, x: 0, y: 0 })).toBe(false);
  });
  it("is true for a quick, nearby second tap", () => {
    expect(isDoubleTap({ t: 0, x: 10, y: 10 }, { t: DOUBLE_TAP_GAP_MS - 1, x: 12, y: 12 })).toBe(true);
  });
  it("is false when the gap is too long", () => {
    expect(isDoubleTap({ t: 0, x: 10, y: 10 }, { t: DOUBLE_TAP_GAP_MS + 1, x: 10, y: 10 })).toBe(false);
  });
  it("is false when the taps are too far apart", () => {
    expect(isDoubleTap({ t: 0, x: 0, y: 0 }, { t: 50, x: DOUBLE_TAP_DIST_PX + 1, y: 0 })).toBe(false);
  });
  it("is false for a negative time delta", () => {
    expect(isDoubleTap({ t: 100, x: 0, y: 0 }, { t: 50, x: 0, y: 0 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gesture.test.ts`
Expected: FAIL — `isDoubleTap` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core/gesture.ts`:

```ts
/** Max ms between the two taps of a double-tap. */
export const DOUBLE_TAP_GAP_MS = 280;
/** Max px between the two tap points of a double-tap. */
export const DOUBLE_TAP_DIST_PX = 24;

/** A timestamped tap location (screen px + ms clock). */
export interface TapPoint {
  t: number;
  x: number;
  y: number;
}

/** True when `cur` lands soon enough after, and close enough to, `prev` to be a
 *  double-tap. `prev` is null when there is no prior tap to pair with. */
export function isDoubleTap(prev: TapPoint | null, cur: TapPoint): boolean {
  if (!prev) return false;
  const dt = cur.t - prev.t;
  if (dt < 0 || dt > DOUBLE_TAP_GAP_MS) return false;
  return Math.hypot(cur.x - prev.x, cur.y - prev.y) <= DOUBLE_TAP_DIST_PX;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/gesture.test.ts`
Expected: PASS (existing 9 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/core/gesture.ts tests/gesture.test.ts
git commit -m "$(printf 'feat(gesture): pure isDoubleTap predicate\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Wire tap-to-place into BattleScene

**Files:**
- Modify: `src/scenes/BattleScene.ts` (imports; `placement` field ~line 85; reset in `create` ~line 166; avatar tap in `buildBuildBar` ~line 455)
- Modify: `src/scenes/battleSceneInput.ts` (imports; arm/cancel methods; field-tap in `bindInput`; ghost-follow; cancel on dragstart)

- [ ] **Step 1: Add the placement field + imports to BattleScene.ts**

At the top of `src/scenes/BattleScene.ts`, add to the gesture import (or add a new import line):

```ts
import { TAP_SLOP_PX } from "../core/gesture.ts";
import { emptyPlacement, type PlacementState } from "../core/placementMode.ts";
```

Next to `placeGhost` (~line 85) add the field:

```ts
  placement: PlacementState = emptyPlacement();
```

In `create()`, next to the `this.placeGhost = null;` reset (~line 166) add:

```ts
    this.placement = emptyPlacement();
```

- [ ] **Step 2: Add the avatar tap handler in `buildBuildBar`**

In `src/scenes/BattleScene.ts`, immediately after `c.setInteractive({ useHandCursor: true, draggable: true });` (~line 455) and before `this.ui.add(c);`, insert:

```ts
      // Tap (not drag) a card to ARM it for tap-to-place; drag still works.
      c.on("pointerdown", (p: Phaser.Input.Pointer) => {
        c.setData("tapDownX", p.x);
        c.setData("tapDownY", p.y);
      });
      c.on("pointerup", (p: Phaser.Input.Pointer) => {
        const moved = Math.hypot(p.x - (c.getData("tapDownX") ?? p.x), p.y - (c.getData("tapDownY") ?? p.y));
        if (moved > TAP_SLOP_PX) return; // that was a drag-place, not a tap
        this.toggleArm(def.id);
      });
```

- [ ] **Step 3: Add arm/cancel methods + field-tap + ghost-follow to battleSceneInput.ts**

In `src/scenes/battleSceneInput.ts`, extend the imports:

```ts
import {
  emptyPlacement,
  armPlacement,
  disarmPlacement,
  isArmed,
  resolveFieldTap,
} from "../core/placementMode.ts";
```

Add these methods to the `inputMethods` object (place them next to `clearGhost`):

```ts
  /** Toggle a build-bar card armed for tap-to-place; shows/clears the ghost. */
  toggleArm(this: BattleScene, id: string): void {
    if (this.battle.outcome !== "ongoing") return;
    this.placement = armPlacement(this.placement, id);
    if (isArmed(this.placement)) {
      this.makeGhost(id);
      const p = this.input.activePointer;
      if (p) this.updateGhost(id, p);
    } else {
      this.clearGhost();
    }
  },

  /** Drop any armed tap-to-place state and its ghost. */
  cancelPlacement(this: BattleScene): void {
    this.placement = disarmPlacement(this.placement);
    this.clearGhost();
  },
```

In `bindInput`, add a pointermove handler that makes the armed ghost follow the pointer. Insert right after the existing `this.input.on("pointerdown", ...)` block:

```ts
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (isArmed(this.placement) && this.placement.armedId) {
        this.updateGhost(this.placement.armedId, pointer);
      }
    });
```

In the `bindInput` `pointerup` handler, replace the tail (from `const wp = this.cameras.main.getWorldPoint(...)` through `this.battle.commandHero(world);`) with:

```ts
        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const world: Vec2 = { x: wp.x, y: wp.y };

        // Tap-to-place: if a card is armed, a field tap drops the tower (or is
        // blocked on an invalid/unaffordable spot) and never walks the hero.
        if (isArmed(this.placement) && this.placement.armedId) {
          const id = this.placement.armedId;
          const def = this.buildOrder.find((d) => d.id === id);
          const decision = resolveFieldTap(this.placement, {
            canPlace: this.battle.canPlaceAt(world),
            affordable: !!def && this.battle.gold >= def.cost,
          });
          if (decision === "place") {
            if (this.battle.placeTowerAt(id, world)) this.sfx.place();
            this.cancelPlacement();
          }
          return;
        }

        // Tap a tower → panel + quick actions. Tap empty ground → walk the hero.
        const tower = this.towerAt(world);
        if (tower) {
          this.selectTower(tower.uid);
          return;
        }
        this.deselectTower();
        this.battle.commandHero(world);
```

In `setupPlacementDrag`, make a drag take over from an armed tap. At the very top of the `dragstart` handler body (after the `if (!obj.getData || !obj.getData("towerId")) return;` guard), add:

```ts
      this.cancelPlacement(); // a drag-place supersedes any armed tap-to-place
```

- [ ] **Step 4: Register the new methods on the InputMethods type**

`InputMethods` is `typeof inputMethods`, so `toggleArm`/`cancelPlacement` are picked up automatically. No separate interface edit needed. Confirm `BattleScene.ts:59` still reads `export interface BattleScene extends RenderMethods, SpritesMethods, InputMethods {}`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/battleSceneInput.ts
git commit -m "$(printf 'feat(battle): tap a card then tap the field to place a tower\n\nDrag-to-place retained; arming follows the pointer with the existing ghost\nand is cancelled by a drag-place or a successful drop.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Double-tap to zoom in `battleCamera.ts`

**Files:**
- Modify: `src/scenes/battleCamera.ts`

- [ ] **Step 1: Import the predicate + add a last-tap field**

Extend the gesture import at the top of `src/scenes/battleCamera.ts`:

```ts
import { TAP_SLOP_PX, isDoubleTap, type TapPoint } from "../core/gesture.ts";
```

Add a private field next to `pinchDist` (~line 37):

```ts
  private lastTap: TapPoint | null = null;
```

- [ ] **Step 2: Detect the double-tap on pointerdown**

Replace the existing `this.onDown = () => { ... };` assignment in the constructor with:

```ts
    this.onDown = (p: Phaser.Input.Pointer) => {
      this.consumedGesture = false;
      this.panning = false;
      // A quick second tap near the first zooms toward it — a discoverable way
      // to get closer, which makes drag-to-pan meaningful. zoomToward marks the
      // gesture consumed so the scene's tap handler won't also walk the hero.
      const cur: TapPoint = { t: this.scene.time.now, x: p?.x ?? 0, y: p?.y ?? 0 };
      if (p && isDoubleTap(this.lastTap, cur)) {
        this.zoomToward(1.3, p.x, p.y);
        this.lastTap = null; // consume so a third tap doesn't re-fire
      } else {
        this.lastTap = cur;
      }
    };
```

`onDown` is declared as `(p: Phaser.Input.Pointer) => void`. Confirm the declaration field reads:

```ts
  private readonly onDown: (p: Phaser.Input.Pointer) => void;
```

(If it currently reads `() => void`, change it to the above.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full unit suite**

Run: `npx vitest run`
Expected: all green except the pre-existing unrelated `firebaseCachePolicy.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleCamera.ts
git commit -m "$(printf 'feat(camera): double-tap the battlefield to zoom toward that point\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Integration repro + full verification

**Files:**
- Modify: `scripts/playtest/repro_input.mjs`

- [ ] **Step 1: Add tap-place, cancel, and double-tap assertions**

In `scripts/playtest/repro_input.mjs`, after the existing `T4 pan@zoom` block and before the screenshot, add:

```js
  // Reset to base zoom for clean placement coords.
  await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.camCtl.reset(); return 'reset';`);

  // TEST 5: TAP avatar 0 to arm, then TAP an empty field spot to place.
  await evalJs(`return window.__tap(51,520);`);            // arm card 0
  await evalJs(`return window.__tap(470,300);`);           // place on field
  console.log(
    "T5 tap-place:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return JSON.stringify({towers:bs.battle.towers.length, armed:bs.placement.armedId});`),
  );

  // TEST 6: arm again, then TAP a build-bar avatar (UI) — arming toggles, no place.
  await evalJs(`return window.__tap(51,520);`);            // arm
  console.log(
    "T6 armed:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return JSON.stringify({armed:bs.placement.armedId});`),
  );
  await evalJs(`return window.__tap(51,520);`);            // tap same card again → disarm
  console.log(
    "T6 toggle-off:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return JSON.stringify({armed:bs.placement.armedId});`),
  );

  // TEST 7: double-tap the field zooms in.
  console.log(
    "T7 double-tap-zoom:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.camCtl.reset(); const z0=bs.cameras.main.zoom;
    await window.__tap(480,300); await new Promise(r=>setTimeout(r,90)); await window.__tap(480,300);
    return JSON.stringify({z0:+z0.toFixed(3), z1:+bs.cameras.main.zoom.toFixed(3), zoomedIn:bs.camCtl.isZoomedIn});`),
  );
```

- [ ] **Step 2: Run the real-pointer repro**

Build, serve `dist/` (python static server survives this runner where `vite preview` is killed), launch headless Chrome with `--remote-allow-origins=*`, then run the repro:

```bash
npm run build
# background: python3 -m http.server 4188 --bind 127.0.0.1   (cwd dist/)
# background: google-chrome --headless=new --disable-gpu --no-sandbox \
#   --user-data-dir=/tmp/chrome-prof --remote-allow-origins=* \
#   --remote-debugging-port=9222 about:blank
node scripts/playtest/repro_input.mjs --port=4188
```

Expected output includes:
- `T1 drag-place: {"towers":1,...}` (regression: drag still works)
- `T5 tap-place:` towers incremented vs after T1, `armed:null`
- `T6 armed:` non-null id, then `T6 toggle-off: {"armed":null}`
- `T7 double-tap-zoom:` `z1 > z0`, `zoomedIn:true`

- [ ] **Step 3: Full verification gates**

```bash
npm run typecheck
npm run lint        # 0 errors; new files < 500 lines
npx vitest run      # green except pre-existing firebaseCachePolicy.test.ts
npm run build
```

- [ ] **Step 4: Update memory**

Update `memory/project_gesture_feel.md` to note the battlefield tap-to-place + double-tap-zoom additions and the `placementMode.ts` module; add nothing to `MEMORY.md` (the existing pointer already covers gesture feel).

- [ ] **Step 5: Commit**

```bash
git add scripts/playtest/repro_input.mjs memory/project_gesture_feel.md
git commit -m "$(printf 'test(playtest): real-pointer tap-place + double-tap-zoom repro; memory\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-Review Notes

- **Spec coverage:** tap-to-place (Tasks 1, 3) ✓; double-tap zoom (Tasks 2, 4) ✓; pure modules + unit tests ✓; integration repro + gates (Task 5) ✓; non-goals respected (no pinch/momentum/min-zoom/hero-walk changes). ✓
- **Type consistency:** `PlacementState.armedId`, `armPlacement/disarmPlacement/isArmed/resolveFieldTap`, `TapPoint`, `isDoubleTap` names match across tasks and the spec. `toggleArm`/`cancelPlacement` are the only new scene methods, defined once and called consistently.
- **Cancellation paths:** successful place (`cancelPlacement` in field tap), toggle-same-card (state machine), drag-place takeover (`dragstart`), scene re-entry (`create()` reset). Battle-end taps short-circuit via the `outcome !== "ongoing"` guards already in `bindInput`/`toggleArm`.
