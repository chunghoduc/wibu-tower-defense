# Loading Screen Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat loading screen with a procedural painted tower-defense skyline (dusk sky, parallax hills, glowing tower silhouettes, drifting embers) drawn behind the existing progress bar.

**Architecture:** Pure Phaser-free geometry module (`src/core/loadingBackdrop.ts`, unit-tested) computes hills/towers/embers from canvas size; a thin presenter (`src/scenes/loadingBackdropFx.ts`) paints it with `Graphics` and animates embers; `PreloadScene` creates it behind the bar and destroys it on load complete. No textures used (none are loaded yet at preload start), no new art, no ASSET_VERSION bump.

**Tech Stack:** TypeScript (strict, ESM `.ts` specifiers), Phaser 3, Vitest.

---

### Task 1: Pure loading-backdrop geometry module (TDD)

**Files:**
- Create: `src/core/loadingBackdrop.ts`
- Test: `tests/loadingBackdrop.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/loadingBackdrop.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  loadingHills,
  loadingTowers,
  loadingEmbers,
  emberAt,
} from "../src/core/loadingBackdrop.ts";

const W = 960;
const H = 540;

describe("loadingHills", () => {
  it("returns at least two bands ordered back -> front by depth", () => {
    const bands = loadingHills(W, H);
    expect(bands.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].depth).toBeGreaterThan(bands[i - 1].depth);
    }
  });

  it("each band spans the full width and anchors to the bottom", () => {
    for (const b of loadingHills(W, H)) {
      const xs = b.points.map((p) => p.x);
      expect(Math.min(...xs)).toBeLessThanOrEqual(0);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(W);
      // closed shape touches the bottom edge
      expect(b.points.some((p) => p.y >= H)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(loadingHills(W, H)).toEqual(loadingHills(W, H));
  });
});

describe("loadingTowers", () => {
  it("returns 5-8 silhouettes ordered left -> right within bounds", () => {
    const towers = loadingTowers(W, H);
    expect(towers.length).toBeGreaterThanOrEqual(5);
    expect(towers.length).toBeLessThanOrEqual(8);
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      expect(t.x - t.width / 2).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width / 2).toBeLessThanOrEqual(W);
      if (i > 0) expect(t.x).toBeGreaterThan(towers[i - 1].x);
    }
  });

  it("varies tower heights (not all equal) and keeps them above their base", () => {
    const towers = loadingTowers(W, H);
    const heights = new Set(towers.map((t) => Math.round(t.height)));
    expect(heights.size).toBeGreaterThan(1);
    for (const t of towers) {
      expect(t.height).toBeGreaterThan(0);
      expect(t.baseY).toBeLessThanOrEqual(H);
    }
  });

  it("is deterministic", () => {
    expect(loadingTowers(W, H)).toEqual(loadingTowers(W, H));
  });
});

describe("loadingEmbers", () => {
  it("returns exactly count embers within bounds", () => {
    const embers = loadingEmbers(W, H, 24);
    expect(embers).toHaveLength(24);
    for (const e of embers) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(W);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(H);
      expect(e.r).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    expect(loadingEmbers(W, H, 10)).toEqual(loadingEmbers(W, H, 10));
  });
});

describe("emberAt", () => {
  it("rises over time then wraps back near the bottom", () => {
    const [e] = loadingEmbers(W, H, 1);
    const start = emberAt(e, 0, H);
    const later = emberAt(e, 0.5, H);
    expect(later.y).toBeLessThan(start.y); // rising
    // after a long time it must have wrapped back down (never empties the field)
    const wrapped = emberAt(e, 1000, H);
    expect(wrapped.y).toBeGreaterThan(0);
    expect(wrapped.y).toBeLessThanOrEqual(H);
  });

  it("keeps x within bounds across the sway", () => {
    for (const e of loadingEmbers(W, H, 12)) {
      for (const t of [0, 0.25, 0.5, 1, 2, 5]) {
        const p = emberAt(e, t, H);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(W);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/loadingBackdrop.test.ts`
Expected: FAIL — `loadingHills`/`loadingTowers`/`loadingEmbers`/`emberAt` not exported (module missing).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/loadingBackdrop.ts`:

```ts
/**
 * Pure geometry for the loading-screen backdrop (PreloadScene). No Phaser, no
 * textures — at preload start nothing is loaded yet, so the backdrop is drawn
 * from primitives computed here. Deterministic (index-seeded, no RNG) so the
 * scene is reproducible and testable.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface HillBand {
  points: Vec2[];
  color: number;
  depth: number; // 0 = farthest, 1 = nearest
}

export interface TowerSil {
  x: number;
  baseY: number;
  width: number;
  height: number;
  body: number;
  glow: number;
  depth: number;
}

export interface Ember {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
}

// Deterministic hash -> [0,1). Keeps the scene reproducible without Math.random.
function frac(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

const BACK_HILL = 0x242a44;
const FRONT_HILL = 0x10131f;
const lerpColor = (a: number, b: number, t: number): number => {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
};

/** Parallax hill bands, back (lightest/highest) -> front (darkest/lowest). */
export function loadingHills(width: number, height: number): HillBand[] {
  const BANDS = 3;
  const bands: HillBand[] = [];
  for (let b = 0; b < BANDS; b++) {
    const depth = b / (BANDS - 1); // 0..1
    const baseY = height * (0.62 + depth * 0.16); // nearer bands sit lower
    const amp = 18 + depth * 26;
    const pts: Vec2[] = [];
    const SEG = 8;
    for (let i = 0; i <= SEG; i++) {
      const x = (width * i) / SEG;
      const y = baseY - Math.sin(i * 1.1 + b * 2.3) * amp - frac(b * 31 + i) * 10;
      pts.push({ x, y });
    }
    pts.push({ x: width, y: height });
    pts.push({ x: 0, y: height });
    bands.push({ points: pts, color: lerpColor(BACK_HILL, FRONT_HILL, depth), depth });
  }
  return bands;
}

/** Stylized tower silhouettes standing on the front ridge. */
export function loadingTowers(width: number, height: number): TowerSil[] {
  const COUNT = 6;
  const ridgeY = height * 0.78;
  const margin = width * 0.06;
  const span = width - margin * 2;
  const gap = span / COUNT;
  const palette = [0x1a1f33, 0x171b2c, 0x202744];
  const glows = [0x66ffcc, 0xf0c060, 0x7fd0ff, 0xff7fa8];
  const towers: TowerSil[] = [];
  for (let i = 0; i < COUNT; i++) {
    const seed = frac(i * 17.3);
    const x = margin + gap * (i + 0.5);
    const w = 34 + seed * 26;
    const h = 88 + frac(i * 7.1) * 96;
    towers.push({
      x,
      baseY: ridgeY + (frac(i * 3.7) - 0.5) * 12,
      width: w,
      height: h,
      body: palette[i % palette.length],
      glow: glows[i % glows.length],
      depth: 1,
    });
  }
  return towers;
}

/** Rising ember/mote specs. */
export function loadingEmbers(width: number, height: number, count: number): Ember[] {
  const embers: Ember[] = [];
  for (let i = 0; i < count; i++) {
    embers.push({
      x: frac(i * 1.7) * width,
      y: frac(i * 5.3) * height,
      r: 0.8 + frac(i * 9.1) * 1.8,
      speed: 8 + frac(i * 2.9) * 22,
      drift: 6 + frac(i * 4.4) * 14,
      phase: frac(i * 6.6) * Math.PI * 2,
    });
  }
  return embers;
}

/** Pure per-frame ember position; wraps back to the bottom once it rises off-top. */
export function emberAt(e: Ember, t: number, height: number): Vec2 {
  const travel = (e.y + e.speed * t) % (height + 40);
  const y = height - travel; // rise upward, wrap
  const x = e.x + Math.sin(t * 0.8 + e.phase) * e.drift;
  return { x: Math.max(0, Math.min(height >= 0 ? Infinity : 0, x)) === x ? x : x, y: y < 0 ? y + (height + 40) : y };
}
```

Note: the `emberAt` x-clamp is finalized in Step 3b below — keep this version only long enough to see tests drive the exact clamp. (We will replace the messy expression.)

- [ ] **Step 3b: Clean up `emberAt` (replace the clamp with the real one)**

Replace the `emberAt` body with the clear version:

```ts
export function emberAt(e: Ember, t: number, height: number): Vec2 {
  const span = height + 40;
  let up = (e.y + e.speed * t) % span; // 0..span, monotonically rising
  let y = height - up; // higher t -> smaller y (rises), wraps within [height-span, height]
  if (y < 0) y += span; // keep on-screen: wrap back near the bottom
  const x = e.x + Math.sin(t * 0.8 + e.phase) * e.drift;
  return { x, y };
}
```

The x sway amplitude (`drift` ≤ 14) plus the spawn range can push `x` slightly past
`0` or `width`. The test asserts `0 <= x <= width`, so clamp callers-side is wrong —
instead make spawn x inset by the max drift in `loadingEmbers`:

Change `x: frac(i * 1.7) * width,` to:

```ts
      x: 16 + frac(i * 1.7) * (width - 32),
```

(16 ≥ max drift 14, so the sway never crosses the edge.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/loadingBackdrop.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/loadingBackdrop.ts tests/loadingBackdrop.test.ts
git commit -m "feat(loading): pure loading-backdrop geometry (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Backdrop presenter (`loadingBackdropFx.ts`)

**Files:**
- Create: `src/scenes/loadingBackdropFx.ts`

No unit test — thin Phaser presenter, consistent with other `*Fx.ts` modules.

- [ ] **Step 1: Write the presenter**

Create `src/scenes/loadingBackdropFx.ts`:

```ts
/**
 * Loading-screen backdrop presenter. Paints the pure loadingBackdrop geometry
 * (sky gradient, parallax hills, glowing tower silhouettes) once and animates a
 * drift of embers on update(). No textures — safe before any asset has loaded.
 */
import Phaser from "phaser";
import {
  loadingHills,
  loadingTowers,
  loadingEmbers,
  emberAt,
  type Ember,
} from "../core/loadingBackdrop.ts";

export interface LoadingBackdrop {
  update(timeSec: number): void;
  destroy(): void;
}

export function createLoadingBackdrop(scene: Phaser.Scene): LoadingBackdrop {
  const { width, height } = scene.scale;
  const towers = loadingTowers(width, height);
  const embers: Ember[] = loadingEmbers(width, height, 28);

  // --- static layer (sky + hills + towers), drawn once ---
  const stat = scene.add.graphics();
  stat.setDepth(-20);

  // dusk sky gradient via stacked horizontal bands (top -> horizon)
  const top = 0x0b0d16;
  const horizon = 0x3a2740;
  const BANDS = 24;
  for (let i = 0; i < BANDS; i++) {
    const t = i / (BANDS - 1);
    stat.fillStyle(mix(top, horizon, t), 1);
    stat.fillRect(0, (height * 0.85 * i) / BANDS, width, height * 0.85 / BANDS + 1);
  }
  // ground wash under the horizon
  stat.fillStyle(0x0b0d16, 1);
  stat.fillRect(0, height * 0.85, width, height * 0.15);

  // hills
  for (const b of loadingHills(width, height)) {
    stat.fillStyle(b.color, 1);
    stat.beginPath();
    stat.moveTo(b.points[0].x, b.points[0].y);
    for (let i = 1; i < b.points.length; i++) stat.lineTo(b.points[i].x, b.points[i].y);
    stat.closePath();
    stat.fillPath();
  }

  // tower silhouettes with a lit crystal top
  for (const tw of towers) {
    const left = tw.x - tw.width / 2;
    const topY = tw.baseY - tw.height;
    stat.fillStyle(tw.body, 1);
    // body
    stat.fillRect(left, topY + tw.width * 0.5, tw.width, tw.height - tw.width * 0.5);
    // roof (triangle)
    stat.beginPath();
    stat.moveTo(left - 3, topY + tw.width * 0.5);
    stat.lineTo(tw.x, topY - tw.width * 0.35);
    stat.lineTo(left + tw.width + 3, topY + tw.width * 0.5);
    stat.closePath();
    stat.fillPath();
    // lit window
    stat.fillStyle(tw.glow, 0.9);
    stat.fillRect(tw.x - tw.width * 0.14, topY + tw.height * 0.45, tw.width * 0.28, tw.height * 0.22);
    // crystal glow blob at the apex (additive)
    const blob = scene.add.graphics();
    blob.setDepth(-19);
    blob.fillStyle(tw.glow, 0.18);
    blob.fillCircle(tw.x, topY - tw.width * 0.1, tw.width * 0.7);
    blob.setBlendMode(Phaser.BlendModes.ADD);
    glowBlobs.push(blob);
  }

  // --- ember layer, repainted each update ---
  const fx = scene.add.graphics();
  fx.setDepth(-18);
  fx.setBlendMode(Phaser.BlendModes.ADD);

  return {
    update(timeSec: number) {
      fx.clear();
      for (const e of embers) {
        const p = emberAt(e, timeSec, height);
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(timeSec * 2 + e.phase));
        fx.fillStyle(0xffcf8a, a);
        fx.fillCircle(p.x, p.y, e.r);
      }
    },
    destroy() {
      stat.destroy();
      fx.destroy();
      for (const b of glowBlobs) b.destroy();
    },
  };
}

const glowBlobs: Phaser.GameObjects.Graphics[] = [];

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}
```

Note: `glowBlobs` must be per-call, not module-level (multiple PreloadScene
re-entries would leak). Move it inside `createLoadingBackdrop` as a local `const
glowBlobs: Phaser.GameObjects.Graphics[] = []` declared before the tower loop, and
delete the module-level declaration. (Fixed in Step 2.)

- [ ] **Step 2: Fix glowBlobs scoping**

Edit `src/scenes/loadingBackdropFx.ts`:
- Delete the module-level line `const glowBlobs: Phaser.GameObjects.Graphics[] = [];`.
- Add, immediately after `const embers: Ember[] = loadingEmbers(...)`:

```ts
  const glowBlobs: Phaser.GameObjects.Graphics[] = [];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/loadingBackdropFx.ts
git commit -m "feat(loading): backdrop presenter (sky/hills/towers/embers)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire backdrop into PreloadScene

**Files:**
- Modify: `src/scenes/PreloadScene.ts` (import, create in `_setupLoadingBar`, update tick, destroy on complete)

- [ ] **Step 1: Add the import**

At the top of `src/scenes/PreloadScene.ts`, after the existing scene imports
(e.g. after the `bakeBossWalks` import on line 17), add:

```ts
import { createLoadingBackdrop, type LoadingBackdrop } from "./loadingBackdropFx.ts";
```

- [ ] **Step 2: Create the backdrop behind the bar + drive its update**

In `_setupLoadingBar()`, at the very start of the method body (before
`const { width, height } = this.scale;` — or right after it), create the backdrop
first so it renders behind the track/bar/title, and start an update tick:

```ts
    const backdrop = createLoadingBackdrop(this);
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => backdrop.update(this.time.now / 1000),
    });
```

- [ ] **Step 3: Destroy the backdrop on load complete**

In the existing `this.load.on("complete", () => { ... })` handler, add to the
teardown block (alongside `bar.destroy(); track.destroy(); ...`):

```ts
      tick.remove();
      backdrop.destroy();
```

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run tests/loadingBackdrop.test.ts`
Expected: tsc clean; tests PASS.

- [ ] **Step 5: Lint (file-size + cycles)**

Run: `npx eslint src/core/loadingBackdrop.ts src/scenes/loadingBackdropFx.ts src/scenes/PreloadScene.ts`
Expected: no errors (all three files well under 500 lines).

- [ ] **Step 6: Commit**

```bash
git add src/scenes/PreloadScene.ts
git commit -m "feat(loading): render procedural backdrop behind progress bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify (build + playtest) + document

**Files:**
- Modify: none (verification + memory)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: tsc passes, vite builds, no errors.

- [ ] **Step 2: Playtest the loading screen**

Launch the dev server and capture the loading screen via the CDP self-playtest
(`window.__game`) per the playtest memory. Confirm: gradient sky + hills + glowing
tower silhouettes + drifting embers render behind the gold bar; on completion the
backdrop is removed cleanly and MainMenuScene appears (no leftover Graphics, no
console errors). Save a screenshot to `/tmp/loading-screen.png` and attach it.

- [ ] **Step 3: Update memory**

Add a `project_loading_backdrop.md` memory: PreloadScene now renders a pure
procedural backdrop (`loadingBackdrop.ts` geometry + `loadingBackdropFx.ts`
presenter) drawn with Graphics because no textures are loaded yet at preload start;
destroyed on `load.on("complete")`. Add the index line to `MEMORY.md`.

- [ ] **Step 4: Final commit (if memory/docs changed in-repo only)**

The plan checkboxes can be marked complete; no code changes in this task.
```

