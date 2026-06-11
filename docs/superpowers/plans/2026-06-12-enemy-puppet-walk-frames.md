# Lively Enemies — Procedural Puppet-Walk Frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make enemies read as walking/flying (not floating) by synthesizing a 4-frame silhouette-changing walk cycle from each enemy's existing single SDXL sprite — no diffusion, no new deps.

**Architecture:** A pure, unit-tested warp module (`enemyWalkWarp.ts`) defines how each horizontal band of a sprite is displaced at a given cycle phase (alternating-leg counter-shear for walkers, wing-beat for flyers). A preload-time canvas baker (`enemyWalkBake.ts`) applies it to each loaded `enemy__<id>` texture, producing a 4-frame `CanvasTexture` and a `_walk` anim. `animateEnemy` then plays that anim (coupling its rate to travel) and damps the now-redundant whole-body bob.

**Tech Stack:** TypeScript, Phaser 3 (CanvasTexture / anims), Vitest.

---

### Task 1: Pure warp module `enemyWalkWarp.ts` (TDD)

**Files:**
- Create: `src/scenes/enemyWalkWarp.ts`
- Test: `tests/enemyWalkWarp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/enemyWalkWarp.test.ts
import { describe, it, expect } from "vitest";
import { bandWarp } from "../src/scenes/enemyWalkWarp.ts";

const HALF_PI = Math.PI / 2;

describe("bandWarp — walk", () => {
  it("alternates legs: left and right feet shear opposite directions mid-stride", () => {
    const l = bandWarp("walk", 1, -1, HALF_PI);
    const r = bandWarp("walk", 1, 1, HALF_PI);
    expect(Math.sign(l.dx)).toBe(-Math.sign(r.dx));
    expect(l.dx).not.toBe(0);
  });

  it("leg swing grows from waist (~0) to feet (max)", () => {
    const waist = Math.abs(bandWarp("walk", 0.5, 1, HALF_PI).dx);
    const knee = Math.abs(bandWarp("walk", 0.75, 1, HALF_PI).dx);
    const feet = Math.abs(bandWarp("walk", 1, 1, HALF_PI).dx);
    expect(waist).toBeLessThan(knee);
    expect(knee).toBeLessThan(feet);
    expect(waist).toBeCloseTo(0, 5);
  });

  it("neutral contact at phase 0 (no horizontal leg offset)", () => {
    expect(bandWarp("walk", 1, -1, 0).dx).toBeCloseTo(0, 6);
    expect(bandWarp("walk", 1, 1, 0).dx).toBeCloseTo(0, 6);
  });

  it("contact bob lifts the body (dy <= 0) and peaks at the passing phase", () => {
    const contact = bandWarp("walk", 0.2, 1, 0).dy;        // foot planted
    const passing = bandWarp("walk", 0.2, 1, HALF_PI).dy;  // mid-swing
    expect(passing).toBeLessThanOrEqual(0);
    expect(passing).toBeLessThan(contact);
  });

  it("all walk outputs finite over a full cycle", () => {
    for (let p = 0; p <= Math.PI * 2; p += 0.3)
      for (const y of [0, 0.25, 0.5, 0.75, 1])
        for (const s of [-1, 1] as const) {
          const w = bandWarp("walk", y, s, p);
          expect(Number.isFinite(w.dx)).toBe(true);
          expect(Number.isFinite(w.dy)).toBe(true);
        }
  });
});

describe("bandWarp — flap", () => {
  it("no horizontal shear; wings oscillate vertically with phase", () => {
    expect(bandWarp("flap", 0.2, 1, HALF_PI).dx).toBe(0);
    const up = bandWarp("flap", 0.2, 1, HALF_PI).dy;
    const down = bandWarp("flap", 0.2, 1, -HALF_PI).dy;
    expect(up).not.toBeCloseTo(down, 3);
  });

  it("all flap outputs finite over a full cycle", () => {
    for (let p = 0; p <= Math.PI * 2; p += 0.3)
      for (const y of [0, 0.25, 0.5, 0.75, 1]) {
        const w = bandWarp("flap", y, 1, p);
        expect(Number.isFinite(w.dx)).toBe(true);
        expect(Number.isFinite(w.dy)).toBe(true);
      }
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run tests/enemyWalkWarp.test.ts`
Expected: FAIL — `bandWarp` is not exported / module not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/scenes/enemyWalkWarp.ts
// Pure (Phaser-free) walk/flap warp math. One source of truth for how a
// horizontal band of an enemy sprite is displaced at a cycle phase, shared by
// the unit test and the preload canvas baker (enemyWalkBake.ts). Synthesizes a
// real, silhouette-changing gait from a single static sprite — no diffusion.

export type MotionProfile = "walk" | "flap";

export interface BandWarp {
  /** Horizontal pixel offset for this band. */
  dx: number;
  /** Vertical pixel offset for this band (<=0 lifts the body). */
  dy: number;
}

export interface WarpOpts {
  /** Max foot shear in px (alternating legs). Default 9. */
  legSwing?: number;
  /** Body lift between footfalls, px. Default 4. */
  bob?: number;
  /** Wing-beat travel for flyers, px. Default 7. */
  flap?: number;
}

const WAIST = 0.5; // yNorm above which there are no legs

/** Ramp 0 at the waist → 1 at the feet (clamped). */
function legWeight(yNorm: number): number {
  if (yNorm <= WAIST) return 0;
  return (yNorm - WAIST) / (1 - WAIST);
}

/**
 * Per-band displacement for one cycle phase.
 * @param yNorm 0 = top, 1 = feet/bottom.
 * @param side  -1 = left half of the sprite, +1 = right half (walk only).
 * @param phase 0..2π around the gait cycle (0 = foot-plant/contact).
 */
export function bandWarp(
  profile: MotionProfile,
  yNorm: number,
  side: -1 | 1,
  phase: number,
  opts: WarpOpts = {},
): BandWarp {
  const s = Math.sin(phase);
  if (profile === "flap") {
    const flap = opts.flap ?? 7;
    // wings = upper body; weight ramps from mid-line upward
    const w = yNorm >= 0.5 ? 0 : (0.5 - yNorm) / 0.5;
    return { dx: 0, dy: -flap * w * s };
  }
  const legSwing = opts.legSwing ?? 9;
  const bob = opts.bob ?? 4;
  const lw = legWeight(yNorm);
  // legs: opposite shear per side (alternating step); torso: gentle counter-lead
  const dx = lw > 0
    ? side * legSwing * lw * s
    : -0.25 * legSwing * s;
  // body lifts between footfalls (peaks mid-swing, |sin|)
  const dy = -bob * Math.abs(s);
  return { dx, dy };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/enemyWalkWarp.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/enemyWalkWarp.ts tests/enemyWalkWarp.test.ts
git commit -m "feat: pure alternating-leg / wing-beat warp math (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Canvas baker `enemyWalkBake.ts`

**Files:**
- Create: `src/scenes/enemyWalkBake.ts`
- Reference (read for the flyer flag): `src/data/enemies.ts` (`ENEMIES`, each has `id`, `flying`)
- Reference (texture key convention): `src/scenes/battleSceneSprites.ts` (`enemy__<id>`), `src/scenes/PreloadScene.ts` (anim creation pattern, lines ~74-93)

This task has no unit test (it is a thin Phaser-canvas wrapper around the tested
`bandWarp`); it is verified by `tsc`, by Task 4's whole-suite run, and the playtest.

- [ ] **Step 1: Write the baker**

```ts
// src/scenes/enemyWalkBake.ts
// Preload-time synthesis of a 4-frame walk/flap cycle for every enemy, baked from
// its single loaded SDXL sprite by warping horizontal bands (see enemyWalkWarp.ts).
// Produces a CanvasTexture under the same `enemy__<id>` key + a `<key>_walk` anim,
// so the existing data-driven runtime (animateEnemy) plays it with no further wiring.
import Phaser from "phaser";
import { ENEMIES } from "../data/enemies.ts";
import { bandWarp, type MotionProfile } from "./enemyWalkWarp.ts";

const FRAMES = 4;     // 4-frame loop: contact-L → passing → contact-R → passing
const BANDS = 24;     // horizontal slices per frame (quality/perf knob)

const FLYERS = new Set(ENEMIES.filter((e) => e.flying).map((e) => e.id));

/** Bake walk/flap frames for one enemy id. Idempotent (skips if anim exists). */
function bakeOne(scene: Phaser.Scene, id: string): void {
  const key = `enemy__${id}`;
  if (!scene.textures.exists(key)) return;
  if (scene.anims.exists(`${key}_walk`)) return; // already baked (re-entry safe)

  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width, h = src.height;
  if (!w || !h) return;

  const profile: MotionProfile = FLYERS.has(id) ? "flap" : "walk";
  const cx = w / 2;

  const canvasTex = scene.textures.createCanvas(`${key}__bakeTmp`, w * FRAMES, h);
  if (!canvasTex) return;
  const ctx = canvasTex.getContext();

  for (let f = 0; f < FRAMES; f++) {
    const phase = (f / FRAMES) * Math.PI * 2;
    const baseX = f * w;
    for (let b = 0; b < BANDS; b++) {
      const sy = Math.floor((b / BANDS) * h);
      const sh = Math.ceil(h / BANDS) + 1;          // +1px overlap hides seams
      const yNorm = (sy + sh / 2) / h;
      // left and right halves shear oppositely (alternating legs)
      for (const side of [-1, 1] as const) {
        const sx = side < 0 ? 0 : Math.floor(cx);
        const sw = side < 0 ? Math.ceil(cx) : w - Math.floor(cx);
        const { dx, dy } = bandWarp(profile, yNorm, side, phase);
        ctx.drawImage(src as CanvasImageSource,
          sx, sy, sw, sh,
          baseX + sx + dx, sy + dy, sw, sh);
      }
    }
  }
  canvasTex.refresh();

  // Re-key as enemy__<id> with FRAMES grid frames named walk1..walkN.
  scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvasTex.getCanvas())!;
  for (let f = 0; f < FRAMES; f++) tex.add(`walk${f + 1}`, 0, f * w, 0, w, h);
  scene.textures.remove(`${key}__bakeTmp`);

  scene.anims.create({
    key: `${key}_walk`,
    frames: Array.from({ length: FRAMES }, (_, f) => ({ key, frame: `walk${f + 1}` })),
    frameRate: 7,
    repeat: -1,
  });
}

/** Bake every enemy's walk cycle. Call once from PreloadScene.create(). */
export function bakeEnemyWalks(scene: Phaser.Scene): void {
  for (const e of ENEMIES) bakeOne(scene, e.id);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `createCanvas`/`addCanvas` nullability or `getSourceImage`
typing complains, narrow with the guards already present; do not use `any` casts
beyond the `CanvasImageSource`/source-image casts shown.)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/enemyWalkBake.ts
git commit -m "feat: preload canvas baker — 4-frame enemy walk from one sprite

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire the baker into PreloadScene

**Files:**
- Modify: `src/scenes/PreloadScene.ts` (`create()`, after the manifest anim-build loop, before `this.scene.start("MainMenuScene")`)

- [ ] **Step 1: Add the import**

At the top of `src/scenes/PreloadScene.ts`, with the other scene imports:

```ts
import { bakeEnemyWalks } from "./enemyWalkBake.ts";
```

- [ ] **Step 2: Call the baker in `create()`**

In `create()`, immediately before `this.scene.start("MainMenuScene");`:

```ts
    bakeEnemyWalks(this); // synthesize 4-frame walk/flap cycles from each enemy sprite
    this.scene.start("MainMenuScene");
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/PreloadScene.ts
git commit -m "feat: bake enemy walk cycles at preload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Couple playback to travel + damp the redundant body-bob

**Files:**
- Modify: `src/scenes/battleSceneSprites.ts` (`animateEnemy`, lines ~210-248)
- Modify: `src/scenes/enemyWalkTransform.ts` (reduce `BOB`/`ROCK` when frames carry the step)

**Context:** With baked `_walk` frames now carrying the leg motion, the existing
whole-body bob/rock in `enemyWalkTransform` double-bobs. We keep the ground-coupled
gait *phase* (it drives the shadow lift + the new playback rate) and the lean, but
cut the vertical bob and rock so the body no longer hops on top of the frame motion.
The frozen / flying / hurt branches are unchanged.

- [ ] **Step 1: Reduce bob/rock amplitudes in `enemyWalkTransform.ts`**

Change the gait constants (top of `src/scenes/enemyWalkTransform.ts`) so the
procedural layer only adds subtle weight-shift, letting the baked frames carry the
step:

```ts
const BOB = 1.5;     // was 5 — frames now carry the vertical step; keep a faint settle
const WADDLE = 1.5;  // lateral sway (px) — unchanged
const ROCK = 1.5;    // was 4 — frames carry the body motion; keep a faint rock
const SQUASH = 0.06; // was 0.12 — lighter contact squash over the frame motion
const STRETCH = 0.04; // was 0.08
```

- [ ] **Step 2: Couple the walk anim's playback rate to travel in `animateEnemy`**

In `src/scenes/battleSceneSprites.ts`, the ground branch already computes `moved`
and the gait. Find the existing walk-anim block (≈ lines 210-217):

```ts
    if (this.anims.exists(`${key}_walk`)) {
      const cur = s.anims.currentAnim?.key;
      const inOneShot = s.anims.isPlaying &&
        (cur === `${key}_attack` || cur === `${key}_skill` || cur === `${key}_hurt`);
      if (!inOneShot) {
        if (frozen) { if (s.anims.isPlaying) s.anims.pause(); }
        else if (cur !== `${key}_walk` || !s.anims.isPlaying) s.play(`${key}_walk`);
      }
    }
```

Replace it with a version that also scales `timeScale` by recent travel (so a
slowed enemy steps slower and a fast one "runs"):

```ts
    if (this.anims.exists(`${key}_walk`)) {
      const cur = s.anims.currentAnim?.key;
      const inOneShot = s.anims.isPlaying &&
        (cur === `${key}_attack` || cur === `${key}_skill` || cur === `${key}_hurt`);
      if (!inOneShot) {
        if (frozen) { if (s.anims.isPlaying) s.anims.pause(); }
        else {
          if (cur !== `${key}_walk` || !s.anims.isPlaying) s.play(`${key}_walk`);
          // couple step cadence to actual ground speed: ~1x at a brisk walk,
          // slower when slowed, up to ~1.8x for fast "runners".
          const spd = (s.getData("recentMoved") as number) ?? 0;
          s.anims.timeScale = Math.max(0.35, Math.min(1.8, spd / 3));
        }
      }
    }
```

- [ ] **Step 3: Record `recentMoved` near the existing `moved` calc**

Still in `animateEnemy`, just after `moved` is computed and `lastPosX/Y` are
stored (≈ line 225 `s.setData("lastPosX", px); s.setData("lastPosY", py);`), add a
smoothed travel sample so Step 2's `timeScale` has a stable signal:

```ts
    const prevMoved = (s.getData("recentMoved") as number) ?? moved;
    s.setData("recentMoved", prevMoved * 0.8 + moved * 0.2);
```

- [ ] **Step 4: Run the existing gait test + typecheck**

Run: `npx vitest run tests/enemy-walk-transform.test.ts && npx tsc --noEmit`
Expected: gait test PASS (it asserts bob is bounded / inverse squash, which still
holds at lower amplitudes — if any assertion hard-codes the old `5`/`4`/`0.12`
magnitudes, update that assertion to the new bound, keeping the *relationship*
checks intact), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleSceneSprites.ts src/scenes/enemyWalkTransform.ts tests/enemy-walk-transform.test.ts
git commit -m "feat: play baked walk frames (rate ~ travel); damp redundant body-bob

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify whole + playtest

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests green.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `tsc --noEmit` clean, `vite build` succeeds, `dist/` emitted.

- [ ] **Step 3: Playtest (CDP, `window.__game`)**

Launch the dev server, drive a battle via `window.__game`, and confirm:
- enemies spawn in the existing SDXL art style;
- they show a **visible alternating-leg step** (the silhouette changes frame to
  frame), not a rigid sliding picture;
- a slowed enemy steps slower; fast enemies step faster;
- flyers (`gargoyle`, `stormflyer`) beat their wings;
- enemies take hits and die with **no console errors**;
- re-enter the battle scene (scene re-entry reset rule) — no crash, no double-bake
  (the baker is idempotent on the `_walk` anim).

If the step looks too subtle or torn, tune `legSwing` / `bob` / `BANDS` / `FRAMES`
(single constants) and re-playtest. Capture a before/after frame if helpful.

- [ ] **Step 4: Final commit (if any tuning landed)**

```bash
git add -A
git commit -m "chore: tune enemy walk amplitudes after playtest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Spec coverage:** A→Task 1/2 (warp + bake), B→Task 2/3 (baker + preload wiring),
  C→Task 4 (runtime play + damp), D (manifest unchanged) → no task needed (on-disk
  PNGs/manifest stay single-frame by design), Testing→Task 1 (unit) + Task 5
  (regression + playtest). Covered.
- **Type consistency:** `bandWarp(profile, yNorm, side, phase, opts?)` and
  `MotionProfile`/`BandWarp` are used identically in Tasks 1 and 2; texture key
  `enemy__<id>` and anim key `${key}_walk` match `battleSceneSprites.ts`.
- **No placeholders:** every code step shows complete code.
