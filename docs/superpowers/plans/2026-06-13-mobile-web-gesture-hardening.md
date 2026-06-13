# Mobile-Web Gesture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the battle canvas own 100% of touch gestures on mobile web, add two-finger pinch-pan, and enlarge the zoom buttons to the 44px touch-target minimum.

**Architecture:** A new pure `hardenTouchInput` util sets `touch-action:none` + `overscroll-behavior:none` on the live Phaser canvas (wired in `main.ts` on READY), backed by document-level CSS in `index.html`. A new pure `pinchUpdate` reducer in `gesture.ts` turns two pinch samples into a zoom factor + midpoint pan delta, wired into `battleCamera.handleMove`. Zoom buttons get explicit ≥44×44 hit areas. Pure units are TDD'd with Vitest; the DOM/canvas wiring is validated by the real-pointer `repro_input.mjs` playtest.

**Tech Stack:** TypeScript, Phaser 3, Vitest, ESLint (max-lines 500), madge (cycles), Vite.

---

## File Structure

- **Create** `src/core/touchInput.ts` — pure `hardenTouchInput(el)` (no Phaser).
- **Create** `tests/touchInput.test.ts` — unit tests for the above.
- **Modify** `index.html` — `touch-action`/`overscroll-behavior` CSS rules.
- **Modify** `src/main.ts` — call `hardenTouchInput(game.canvas)` on `READY`.
- **Modify** `src/core/gesture.ts` — add `PinchSample` + `pinchUpdate`.
- **Modify** `tests/gesture.test.ts` — unit tests for `pinchUpdate`.
- **Modify** `src/scenes/battleCamera.ts` — wire `pinchUpdate` into `handleMove`.
- **Modify** `src/scenes/battleSceneInput.ts` — enlarge ＋/− zoom-button hit areas.
- **Modify** `scripts/playtest/repro_input.mjs` — add a pinch-pan + no-page-scroll check.

---

## Task 1: Pure `hardenTouchInput` util

**Files:**
- Create: `src/core/touchInput.ts`
- Test: `tests/touchInput.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/touchInput.test.ts
import { describe, it, expect } from "vitest";
import { hardenTouchInput } from "../src/core/touchInput.ts";

describe("hardenTouchInput", () => {
  it("declares full gesture ownership on the element", () => {
    const el = { style: {} as { touchAction?: string; overscrollBehavior?: string } };
    hardenTouchInput(el);
    expect(el.style.touchAction).toBe("none");
    expect(el.style.overscrollBehavior).toBe("none");
  });

  it("is idempotent", () => {
    const el = { style: {} as { touchAction?: string; overscrollBehavior?: string } };
    hardenTouchInput(el);
    hardenTouchInput(el);
    expect(el.style.touchAction).toBe("none");
    expect(el.style.overscrollBehavior).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/touchInput.test.ts`
Expected: FAIL — cannot resolve `../src/core/touchInput.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/touchInput.ts
//
// Declare that an element owns all touch gestures on mobile web. Pure (no
// Phaser, no DOM globals): operates on any object exposing a writable `style`,
// so it unit-tests against a plain stub and works on the real Phaser canvas.
//
// Why: the browser otherwise co-owns pinch / double-tap-zoom / scroll on the
// canvas. `touch-action: none` hands every gesture to the game (MDN), and
// `overscroll-behavior: none` kills pull-to-refresh and scroll-chain bounce.

/** Minimal element shape we mutate — keeps this unit testable with a stub. */
export interface StyleHost {
  style: { touchAction?: string; overscrollBehavior?: string };
}

/** Suppress native scroll, pinch, double-tap-zoom, and overscroll on `el`.
 *  Idempotent. */
export function hardenTouchInput(el: StyleHost): void {
  el.style.touchAction = "none";
  el.style.overscrollBehavior = "none";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/touchInput.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/touchInput.ts tests/touchInput.test.ts
git commit -m "feat(input): pure hardenTouchInput util (touch-action ownership)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Document-level touch-action CSS + wire canvas

**Files:**
- Modify: `index.html` (the `<style>` block)
- Modify: `src/main.ts` (the `READY` handler region)

- [ ] **Step 1: Add CSS rules to `index.html`**

In the `<style>` block, change the `html, body` rule and add a `#game canvas`
rule. The existing rule is:

```css
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0d0f14;
        overflow: hidden;
        height: 100%;
        font-family: system-ui, sans-serif;
      }
```

Replace it with (adds two declarations) and add the canvas rule right after the
existing `#game { ... }` rule:

```css
      html,
      body {
        margin: 0;
        padding: 0;
        background: #0d0f14;
        overflow: hidden;
        height: 100%;
        font-family: system-ui, sans-serif;
        /* The game canvas owns all touch gestures — no native scroll/pinch/
           double-tap-zoom or pull-to-refresh bounce underneath it. */
        touch-action: none;
        overscroll-behavior: none;
      }
```

And after the existing `#game { ... }` block, add:

```css
      #game,
      #game canvas {
        touch-action: none;
        overscroll-behavior: none;
      }
```

- [ ] **Step 2: Wire `hardenTouchInput` into `main.ts`**

`main.ts` already imports Phaser and has a `game.events.once(Phaser.Core.Events.READY, ...)`
block (the scene-breadcrumb wiring). Add a separate `READY` listener that hardens
the canvas. Add this import near the other `./core/...` imports:

```ts
import { hardenTouchInput } from "./core/touchInput.ts";
```

Then add this block immediately after `installMobileLandscape(game);`:

```ts
// Mobile web: the canvas owns every touch gesture. Phaser creates the canvas
// during boot, so harden it once it exists (CSS in index.html is the static
// belt; this is the braces for however the canvas was created).
game.events.once(Phaser.Core.Events.READY, () => {
  if (game.canvas) hardenTouchInput(game.canvas);
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add index.html src/main.ts
git commit -m "feat(input): declare touch-action ownership on canvas + document

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Pure `pinchUpdate` reducer

**Files:**
- Modify: `src/core/gesture.ts` (append)
- Test: `tests/gesture.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/gesture.test.ts` (add `pinchUpdate` and `PinchSample` to the
existing `../src/core/gesture.ts` import at the top of the file):

```ts
describe("pinchUpdate", () => {
  it("zoom factor is the ratio of finger distances", () => {
    const r = pinchUpdate({ dist: 100, cx: 0, cy: 0 }, { dist: 150, cx: 0, cy: 0 });
    expect(r.zoomFactor).toBeCloseTo(1.5, 5);
  });

  it("zoom factor is 1 on the first frame (prev.dist <= 0)", () => {
    const r = pinchUpdate({ dist: 0, cx: 10, cy: 10 }, { dist: 120, cx: 10, cy: 10 });
    expect(r.zoomFactor).toBe(1);
  });

  it("pan delta is the midpoint translation", () => {
    const r = pinchUpdate({ dist: 100, cx: 200, cy: 300 }, { dist: 100, cx: 230, cy: 280 });
    expect(r.panDx).toBe(30);
    expect(r.panDy).toBe(-20);
  });

  it("identical samples produce no zoom and no pan", () => {
    const s = { dist: 90, cx: 50, cy: 60 };
    const r = pinchUpdate(s, { ...s });
    expect(r.zoomFactor).toBe(1);
    expect(r.panDx).toBe(0);
    expect(r.panDy).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gesture.test.ts`
Expected: FAIL — `pinchUpdate is not defined`.

- [ ] **Step 3: Append the implementation to `gesture.ts`**

```ts
/** A two-finger pinch sample: finger distance + midpoint (screen px). */
export interface PinchSample {
  dist: number;
  cx: number;
  cy: number;
}

/** Per-frame pinch delta: multiplicative zoom factor + midpoint translation
 *  (screen px). zoomFactor is 1 when prev.dist is 0/invalid (the first frame of
 *  a pinch — establish the baseline, don't jump). */
export function pinchUpdate(
  prev: PinchSample,
  cur: PinchSample,
): { zoomFactor: number; panDx: number; panDy: number } {
  const zoomFactor = prev.dist > 0 ? cur.dist / prev.dist : 1;
  return { zoomFactor, panDx: cur.cx - prev.cx, panDy: cur.cy - prev.cy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gesture.test.ts`
Expected: PASS (existing tests + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/core/gesture.ts tests/gesture.test.ts
git commit -m "feat(gesture): pure pinchUpdate (zoom factor + midpoint pan delta)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire pinch-pan into `battleCamera.handleMove`

**Files:**
- Modify: `src/scenes/battleCamera.ts`

Context — the current two-finger branch (around the `if (p1?.isDown && p2?.isDown)`
block in `handleMove`) zooms around the midpoint but does NOT pan. There are
fields `pinching: boolean`, `pinchDist: number`. We add midpoint fields and pan.

- [ ] **Step 1: Update the import**

Change the existing gesture import line to add `pinchUpdate` and the type:

```ts
import { TAP_SLOP_PX, isDoubleTap, pinchUpdate, type TapPoint } from "../core/gesture.ts";
```

- [ ] **Step 2: Add midpoint fields**

Next to `private pinchDist = 0;` add:

```ts
  private pinchMx = 0;
  private pinchMy = 0;
```

- [ ] **Step 3: Replace the two-finger branch body**

Find this block in `handleMove`:

```ts
    // Two fingers down → pinch zoom around their midpoint.
    if (p1?.isDown && p2?.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const mx = (p1.x + p2.x) / 2,
        my = (p1.y + p2.y) / 2;
      if (this.pinching && this.pinchDist > 0) this.zoomToward(dist / this.pinchDist, mx, my);
      this.pinchDist = dist;
      this.pinching = true;
      this.panning = false;
      return;
    }
```

Replace it with (adds midpoint pan via `pinchUpdate`):

```ts
    // Two fingers down → pinch to zoom around the midpoint AND pan by the
    // midpoint translation (grab-and-move-the-battlefield, the natural mobile
    // navigation gesture). The first frame just seeds the baseline.
    if (p1?.isDown && p2?.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const mx = (p1.x + p2.x) / 2,
        my = (p1.y + p2.y) / 2;
      if (this.pinching && this.pinchDist > 0) {
        const { zoomFactor, panDx, panDy } = pinchUpdate(
          { dist: this.pinchDist, cx: this.pinchMx, cy: this.pinchMy },
          { dist, cx: mx, cy: my },
        );
        this.zoomToward(zoomFactor, mx, my);
        if (panDx !== 0 || panDy !== 0) {
          this.cam.setScroll(
            this.cam.scrollX - panDx / this.cam.zoom,
            this.cam.scrollY - panDy / this.cam.zoom,
          );
          this.consumedGesture = true;
        }
      }
      this.pinchDist = dist;
      this.pinchMx = mx;
      this.pinchMy = my;
      this.pinching = true;
      this.panning = false;
      return;
    }
```

- [ ] **Step 4: Reset midpoint on pinch end**

In `onUp` (the arrow assigned to `this.onUp`), it currently does:

```ts
    this.onUp = () => {
      this.panning = false;
      this.pinching = false;
      this.pinchDist = 0;
    };
```

Leave the existing lines and add the midpoint reset:

```ts
    this.onUp = () => {
      this.panning = false;
      this.pinching = false;
      this.pinchDist = 0;
      this.pinchMx = 0;
      this.pinchMy = 0;
    };
```

Also, just below the two-finger branch the code clears single-finger pinch state
with `this.pinching = false; this.pinchDist = 0;` — add `this.pinchMx = 0; this.pinchMy = 0;`
there too so a lifted finger fully resets the baseline:

```ts
    this.pinching = false;
    this.pinchDist = 0;
    this.pinchMx = 0;
    this.pinchMy = 0;
```

- [ ] **Step 5: Typecheck + lint the file**

Run: `npx tsc --noEmit && npx eslint src/scenes/battleCamera.ts`
Expected: no errors; file well under 500 lines.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/battleCamera.ts
git commit -m "feat(camera): two-finger pinch-pan (drag the battlefield while zooming)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Enlarge ＋/− zoom buttons to a 44px hit area

**Files:**
- Modify: `src/scenes/battleSceneInput.ts` (the `addZoomButtons` method)

Context — current `addZoomButtons` builds each button as `crispText(...)` at 22px
with `setPadding(9, 3, 9, 5)` (~40×30px), placed at `height-150` and `height-110`
(40px apart, so the hit rects nearly touch). We give each an explicit ≥44×44 hit
area and widen the spacing.

- [ ] **Step 1: Replace the `addZoomButtons` body**

Replace the existing method with this version (explicit hit area + spacing; keeps
the HUD layer, the visuals, and the `zoomStep` wiring):

```ts
  /** ＋ / − zoom buttons on the left edge (HUD camera; fixed while the view pans).
   *  Each gets a ≥44×44px hit area (Apple/Material touch-target minimum) and the
   *  two are spaced so their hit rects don't overlap. */
  addZoomButtons(this: BattleScene): void {
    const HIT = 44; // px — touch-target minimum
    const mk = (y: number, label: string, onTap: () => void) => {
      const b = crispText(this, 14, y, label, {
        fontSize: "22px",
        color: "#fff",
        backgroundColor: "#243a5a",
        fontStyle: "bold",
      })
        .setOrigin(0, 0.5)
        .setPadding(9, 3, 9, 5)
        .setDepth(50);
      // Explicit hit rect at least 44×44, centred on the glyph, regardless of
      // the (smaller) rendered text bounds.
      const w = Math.max(HIT, b.width);
      const h = Math.max(HIT, b.height);
      b.setInteractive(
        new Phaser.Geom.Rectangle(-(w - b.width) / 2, b.height / 2 - h / 2, w, h),
        Phaser.Geom.Rectangle.Contains,
      );
      b.input!.cursor = "pointer";
      b.on("pointerdown", onTap);
      this.ui.add(b);
    };
    // 54px apart so two 44px hit rects never overlap.
    mk(this.scale.height - 164, "+", () => this.camCtl?.zoomStep(true));
    mk(this.scale.height - 110, "−", () => this.camCtl?.zoomStep(false));
  },
```

- [ ] **Step 2: Ensure `Phaser` is imported in the file**

`battleSceneInput.ts` must reference `Phaser.Geom.Rectangle`. Check the top of
the file:

Run: `grep -n "^import .*[Pp]haser" src/scenes/battleSceneInput.ts`
Expected: a line like `import Phaser from "phaser";` or `import type Phaser ...`.

If the existing import is `import type Phaser from "phaser";` (type-only), change
it to a value import, because `Phaser.Geom.Rectangle` is used at runtime:

```ts
import Phaser from "phaser";
```

If a value `import Phaser from "phaser";` already exists, leave it.

- [ ] **Step 3: Typecheck + lint the file**

Run: `npx tsc --noEmit && npx eslint src/scenes/battleSceneInput.ts`
Expected: no errors; file stays under 500 lines.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/battleSceneInput.ts
git commit -m "feat(battle): zoom buttons get a 44px touch-target hit area + spacing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Real-pointer pinch-pan playtest + full verify

**Files:**
- Modify: `scripts/playtest/repro_input.mjs`

- [ ] **Step 1: Add a two-finger pinch helper + a pinch-pan test**

In `repro_input.mjs`, inside the in-page setup `evalJs` block (where `__drag` and
`__tap` are defined), add a `__pinch` helper that drives two pointers. Add it
right after the `window.__tap = ...` line, before the `return 'helpers-ready...'`:

```js
    window.__pinch = async (cx, cy, gap0, gap1, mvx=0, mvy=0, steps=8)=>{
      // Two fingers symmetric about (cx,cy), gap0 -> gap1 apart, midpoint sliding
      // by (mvx,mvy). pointerId 1 and 2.
      const fire2 = (type, id, gx, gy)=>{
        const p = pt(gx,gy);
        cv.dispatchEvent(new PointerEvent(type, {pointerId:id, pointerType:'touch', isPrimary:id===1, button:0, buttons: type==='pointerup'?0:1, clientX:p.clientX, clientY:p.clientY, bubbles:true, cancelable:true}));
      };
      fire2('pointerdown',1, cx-gap0/2, cy); fire2('pointerdown',2, cx+gap0/2, cy);
      await new Promise(r=>setTimeout(r,40));
      for(let i=1;i<=steps;i++){ const f=i/steps; const g=gap0+(gap1-gap0)*f; const ox=cx+mvx*f, oy=cy+mvy*f;
        fire2('pointermove',1, ox-g/2, oy); fire2('pointermove',2, ox+g/2, oy);
        await new Promise(r=>setTimeout(r,25)); }
      fire2('pointerup',1, cx+mvx-gap1/2, cy+mvy); fire2('pointerup',2, cx+mvx+gap1/2, cy+mvy);
      await new Promise(r=>setTimeout(r,40));
    };
```

- [ ] **Step 2: Add the test near the end (before the screenshot capture)**

Insert after the existing `T7 double-tap-zoom` console block:

```js
  // TEST 8: two-finger pinch zooms AND pans by the midpoint; the document never
  // scrolls under a canvas gesture (touch-action ownership).
  console.log(
    "T8 pinch-pan:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.camCtl.reset();
    const c=bs.cameras.main; const z0=c.zoom, sx0=c.scrollX, sy0=c.scrollY;
    await window.__pinch(480,300, 120, 220, 80, 0, 10);
    return JSON.stringify({dZoom:+(c.zoom-z0).toFixed(3), dScroll:+(Math.abs(c.scrollX-sx0)+Math.abs(c.scrollY-sy0)).toFixed(2), pageScroll:window.scrollY, touchAction:getComputedStyle(document.querySelector('#game canvas')||document.querySelector('canvas')).touchAction});`),
  );
```

- [ ] **Step 3: Run the full verification suite**

Run each and confirm:

```bash
npx tsc --noEmit
npx eslint .
npm run lint:cycles
npx vitest run
npx vite build
```

Expected: tsc clean; eslint 0 errors (pre-existing `any` warnings OK); 0 cycles;
all tests pass except the known pre-existing `firebaseCachePolicy` failure; build OK.

- [ ] **Step 4: Real-pointer playtest**

Build is already done in Step 3. Serve `dist/` and run the repro (per the
established harness — `python3 -m http.server 4188 --bind 127.0.0.1` for the
static server, headless Chrome with `--remote-allow-origins=*` on port 9222 as a
background task, warm-up run, then the real run):

```bash
node scripts/playtest/repro_input.mjs --port=4188
```

Expected (T8): `dZoom > 0` (pinch grew the view), `dScroll > 0` (midpoint pan
moved the camera), `pageScroll: 0` (no document scroll), `touchAction: "none"`.
T1–T7 still green.

- [ ] **Step 5: Commit**

```bash
git add scripts/playtest/repro_input.mjs
git commit -m "test(playtest): real-pointer pinch-pan + touch-action ownership check

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Update memory + final report

**Files:**
- Modify: `~/.claude/projects/.../memory/project_gesture_feel.md` (append a mobile-hardening note)
- Modify: `~/.claude/projects/.../memory/MEMORY.md` (no new line needed — same memory)

- [ ] **Step 1: Append a section to `project_gesture_feel.md`**

Record: the mobile-web hardening — `touch-action:none` + `overscroll-behavior:none`
ownership (pure `core/touchInput.ts` + index.html CSS + `main.ts` READY wiring);
two-finger pinch-pan (pure `pinchUpdate` in gesture.ts wired into battleCamera);
44px zoom-button hit areas. Note Phaser sets `input.touch.capture=true` but does
NOT set `touch-action` itself, so we must. Spec/plan paths.

- [ ] **Step 2: Confirm the working tree is clean of protected files**

Run: `git status --porcelain`
Expected: only the pre-existing protected dirty files remain unstaged (tower
sprite .json/.png pairs, `src/core/gacha.ts`, `src/data/spriteManifest.ts`,
`scripts/sdart/*`, the `.claude/scheduled_tasks.lock` deletion). None of them
were touched by this work.

- [ ] **Step 3: Deliver the completion report** (root cause, the fix, verification
  evidence; note NOT deployed — awaiting user confirmation).

---

## Self-Review

**Spec coverage:**
- Milestone 1 (gesture ownership) → Tasks 1 + 2. ✓
- Milestone 2 (pinch-pan) → Tasks 3 + 4. ✓
- Milestone 3 (touch targets) → Task 5. ✓
- Milestone 4 (verify + playtest + commit) → Task 6 (+ per-task commits throughout). ✓
- Memory update (session convention) → Task 7. ✓
- Findings 2/5/6 (already satisfied) → no task, as the spec states. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have
expected output. ✓

**Type consistency:** `hardenTouchInput(el: StyleHost)` used identically in Task 1
(def) and Task 2 (call on `game.canvas`). `pinchUpdate(prev, cur)` signature +
`PinchSample {dist,cx,cy}` identical across Task 3 (def), Task 4 (call). Camera
fields `pinchDist`/`pinchMx`/`pinchMy` consistent. `zoomStep` unchanged. ✓
