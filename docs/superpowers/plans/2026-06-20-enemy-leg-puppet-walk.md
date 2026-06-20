# Enemy/Boss Leg-Puppet Walk — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ground enemies and bosses visibly *step* — feet that lift and swing in alternating phase — without baking multi-frame strips (the two prior, reverted approaches) and without any art regen.

**Architecture:** Keep each enemy a single static SDXL sprite. At render time, crop it into a **body** (top portion, baked-in feet hidden) plus **two leg pieces** (bottom-left / bottom-right quadrants of the *same* texture), all sharing the body's transform. A pure gait-phase puppet (`legPuppet`) returns per-leg lift/swing, applied additively so feet move; `legR` runs π out of phase from `legL`. Continuous phase ⇒ smoother than discrete frames; one texture ⇒ no flicker; no strip ⇒ the single-frame guard test stays green.

**Tech Stack:** TypeScript, Phaser 3 (Image crops, depth), Vitest. Pure modules (`src/scenes/legPuppet.ts`) are Phaser-free and TDD'd; the presenter (`src/scenes/enemyLegRig.ts`) is thin glue.

**Key constraints (from the spec + repo history):**
- Do NOT bake any multi-frame texture onto `enemy__<id>` (floating-strip regression, commit `b627ba8`).
- Keep `tests/...` single-frame manifest guard green (no manifest / PNG / `ASSET_VERSION` changes).
- Keep every touched file under 500 code lines (ESLint `max-lines` = error).
- `madge` `lint:cycles` must stay at 0 runtime cycles.
- Flying enemies keep their wing-beat (no legs).

---

## File Structure

- **Create** `src/scenes/legPuppet.ts` — pure gait→leg-pose math. One responsibility: given a phase, return both legs' lift/swing and which is planted.
- **Create** `tests/legPuppet.test.ts` — TDD for the above, plus the placement combiner used by the presenter.
- **Create** `src/scenes/enemyLegRig.ts` — Phaser presenter: create/update/destroy the two leg Images and crop the body; thin glue over `legPuppet`.
- **Modify** `src/scenes/battleDepths.ts` — add `ENEMY_LEG` depth band (between shadow and body).
- **Modify** `src/scenes/BattleScene.ts:131-173` — add `enemyLegs` map field + clear it on reset.
- **Modify** `src/scenes/battleSceneSprites.ts` — wire rig creation (in `manageSprites`) + per-frame update (in `animateEnemy`) + cull. Keep under 500 lines by housing all logic in `enemyLegRig.ts`.
- **M2 — Modify** `src/scenes/battleSceneSprites.ts` (boss branch) + **Delete** `src/scenes/bossWalkBake.ts`, its preload call, and (if unreferenced) `src/scenes/enemyWalkWarp.ts` + `tests/enemyWalkWarp.test.ts`.

---

## Task 1: Pure leg-puppet math (`legPuppet.ts`)

**Files:**
- Create: `src/scenes/legPuppet.ts`
- Test: `tests/legPuppet.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/legPuppet.test.ts
import { describe, it, expect } from "vitest";
import { legPuppet, legWorldPos } from "../src/scenes/legPuppet.ts";

const TWO_PI = Math.PI * 2;

describe("legPuppet", () => {
  it("the two legs run a half-cycle out of phase (alternating step)", () => {
    // right leg at phase p equals left leg at phase p+π
    for (const p of [0, 0.5, 1.3, 2.0, 5.1]) {
      const a = legPuppet(p);
      const b = legPuppet(p + Math.PI);
      expect(a.right.liftY).toBeCloseTo(b.left.liftY, 6);
      expect(a.right.swingX).toBeCloseTo(b.left.swingX, 6);
    }
  });

  it("each foot lifts off the ground at some point in the cycle (liftY < 0)", () => {
    let minLeft = 0;
    for (let i = 0; i < 64; i++) minLeft = Math.min(minLeft, legPuppet((i / 64) * TWO_PI).left.liftY);
    expect(minLeft).toBeLessThan(-2); // clearly airborne, not a sub-pixel wiggle
  });

  it("a foot is planted (liftY ~ 0) at the bottom of its swing", () => {
    // left foot plants near phase 0 / π (sin = 0) and lifts mid-swing
    expect(legPuppet(0).left.liftY).toBeCloseTo(0, 5);
    expect(legPuppet(0).left.planted).toBe(true);
    expect(legPuppet(Math.PI / 2).left.planted).toBe(false);
  });

  it("at any instant at least one foot is on the ground (no full hop)", () => {
    for (let i = 0; i < 64; i++) {
      const { left, right } = legPuppet((i / 64) * TWO_PI);
      expect(left.planted || right.planted).toBe(true);
    }
  });

  it("is continuous/periodic across the 0/2π seam", () => {
    const a = legPuppet(0.0001);
    const b = legPuppet(TWO_PI - 0.0001);
    expect(a.left.liftY).toBeCloseTo(b.left.liftY, 3);
    expect(a.left.swingX).toBeCloseTo(b.left.swingX, 3);
  });

  it("amp scales lift and swing up monotonically", () => {
    const small = legPuppet(Math.PI / 2, { amp: 0.5 });
    const big = legPuppet(Math.PI / 2, { amp: 1.5 });
    expect(Math.abs(big.left.liftY)).toBeGreaterThan(Math.abs(small.left.liftY));
    expect(Math.abs(big.left.swingX)).toBeGreaterThan(Math.abs(small.left.swingX));
  });

  it("legWorldPos: a lifted foot sits higher (smaller y) than a planted one", () => {
    const pose = legPuppet(Math.PI / 2); // left lifted, right planted
    const bodyY = 300;
    const left = legWorldPos({ x: 100, y: bodyY }, pose.left);
    const right = legWorldPos({ x: 100, y: bodyY }, pose.right);
    expect(left.y).toBeLessThan(right.y); // lifted leg drawn higher up
    expect(left.x).not.toBeCloseTo(right.x, 1); // and swung apart
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/legPuppet.test.ts`
Expected: FAIL — "Failed to resolve import ... legPuppet.ts" / module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/scenes/legPuppet.ts
// Pure (Phaser-free) gait → leg-pose math. Each ground unit is one static
// sprite split at render time into a body + two leg crops (see enemyLegRig.ts);
// this module says how far each leg lifts and swings at a gait phase so the feet
// visibly alternate. Continuous in `phase` → effectively unlimited in-between
// poses (smoother than any baked frame count), and one texture deformed → no
// per-frame character flicker.

export interface LegPose {
  /** Vertical offset, display px. <= 0 lifts the foot off the ground. */
  liftY: number;
  /** Horizontal offset relative to the body, display px. + = forward of body. */
  swingX: number;
  /** True while the foot is on (or near) the ground (the support phase). */
  planted: boolean;
}

export interface LegRigPose {
  left: LegPose;
  right: LegPose;
}

export interface LegPuppetOpts {
  /** Peak foot lift in display px (default 6). */
  lift?: number;
  /** Peak fore/aft swing in display px (default 5). */
  swing?: number;
  /** Global amplitude scale (bosses heavier → larger). Default 1. */
  amp?: number;
}

/** Below this |sin(phase)| the foot counts as planted (support phase). */
const PLANT_THRESHOLD = 0.18;

function oneLeg(phase: number, lift: number, swing: number): LegPose {
  const s = Math.sin(phase);
  // Foot lifts on the forward half of the swing (sin > 0), stays grounded on the
  // support half. |sin| would lift twice per cycle; max(0, sin) lifts once → a
  // natural single step per cycle, the other leg covers the opposite half.
  const up = Math.max(0, s);
  return {
    liftY: -lift * up,
    swingX: swing * s, // leads forward while airborne, trails back while planted
    planted: up < PLANT_THRESHOLD,
  };
}

/** Both legs for a gait phase; the right leg is a half-cycle (π) behind the left. */
export function legPuppet(phase: number, opts: LegPuppetOpts = {}): LegRigPose {
  const amp = opts.amp ?? 1;
  const lift = (opts.lift ?? 6) * amp;
  const swing = (opts.swing ?? 5) * amp;
  return {
    left: oneLeg(phase, lift, swing),
    right: oneLeg(phase + Math.PI, lift, swing),
  };
}

/** Apply a leg pose to a body anchor → the leg piece's world position. */
export function legWorldPos(body: { x: number; y: number }, pose: LegPose): { x: number; y: number } {
  return { x: body.x + pose.swingX, y: body.y + pose.liftY };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/legPuppet.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/legPuppet.ts tests/legPuppet.test.ts
git commit -m "feat(enemies): pure leg-puppet gait math (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Leg-rig presenter (`enemyLegRig.ts`) + depth band

**Files:**
- Create: `src/scenes/enemyLegRig.ts`
- Modify: `src/scenes/battleDepths.ts` (add `ENEMY_LEG`)

- [ ] **Step 1: Add the `ENEMY_LEG` depth band**

In `src/scenes/battleDepths.ts`, inside the `DEPTH` object, add a fractional band between `ENEMY_SHADOW` (1) and `ENEMY` (2) so leg pieces draw above the shadow but behind the body torso (which hides the hip seam):

```typescript
  ENEMY_SHADOW: 1, // ground-contact shadow
  ENEMY_LEG: 1.5, // leg puppet pieces — above the shadow, behind the body torso
  TERRAIN: 1, // SVG obstacles / decor
  ENEMY: 2, // enemy + boss + tower sprites
```

- [ ] **Step 2: Write the presenter**

```typescript
// src/scenes/enemyLegRig.ts
// Render-time leg puppet: a single static enemy sprite is shown as a cropped
// BODY (feet hidden) plus two leg pieces (bottom-left / bottom-right crops of
// the SAME texture) that lift/swing in alternating phase (see legPuppet.ts).
// No baked strip texture is ever created (that caused the "floating strip"
// regression in b627ba8), so the single-frame enemy contract is untouched.
import type Phaser from "phaser";
import { legPuppet, type LegRigPose } from "./legPuppet.ts";
import { DEPTH } from "./battleDepths.ts";

/** Fraction of the frame height shown by the BODY (top → this point). */
export const WAIST_BODY = 0.6;
/** Legs crop a little higher than the body's bottom so the overlap hides behind
 *  the torso (mirrors the +overlap the old band-baker used to hide seams). */
export const WAIST_LEG = 0.54;

export interface LegRig {
  legL: Phaser.GameObjects.Image;
  legR: Phaser.GameObjects.Image;
  /** Frame dims captured at creation (for crop rects). */
  fw: number;
  fh: number;
}

/** True for enemies that should walk on legs (ground, has a real frame). */
export function wantsLegs(flying: boolean, frameW: number, frameH: number): boolean {
  return !flying && frameW > 0 && frameH > 0;
}

/**
 * Create the two leg Images for an enemy and crop the body to hide its feet.
 * Idempotent per uid via the supplied map. Returns the rig (or the existing one).
 */
export function ensureLegRig(
  scene: Phaser.Scene,
  world: Phaser.GameObjects.Container,
  rigs: Map<number, LegRig>,
  uid: number,
  body: Phaser.GameObjects.Sprite,
  key: string,
): LegRig | null {
  const existing = rigs.get(uid);
  if (existing) return existing;
  const frame = scene.textures.getFrame(key, 0);
  if (!frame?.cutWidth || !frame?.cutHeight) return null;
  const fw = frame.cutWidth;
  const fh = frame.cutHeight;

  // Hide the body's baked-in feet so the moving leg pieces don't double up.
  body.setCrop(0, 0, fw, fh * WAIST_BODY);

  const mkLeg = (cropX: number): Phaser.GameObjects.Image => {
    const leg = scene.add
      .image(body.x, body.y, key)
      .setOrigin(body.originX, body.originY)
      .setDepth(DEPTH.ENEMY_LEG);
    leg.setCrop(cropX, fh * WAIST_LEG, fw / 2, fh * (1 - WAIST_LEG));
    world.add(leg);
    return leg;
  };
  const rig: LegRig = { legL: mkLeg(0), legR: mkLeg(fw / 2), fw, fh };
  rigs.set(uid, rig);
  return rig;
}

/**
 * Position the legs under the already-transformed body this frame. The legs
 * share the body's scale/angle/tint/alpha; the puppet adds per-leg lift+swing
 * so feet alternate. `phase` is the same gait phase that drives the body bob.
 */
export function updateLegRig(
  rig: LegRig,
  body: Phaser.GameObjects.Sprite,
  phase: number,
  amp: number,
  liftSwingScale: number,
): void {
  const pose: LegRigPose = legPuppet(phase, {
    amp,
    lift: 6 * liftSwingScale,
    swing: 5 * liftSwingScale,
  });
  const tint = body.tintTopLeft;
  const tinted = body.isTinted;
  for (const [leg, p] of [
    [rig.legL, pose.left],
    [rig.legR, pose.right],
  ] as const) {
    leg.setScale(body.scaleX, body.scaleY);
    leg.setAngle(body.angle);
    leg.x = body.x + p.swingX;
    leg.y = body.y + p.liftY;
    leg.setAlpha(body.alpha);
    if (tinted) leg.setTint(tint);
    else leg.clearTint();
    leg.setVisible(body.visible);
  }
}

/** Hold the legs still at the rest pose (frozen / stunned enemy standing). */
export function restLegRig(rig: LegRig, body: Phaser.GameObjects.Sprite): void {
  for (const leg of [rig.legL, rig.legR]) {
    leg.setScale(body.scaleX, body.scaleY);
    leg.setAngle(body.angle);
    leg.x = body.x;
    leg.y = body.y;
    leg.setAlpha(body.alpha);
  }
}

/** Tear down a rig's leg pieces (enemy culled). */
export function destroyLegRig(rigs: Map<number, LegRig>, uid: number): void {
  const rig = rigs.get(uid);
  if (!rig) return;
  rig.legL.destroy();
  rig.legR.destroy();
  rigs.delete(uid);
}
```

- [ ] **Step 3: Typecheck the new module compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The module is not wired yet; this just confirms types.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/enemyLegRig.ts src/scenes/battleDepths.ts
git commit -m "feat(enemies): leg-rig presenter + ENEMY_LEG depth band

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire the rig into the battle render loop

**Files:**
- Modify: `src/scenes/BattleScene.ts:131-173` (add `enemyLegs` field + clear on reset)
- Modify: `src/scenes/battleSceneSprites.ts` (create/update/cull legs)

- [ ] **Step 1: Add the `enemyLegs` map field on BattleScene**

In `src/scenes/BattleScene.ts`, next to the other sprite maps (~line 133), add the import and field:

```typescript
// near the other scene imports
import type { LegRig } from "./enemyLegRig.ts";
```

```typescript
  enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  enemyShadows = new Map<number, Phaser.GameObjects.Ellipse>(); // ground-contact anchors
  enemyLegs = new Map<number, LegRig>(); // per-enemy leg-puppet pieces
```

And in the reset/shutdown block (~line 173, where `this.enemyShadows.clear()` is called), add:

```typescript
    this.enemyShadows.clear();
    this.enemyLegs.clear();
```

- [ ] **Step 2: Import the rig helpers in `battleSceneSprites.ts`**

At the top of `src/scenes/battleSceneSprites.ts`, add:

```typescript
import {
  wantsLegs,
  ensureLegRig,
  updateLegRig,
  restLegRig,
  destroyLegRig,
} from "./enemyLegRig.ts";
```

- [ ] **Step 3: Drive the legs from `animateEnemy`**

In `src/scenes/battleSceneSprites.ts`, in `animateEnemy`, AFTER the body transform is committed (after the `s.x = p.x + xOff; s.y = p.y + yOff;` lines, ~line 384) and BEFORE the shadow block, add:

```typescript
    // Leg puppet: split the single sprite into a cropped body + two leg pieces
    // that step in alternating phase. Ground enemies only — flyers have no legs.
    const rig = e.flying ? undefined : this.enemyLegs.get(e.uid);
    if (rig) {
      if (frozen) {
        restLegRig(rig, s);
      } else {
        const legScale = (base / ((s.getData("baseScale") as number) || base)) || 1;
        const phase = (s.getData("gaitPhase") as number) ?? 0;
        const amp = boss ? 1.35 : 1; // heavier, longer boss stride
        // Scale lift/swing to the creature's on-screen size (taller = bigger step).
        const displayScale = s.scaleY / ((s.getData("baseScale") as number) || s.scaleY);
        updateLegRig(rig, s, phase, amp, displayScale * legScale);
      }
    }
```

> Note: `gaitPhase` is already set earlier in `animateEnemy` for the ground branch; `legScale`/`displayScale` keep the step proportional to the upgrade/elite display height. Keep this block compact — if `battleSceneSprites.ts` exceeds 500 code lines after wiring, move the body of this block into a `enemyLegRig.ts` helper `tickLegRig(scene, e, s, boss, frozen)` and call that instead.

- [ ] **Step 4: Create the rig on first sprite + cull on removal**

In `manageSprites`, inside the enemy loop, right after `const shadow = this.ensureShadow(...)` and before `this.animateEnemy(...)` (~line 506), add:

```typescript
        if (wantsLegs(e.flying, s.width, s.height)) {
          ensureLegRig(this, this.world, this.enemyLegs, e.uid, s, key);
        }
```

Then in the cull loop for enemies (the `for (const [uid, s] of this.enemySprites)` block that destroys culled sprites, ~line 510), add a sibling cull for legs after the shadow cull:

```typescript
    for (const [uid] of this.enemyLegs)
      if (!seenE.has(uid)) destroyLegRig(this.enemyLegs, uid);
```

- [ ] **Step 5: Typecheck + full test suite + lint**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src/scenes/battleSceneSprites.ts src/scenes/enemyLegRig.ts src/scenes/legPuppet.ts && npm run lint:cycles`
Expected: tsc clean; all tests pass (incl. the single-frame manifest guard still green); ESLint reports no `max-lines` error; madge reports 0 cycles.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: `✓ built` with no TS errors (the >500 kB chunk warning is pre-existing and benign).

- [ ] **Step 7: Live CDP playtest (visual proof)**

Start the dev server and drive a battle via `window.__game` (see `reference_playtest_and_art` memory). Capture a screenshot mid-wave and confirm:
- enemy base texture width is unchanged (single frame, e.g. 300 — no strip),
- the two leg Images per enemy occupy *different* y across consecutive frames (one lifted),
- no visible double-feet / seam gap at the waist,
- flyers are unaffected.

Save the screenshot to `/tmp/legwalk.png` and attach it.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/battleSceneSprites.ts
git commit -m "feat(enemies): render-time leg puppet — alternating stepping feet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 (M2): Extend to bosses; retire the band-warp bake

**Files:**
- Modify: `src/scenes/battleSceneSprites.ts` (boss branch already covered by `amp: 1.35` in Task 3 — verify bosses get a rig)
- Modify: `src/scenes/PreloadScene.ts` (remove the `bakeBossWalks(this)` call + import)
- Delete: `src/scenes/bossWalkBake.ts`
- Delete (if unreferenced after the above): `src/scenes/enemyWalkWarp.ts` + `tests/enemyWalkWarp.test.ts`

- [ ] **Step 1: Confirm bosses get a leg rig**

Bosses are non-flying, so `wantsLegs(e.flying, ...)` is already true and Task 3 creates a rig for them with `amp: 1.35`. Bosses still keep their multi-frame `boss__<id>` sheet for atk/skill/hurt one-shots (those play via `playSpriteOneShot` and crop is only the body's feet). Verify by reading the enemy loop: no boss-specific guard blocks `ensureLegRig`.

- [ ] **Step 2: Remove the boss walk bake from preload**

In `src/scenes/PreloadScene.ts`, delete the `import { bakeBossWalks } from "./bossWalkBake.ts";` line and the `bakeBossWalks(this);` call in `create()`.

- [ ] **Step 3: Stop the runtime walk-anim from fighting the puppet for bosses**

In `animateEnemy`, the `if (this.anims.exists(`${key}_walk`))` block plays a looping `walk` anim. For bosses that previously had a baked `boss__<id>__walk` anim this drove the stomp; now the puppet drives locomotion and there is no baked walk texture, so `${key}_walk` will not exist for bosses → the block is a no-op. Confirm by grep that nothing else creates a `boss__<id>_walk` anim. (PreloadScene's generic anim builder only makes `walk` from manifest frames named `walk*`; boss sheets DO contain `walk1..walk4` frame names from the manifest. So a `boss__<id>_walk` anim WILL still be built from those sheet frames.) Therefore: in the `animateEnemy` walk-anim block, skip playing the looping walk anim when the enemy has a leg rig:

```typescript
    if (this.anims.exists(`${key}_walk`) && !this.enemyLegs.has(e.uid)) {
```

This leaves towers/legless paths untouched and prevents the boss sheet's `walk*` frames from cycling under the puppet.

- [ ] **Step 4: Delete the dead bake module + (if unreferenced) the warp module**

```bash
git rm src/scenes/bossWalkBake.ts
grep -rn "enemyWalkWarp\|bandWarp" src tests   # if ONLY the test references it:
git rm src/scenes/enemyWalkWarp.ts tests/enemyWalkWarp.test.ts
```

If `bandWarp` is still imported anywhere in `src`, keep `enemyWalkWarp.ts` and its test; only remove the boss bake.

- [ ] **Step 5: Verify whole**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src/scenes && npm run lint:cycles && npm run build`
Expected: all green; no references to the deleted modules; single-frame guard still green.

- [ ] **Step 6: Live CDP boss playtest**

Drive a boss wave (e.g. an endless boss every 10, or a campaign finale stage) via `window.__game`; screenshot the boss walking. Confirm legs alternate, no strip, atk/skill cast poses still fire. Save to `/tmp/legwalk-boss.png` and attach.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(bosses): leg puppet for boss locomotion; retire band-warp stomp bake

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 (M3): Tune + document

**Files:**
- Modify: `src/scenes/enemyLegRig.ts` (`WAIST_BODY` / `WAIST_LEG`) and/or `legPuppet.ts` defaults, per the visual pass
- Modify: memory `project_procedural_sprite_animation.md` + `MEMORY.md` pointer

- [ ] **Step 1: Visual tuning pass**

From the CDP screenshots across a few archetypes (a biped grunt, a wide/blob enemy, a boss), adjust `WAIST_BODY`/`WAIST_LEG` (waist line) and the `lift`/`swing` defaults so feet read as stepping without the torso detaching from the legs. Re-run the CDP playtest after each tweak. Keep changes to constants only.

- [ ] **Step 2: Update the existing animation memory**

Edit `project_procedural_sprite_animation.md`: note that ground enemies AND bosses now walk via a render-time **leg puppet** (`legPuppet.ts` + `enemyLegRig.ts`) — body cropped at the waist + two alternating-phase leg crops of the same single sprite; `enemyWalkTransform` still drives whole-body bob/waddle; the boss `bossWalkBake`/band-warp stomp was retired. Single-frame manifest contract and no-strip invariant preserved. Update the one-line pointer in `MEMORY.md` if the hook changed.

- [ ] **Step 3: Final verify + commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

```bash
git add -A
git commit -m "polish(enemies): tune leg-puppet waist/amplitude + update animation memory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- "feet that lift and step" → Task 1 (`legPuppet`) + Task 3 (wiring). ✓
- "no floating-strip / keep single-frame guard" → no texture baked; body crop only; Task 3 Step 5 reasserts the guard passes. ✓
- "no flicker / no art regen / no ASSET_VERSION bump" → only crops of the existing single frame; no PNG/manifest touch. ✓
- "flying enemies keep wing-beat" → `wantsLegs` excludes flyers; rig is `e.flying ? undefined`. ✓
- "bosses too; retire band-warp bake" → Task 4. ✓
- "files < 500 lines / 0 cycles" → logic lives in `enemyLegRig.ts`; Task 3 Step 5 runs eslint + madge, with an explicit fallback (extract `tickLegRig`) if the wiring overflows. ✓
- "smoother than discrete frames" → continuous phase; documented in spec + module header. ✓

**Placeholder scan:** none — every code step shows complete code; commands have expected output.

**Type consistency:** `LegPose`/`LegRigPose`/`legPuppet`/`legWorldPos` (Task 1) match their uses in `enemyLegRig.ts` (Task 2); `LegRig`/`ensureLegRig`/`updateLegRig`/`restLegRig`/`destroyLegRig`/`wantsLegs` (Task 2) match the imports + calls in Task 3; `enemyLegs` map type `Map<number, LegRig>` is consistent across BattleScene field, presenter, and call sites. `DEPTH.ENEMY_LEG` added in Task 2 Step 1 is consumed in Task 2 Step 2.

---

## Implementation notes & deviations (2026-06-20)

What actually shipped on `feat/enemy-leg-puppet-walk` differs from the plan in two deliberate ways:

1. **Bosses excluded (M2 cut).** Bosses carry authored multi-frame sheets (walk/atk/skill/hurt cast poses) + a baked stomp. Cropping a leg puppet over those one-shot cast frames would desync the legs mid-cast, and the visual couldn't be headless-verified. The rig is gated to **non-boss** ground enemies; bosses keep their existing animation untouched. `bossWalkBake.ts` / `enemyWalkWarp.ts` were therefore NOT deleted.

2. **New milestone — fix a live floating-strip regression (root cause found mid-implementation).** Commit `2978275` had reverted 16 of 25 enemy PNGs from clean 300×300 single sprites back to 6-frame horizontal strips while the manifest still said `300×300, frames:1`. Phaser's spritesheet parser computes `column=floor(128/300)=0 → total=0`, so the sprite renders the whole strip smeared down the lane — the exact bug `b627ba8` "killed", live again (and `--disable-gpu` headless masks it). The strips were also unusable cycles (slime/raider = 6 identical tiles). Fixed by extracting frame 0 → 300×300 for the 16 (Pillow, no SDXL), `ASSET_VERSION → 2026-06-20a`. This both fixes a shipped bug and gives the puppet a correct sprite to animate. Commit `ff99519`.

**Verification reality:** the live in-browser CDP capture could not run — the sandbox OOM-kills `vite preview` / `python -m http.server`, and Chrome 149 needs `--remote-allow-origins=*` for the DevTools WS. Validated instead by: the 7 pure `legPuppet` tests, the full 1428-test suite (incl. the single-frame manifest guard, which proves no strip), `tsc`/`eslint`/`madge`/`build` all clean, and a faithful Pillow montage applying the exact crop+offset math to the real `grunt.png`. Branch is NOT deployed — recommend a human glance in a real browser before merge/deploy.
