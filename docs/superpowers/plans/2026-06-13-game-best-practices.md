# Game-Engineering Best Practices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production battle sim run on the same fixed 0.05 s timestep the test suite validates, with render interpolation so it stays visually smooth, plus FX-object pooling and hot-loop churn fixes — all strictly behavior-preserving.

**Architecture:** A pure `FixedStepper` accumulator drives `BattleState.tick(0.05)` from `BattleScene.update`; fx events are batched scene-side per frame (fixes the existing fast-forward fx-drop bug); enemy/hero render positions lerp between the pre-step snapshot and current sim state. A `FxPool` (WeakMap-tagged, Phaser-free logic) replaces create/destroy churn inside `VfxDraw` and `ProjectileFx`. Spec: `docs/superpowers/specs/2026-06-13-game-best-practices-design.md`.

**Tech Stack:** Phaser 3 + TypeScript + Vitest. Gates per task: `npm test`, `npm run typecheck`, `npm run lint`, `npm run lint:cycles`, `npm run format:check`.

---

### Task 1: FixedStepper + BattleScene fixed-timestep driver

**Files:**
- Create: `src/core/fixedStep.ts`
- Create: `tests/fixed-step.test.ts`
- Modify: `src/scenes/BattleScene.ts` (fields + `update()`)
- Modify: `src/scenes/battleSceneRender.ts:69` (consume `pendingFx`)

- [ ] **Step 1: Write the failing test** (`tests/fixed-step.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { FixedStepper, SIM_STEP } from "../src/core/fixedStep.ts";

describe("FixedStepper", () => {
  it("emits no step until a full STEP accumulates, then exactly one", () => {
    const s = new FixedStepper();
    expect(s.advance(0.016)).toBe(0);
    expect(s.advance(0.016)).toBe(0);
    expect(s.advance(0.016)).toBe(0); // 0.048 < 0.05
    expect(s.advance(0.016)).toBe(1); // 0.064 → 1 step, 0.014 left
  });

  it("emits multiple steps for a large frame and keeps the remainder as alpha", () => {
    const s = new FixedStepper();
    expect(s.advance(0.12)).toBe(2); // 0.12 → 2 steps + 0.02
    expect(s.alpha).toBeCloseTo(0.02 / SIM_STEP, 10);
  });

  it("alpha stays in [0,1) and grows on stepless frames", () => {
    const s = new FixedStepper();
    s.advance(0.03);
    expect(s.alpha).toBeCloseTo(0.6, 10);
    s.advance(0.01);
    expect(s.alpha).toBeCloseTo(0.8, 10);
  });

  it("caps catch-up at maxSteps and drops the whole-step excess", () => {
    const s = new FixedStepper();
    expect(s.advance(1.0)).toBe(5); // 20 owed → capped at 5
    expect(s.alpha).toBeLessThan(1); // fractional remainder kept, whole excess dropped
    expect(s.advance(0.0)).toBe(0); // no debt carried into the next frame
  });

  it("ignores zero/negative dt (pause = no accumulation)", () => {
    const s = new FixedStepper();
    s.advance(0.04);
    expect(s.advance(0)).toBe(0);
    expect(s.advance(-1)).toBe(0);
    expect(s.alpha).toBeCloseTo(0.8, 10);
  });

  it("reset clears the accumulator", () => {
    const s = new FixedStepper();
    s.advance(0.04);
    s.reset();
    expect(s.alpha).toBe(0);
    expect(s.advance(0.04)).toBe(0);
  });

  it("a 60fps stream at 1x runs sim time ≈ wall time", () => {
    const s = new FixedStepper();
    let steps = 0;
    for (let i = 0; i < 600; i++) steps += s.advance(1 / 60); // 10s of frames
    expect(steps * SIM_STEP).toBeCloseTo(10, 1);
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run tests/fixed-step.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** `src/core/fixedStep.ts`

```ts
/**
 * Fixed-timestep accumulator ("Fix Your Timestep"). The battle sim always ticks
 * in SIM_STEP increments — the SAME discretization the test suite uses — so
 * production behavior is exactly what the tests verify, independent of frame
 * rate. The leftover fraction (`alpha`) lets the renderer interpolate entity
 * positions between the previous and current sim states.
 */
export const SIM_STEP = 0.05; // s — the canonical test-suite tick

export class FixedStepper {
  private acc = 0;

  constructor(
    private readonly step = SIM_STEP,
    /** Catch-up cap per frame; whole-step excess beyond it is dropped (spiral-of-death guard). */
    private readonly maxSteps = 5,
  ) {}

  /** Feed a frame's elapsed seconds (already speed-scaled); returns whole steps to run. */
  advance(dt: number): number {
    if (dt > 0) this.acc += dt;
    const owed = Math.floor(this.acc / this.step);
    const steps = Math.min(owed, this.maxSteps);
    this.acc = steps === this.maxSteps ? this.acc % this.step : this.acc - steps * this.step;
    return steps;
  }

  /** Fraction of a step accumulated but not yet simulated — render interpolation factor [0,1). */
  get alpha(): number {
    return this.acc / this.step;
  }

  reset(): void {
    this.acc = 0;
  }
}
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Wire BattleScene.** In `src/scenes/BattleScene.ts`:

Add imports:
```ts
import { FixedStepper, SIM_STEP } from "../core/fixedStep.ts";
import type { FxEvent } from "../core/battle.ts";
```

Add fields (near `gameSpeed = 1;`):
```ts
stepper = new FixedStepper();
/** Sim fx batched across this frame's fixed steps (the sim clears its own array per tick). */
pendingFx: FxEvent[] = [];
```

In `create()`, with the other re-entry resets (scene instances are reused — see memory):
```ts
this.stepper.reset();
this.pendingFx = [];
```

Replace `update()`:
```ts
update(time: number, deltaMs: number): void {
  this.handleKeyboardHero();
  // Fixed timestep: accumulate (speed-scaled, frame clamped) wall time and run
  // the sim in whole SIM_STEP ticks — the exact discretization the tests use.
  // gameSpeed: 0 = paused, 2/3 = fast-forward (more steps, never a bigger dt).
  const frame = Math.min(deltaMs / 1000, 0.25) * this.gameSpeed;
  const steps = this.stepper.advance(frame);
  this.pendingFx.length = 0;
  for (let i = 0; i < steps; i++) {
    this.battle.tick(SIM_STEP);
    this.pendingFx.push(...this.battle.fx);
  }
  this.syncCastleArt();
  this.draw();
  this.endlessBackdropFx?.update(time);
}
```

In `src/scenes/battleSceneRender.ts` `draw()` replace:
```ts
for (const ev of this.battle.fx) this.playFx(ev);
```
with:
```ts
// Batched in update(): replays nothing on 0-step frames, drops nothing on
// multi-step frames (the old direct read did both under fast-forward).
for (const ev of this.pendingFx) this.playFx(ev);
```

- [ ] **Step 6: Verify gauntlet** — `npm test && npm run typecheck && npm run lint && npm run lint:cycles && npm run format:check` → all green.

- [ ] **Step 7: Commit**
```bash
git add src/core/fixedStep.ts tests/fixed-step.test.ts src/scenes/BattleScene.ts src/scenes/battleSceneRender.ts
git commit -m "feat(core): fixed-timestep sim driver at the canonical 0.05s test step"
```

---

### Task 2: Render interpolation

**Files:**
- Create: `src/scenes/renderLerp.ts` (Phaser-free)
- Create: `tests/render-lerp.test.ts`
- Modify: `src/scenes/BattleScene.ts` (snapshot fields + update loop)
- Modify: `src/scenes/battleSceneSprites.ts` (`manageSprites`, `animateEnemy`, render-pos helpers)
- Modify: `src/scenes/battleSceneRender.ts` (`drawEnemy`, `drawHero`)

- [ ] **Step 1: Write the failing test** (`tests/render-lerp.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { lerpV, snapshotPositions } from "../src/scenes/renderLerp.ts";

describe("renderLerp", () => {
  it("lerps between prev and curr by alpha", () => {
    expect(lerpV({ x: 0, y: 10 }, { x: 10, y: 30 }, 0.5)).toEqual({ x: 5, y: 20 });
  });
  it("returns curr when no prev exists (fresh spawn)", () => {
    expect(lerpV(undefined, { x: 7, y: 8 }, 0.3)).toEqual({ x: 7, y: 8 });
  });
  it("alpha 0 → prev, alpha→1 → curr", () => {
    expect(lerpV({ x: 2, y: 4 }, { x: 12, y: 24 }, 0)).toEqual({ x: 2, y: 4 });
    expect(lerpV({ x: 2, y: 4 }, { x: 12, y: 24 }, 1)).toEqual({ x: 12, y: 24 });
  });
  it("snapshotPositions copies values (not references) and prunes stale uids", () => {
    const m = new Map<number, { x: number; y: number }>();
    m.set(99, { x: 0, y: 0 }); // stale entity from a previous tick
    const e = { uid: 1, pos: { x: 3, y: 4 } };
    snapshotPositions([e], m);
    expect(m.size).toBe(1);
    expect(m.get(1)).toEqual({ x: 3, y: 4 });
    e.pos.x = 100; // sim mutates pos in place — the snapshot must not follow
    expect(m.get(1)!.x).toBe(3);
  });
});
```

- [ ] **Step 2: Run it** → FAIL (module not found).

- [ ] **Step 3: Implement** `src/scenes/renderLerp.ts`

```ts
/**
 * Render-side position interpolation for the fixed-timestep sim (Phaser-free).
 * The sim advances in whole 0.05s steps; the renderer draws every display frame
 * at prev + (curr - prev) * alpha so motion stays smooth at any frame rate.
 */
export type V2 = { x: number; y: number };

/** Interpolate prev→curr by alpha; a missing prev (fresh spawn) renders at curr. */
export function lerpV(prev: V2 | undefined, curr: V2, alpha: number): V2 {
  if (!prev) return { x: curr.x, y: curr.y };
  return { x: prev.x + (curr.x - prev.x) * alpha, y: prev.y + (curr.y - prev.y) * alpha };
}

/** Snapshot entity positions BY VALUE into `out` (the sim mutates pos in place). */
export function snapshotPositions(
  entities: Iterable<{ uid: number; pos: V2 }>,
  out: Map<number, V2>,
): void {
  out.clear();
  for (const e of entities) out.set(e.uid, { x: e.pos.x, y: e.pos.y });
}
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Snapshot in the update loop.** `src/scenes/BattleScene.ts` — add fields:

```ts
/** Enemy/hero positions as of the START of the latest sim step (render interpolation). */
prevEnemyPos = new Map<number, { x: number; y: number }>();
prevHeroPos: { x: number; y: number } | null = null;
renderAlpha = 1; // lerp factor for draw(); 1 = draw live sim state
```

reset in `create()`:
```ts
this.prevEnemyPos.clear();
this.prevHeroPos = null;
this.renderAlpha = 1;
```

and change the step loop in `update()` to snapshot before each tick + publish alpha:
```ts
for (let i = 0; i < steps; i++) {
  snapshotPositions(this.battle.enemies, this.prevEnemyPos);
  const h = this.battle.hero;
  this.prevHeroPos = { x: h.pos.x, y: h.pos.y };
  this.battle.tick(SIM_STEP);
  this.pendingFx.push(...this.battle.fx);
}
this.renderAlpha = this.stepper.alpha;
```
(import `snapshotPositions` from `./renderLerp.ts`)

- [ ] **Step 6: Render-pos helpers.** In `src/scenes/battleSceneSprites.ts` add to `spritesMethods` (import `lerpV` from `./renderLerp.ts`):

```ts
/** Interpolated draw position for an enemy (fixed-step sim, smooth display). */
enemyRenderPos(this: BattleScene, e: EnemyRuntime): { x: number; y: number } {
  return lerpV(this.prevEnemyPos.get(e.uid), e.pos, this.renderAlpha);
},

/** Interpolated draw position for the hero. */
heroRenderPos(this: BattleScene): { x: number; y: number } {
  return lerpV(this.prevHeroPos ?? undefined, this.battle.hero.pos, this.renderAlpha);
},
```

- [ ] **Step 7: Consume in manageSprites + animateEnemy.** In `manageSprites` enemy loop:

```ts
const p = this.enemyRenderPos(e);
const s = this.ensureSprite(this.enemySprites, e.uid, key, p.x, p.y, displayH);
...
const shadow = this.ensureShadow(e.uid, p.x, p.y, displayH);
this.animateEnemy(s, e, key, shadow, p);
```

`animateEnemy` gains a final param `p: { x: number; y: number }` and every `e.pos.x`/`e.pos.y` read inside it becomes `p.x`/`p.y` (gait distance `px/py`, the `s.x/s.y` writes, the shadow pin). Hero block:

```ts
const hp = this.heroRenderPos();
...
this.heroSprite.setPosition(hp.x, hp.y);
```
(the `moving`/`facingLeft` math keeps using `h.moveTarget`/`h.pos` — sim intent, not display)

- [ ] **Step 8: Consume in drawEnemy/drawHero.** `src/scenes/battleSceneRender.ts`: at the top of `drawEnemy` add `const p = this.enemyRenderPos(e);` and replace every `e.pos.x`/`e.pos.y` in the function (elite aura, body circle, status rings, hp/shield/mana bars via `top`, `drawStatusGlyphs` start X) with `p.x`/`p.y`. Same in `drawHero` with `const p = this.heroRenderPos();` (body, range ring, hp/mana bars). `drawStatusGlyphs` gains the X via its existing `e` param — change its `e.pos.x` to a new `px: number` parameter passed from `drawEnemy`.

- [ ] **Step 9: Verify gauntlet** (full suite + tsc + lint + cycles + format) → green.

- [ ] **Step 10: Playtest.** Build + serve + CDP screenshot mid-battle at 1× and 3× (warm server; cold-boot black screen is a known snap.sh race, not a regression). Motion must be smooth, hp bars glued to bodies.

- [ ] **Step 11: Commit**
```bash
git add src/scenes/renderLerp.ts tests/render-lerp.test.ts src/scenes/BattleScene.ts src/scenes/battleSceneSprites.ts src/scenes/battleSceneRender.ts
git commit -m "feat(scenes): render interpolation over the fixed-step sim"
```

---

### Task 3: FxPool adopted in VfxDraw + ProjectileFx

**Files:**
- Create: `src/scenes/fxPool.ts`
- Create: `tests/fx-pool.test.ts`
- Modify: `src/scenes/vfxDraw.ts` (create via pool; `go()` releases)
- Modify: `src/scenes/projectileFx.ts` (create via pool; onCompletes release)
- Modify: `src/scenes/fx.ts` + `src/scenes/skillVfx.ts` (construct/thread the pool)

- [ ] **Step 1: Write the failing test** (`tests/fx-pool.test.ts`) — stub factory, no Phaser:

```ts
import { describe, expect, it, vi } from "vitest";
import { FxPool } from "../src/scenes/fxPool.ts";

type Stub = Record<string, ReturnType<typeof vi.fn>> & { destroyed: boolean };
function stubShape(): Stub {
  const s = { destroyed: false } as Stub;
  for (const m of [
    "setPosition", "setFillStyle", "setStrokeStyle", "setAlpha", "setScale",
    "setAngle", "setOrigin", "setVisible", "setActive", "setDepth",
  ])
    s[m] = vi.fn().mockReturnValue(s);
  s.destroy = vi.fn(() => (s.destroyed = true));
  return s;
}
function stubFactory() {
  const made: Stub[] = [];
  const make = () => { const s = stubShape(); made.push(s); return s; };
  return { made, fac: { circle: make, rectangle: make, star: make } };
}

describe("FxPool", () => {
  it("creates on first acquire, reuses after release", () => {
    const { made, fac } = stubFactory();
    const pool = new FxPool(fac as never);
    const a = pool.circle(1, 2, 3, 0xff0000, 1);
    pool.release(a as never);
    const b = pool.circle(9, 9, 5, 0x00ff00, 0.5);
    expect(b).toBe(a); // reused, not re-created
    expect(made.length).toBe(1);
  });

  it("resets full state on reuse", () => {
    const { fac } = stubFactory();
    const pool = new FxPool(fac as never);
    const a = pool.circle(1, 2, 3, 0xff0000, 1) as never as Record<string, ReturnType<typeof vi.fn>>;
    pool.release(a as never);
    pool.circle(9, 8, 7, 0x123456, 0.5);
    expect(a.setPosition).toHaveBeenLastCalledWith(9, 8);
    expect(a.setAlpha).toHaveBeenLastCalledWith(1);
    expect(a.setScale).toHaveBeenLastCalledWith(1);
    expect(a.setAngle).toHaveBeenLastCalledWith(0);
    expect(a.setStrokeStyle).toHaveBeenCalled(); // stroke cleared
    expect(a.setVisible).toHaveBeenLastCalledWith(true);
  });

  it("destroys (not pools) beyond the cap, and destroys unknown objects", () => {
    const { fac } = stubFactory();
    const pool = new FxPool(fac as never, 1);
    const a = pool.circle(0, 0, 1);
    const b = pool.circle(0, 0, 1);
    pool.release(a as never);
    pool.release(b as never); // over cap → destroy
    expect((b as never as Stub).destroyed).toBe(true);
    const foreign = stubShape();
    pool.release(foreign as never); // not pool-made → destroy
    expect(foreign.destroyed).toBe(true);
  });

  it("pools circles, rects and stars independently", () => {
    const { fac } = stubFactory();
    const pool = new FxPool(fac as never);
    const c = pool.circle(0, 0, 1);
    pool.release(c as never);
    const r = pool.rect(0, 0, 2, 2, 0xffffff);
    expect(r).not.toBe(c); // a released circle never serves a rect request
  });
});
```

- [ ] **Step 2: Run it** → FAIL.

- [ ] **Step 3: Implement** `src/scenes/fxPool.ts`

```ts
/**
 * FxPool — bounded reuse pool for the one-shot VFX shape primitives (circle /
 * rect / star) that peak combat churns at hundreds per second. Acquire fully
 * resets visual state; release returns to the pool (or destroys past the cap,
 * so memory is bounded and a missed release degrades to today's behavior).
 * Kind-tagging uses a WeakMap, not instanceof, so the logic is Phaser-free and
 * unit-testable. Pool instances live per battle (objects die with the scene).
 */
import type Phaser from "phaser";

type Shape = Phaser.GameObjects.Shape;
type Kind = "circle" | "rect" | "star";

export class FxPool {
  private readonly free: Record<Kind, Shape[]> = { circle: [], rect: [], star: [] };
  private readonly kindOf = new WeakMap<object, Kind>();

  constructor(
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly cap = 128,
  ) {}

  /** Common reset; callers then chain setters exactly as with a fresh factory object. */
  private reset(o: Shape, x: number, y: number): Shape {
    return o
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(1)
      .setAngle(0)
      .setOrigin(0.5)
      .setStrokeStyle() // no args → stroke off
      .setVisible(true)
      .setActive(true);
  }

  circle(x: number, y: number, r: number, fill = 0xffffff, alpha = 1): Phaser.GameObjects.Arc {
    const o = this.free.circle.pop() as Phaser.GameObjects.Arc | undefined;
    if (!o) {
      const made = this.fac.circle(x, y, r, fill, alpha);
      this.kindOf.set(made, "circle");
      return made;
    }
    o.radius = r;
    this.reset(o, x, y).setFillStyle(fill, alpha);
    return o;
  }

  rect(x: number, y: number, w: number, h: number, fill = 0xffffff, alpha = 1): Phaser.GameObjects.Rectangle {
    const o = this.free.rect.pop() as Phaser.GameObjects.Rectangle | undefined;
    if (!o) {
      const made = this.fac.rectangle(x, y, w, h, fill, alpha);
      this.kindOf.set(made, "rect");
      return made;
    }
    o.setSize(w, h);
    this.reset(o, x, y).setFillStyle(fill, alpha);
    return o;
  }

  star(x: number, y: number, points: number, innerR: number, outerR: number, fill = 0xffffff, alpha = 1): Phaser.GameObjects.Star {
    const o = this.free.star.pop() as Phaser.GameObjects.Star | undefined;
    if (!o) {
      const made = this.fac.star(x, y, points, innerR, outerR, fill, alpha);
      this.kindOf.set(made, "star");
      return made;
    }
    o.setTo(points, innerR, outerR);
    this.reset(o, x, y).setFillStyle(fill, alpha);
    return o;
  }

  /** Return a pool-made shape for reuse; anything else (or past cap) is destroyed. */
  release(o: Shape): void {
    const kind = this.kindOf.get(o);
    if (!kind || this.free[kind].length >= this.cap) {
      o.destroy();
      return;
    }
    o.setVisible(false).setActive(false);
    this.free[kind].push(o);
  }
}
```

NOTE: verify `Phaser.GameObjects.Star` exposes `setTo(points, innerR, outerR)` — if absent in this Phaser version, set `o.points / o.innerRadius / o.outerRadius` instead (each is an updating accessor). Adjust during implementation and keep the test factory-level.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Thread the pool.** `fx.ts`: `this.pool = new FxPool(this.fac);` after building `fac`; pass to `new ProjectileFx(scene, this.fac, this.depth, this.impact, this.pool)` and into `SkillVfx` → `VfxDraw`. `vfxDraw.ts`: constructor gains `private readonly pool: FxPool`; every internal `this.fac.circle(...)` / `.rectangle(...)` / `.star(...)` becomes `this.pool.circle(...)` etc. (graphics/text stay factory-made); `go()`'s `onComplete: () => o.destroy()` becomes `onComplete: () => this.pool.release(o as Phaser.GameObjects.Shape)` for shapes — keep destroy for Graphics (track via a second param or check `kindOf` by letting `release` handle unknowns: simplest is to ALWAYS call `this.pool.release(o as never)`; unknown kinds destroy — identical to today). `projectileFx.ts`: same substitution; multi-target tweens (`[body, glow]`, `[dot, glow]`) release each object in onComplete.

- [ ] **Step 6: Verify gauntlet** → green. Playtest: heavy-combat screenshot; effects must look identical (no ghost styling on reused shapes).

- [ ] **Step 7: Commit**
```bash
git add src/scenes/fxPool.ts tests/fx-pool.test.ts src/scenes/vfxDraw.ts src/scenes/projectileFx.ts src/scenes/fx.ts src/scenes/skillVfx.ts
git commit -m "perf(scenes): pool one-shot VFX shapes in VfxDraw + ProjectileFx"
```

---

### Task 4: Micro-churn fixes + final verification

**Files:**
- Modify: `src/core/battleEnemies.ts:104-116` (in-place DoT compaction)
- Modify: `src/scenes/battleSceneSprites.ts` `manageSprites` + `src/scenes/BattleScene.ts` (reused Sets)

- [ ] **Step 1: Confirm existing coverage** — `npx vitest run tests/ -t dot` (and the burn/poison status tests) pass before touching anything; they are the regression net (no new test needed — behavior must be byte-identical).

- [ ] **Step 2: In-place DoT compaction.** Replace battleEnemies.ts lines 104-116 with:

```ts
if (e.dots.length > 0) {
  // In-place compaction — the old build-a-survivors-array allocated per enemy
  // per tick. Mutating `remaining` is safe: dots are never aliased outside e.dots.
  let w = 0;
  for (const d of e.dots) {
    const active = Math.min(dt, d.remaining);
    if (active > 0) {
      const ctx = this.dmgCtx("dot", "dot", `dot ${d.dps}/s ×${active.toFixed(2)}s`);
      this.applyDamage(e, d.type, d.dps * active, d.armorPen, d.magicPen, false, false, ctx);
    }
    d.remaining -= dt;
    if (d.remaining > 0 && e.alive) e.dots[w++] = d;
  }
  e.dots.length = w;
}
```

- [ ] **Step 3: Reused Sets.** `BattleScene.ts` fields: `_seenT = new Set<number>(); _seenE = new Set<number>();` — in `manageSprites` replace `const seenT = new Set<number>();` with `const seenT = this._seenT; seenT.clear();` (same for `seenE`).

- [ ] **Step 4: Full gauntlet** → all green (1041+ tests).

- [ ] **Step 5: Final playtest** — build, serve, CDP error probe (PAGE ERRORS must be []), screenshots: battle at 1×, battle at 3×, pause (speed 0 freezes sim but UI stays live). Compare against pre-refactor captures.

- [ ] **Step 6: Update memory** (`project_lint_format_tooling` link or new `project_fixed_timestep` memory: SIM_STEP=0.05 is canonical; pendingFx batching; interpolation seam; FxPool seams) + mark tasks #107-#110 complete.

- [ ] **Step 7: Commit**
```bash
git add -A src/ docs/
git commit -m "perf(core): in-place DoT compaction + reused sprite-sync sets"
```

---

## Self-review notes

- **Spec coverage:** M1→Task 1, M2→Task 2, M3→Task 3, M4→Task 4. Non-goals honored (no skillElementFx/meleeFx pooling; no sim event-model change).
- **Type consistency:** `SIM_STEP`/`FixedStepper.advance/alpha/reset`, `lerpV`/`snapshotPositions`, `FxPool.circle/rect/star/release`, scene fields `stepper/pendingFx/prevEnemyPos/prevHeroPos/renderAlpha/_seenT/_seenE` used consistently across tasks.
- **Known judgment calls:** `Star.setTo` availability flagged in Task 3 Step 3; `drawStatusGlyphs` signature change noted in Task 2 Step 8; fx batching intentionally FIXES the fast-forward fx-drop bug (a strict improvement, sim untouched).
