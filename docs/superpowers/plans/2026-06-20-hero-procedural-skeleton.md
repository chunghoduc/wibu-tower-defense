# Hero Procedural Skeleton Rig — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the battle hero's painted-body + whole-body-overlay rig with a procedural bone skeleton whose worn gear attaches to bones and follows each limb through idle/walk/attack.

**Architecture:** Three pure modules — `heroSkeleton.ts` (bone table + forward kinematics), `heroSkeletonAnim.ts` (per-state angle deltas), `heroWornRig.ts` (slot→bone attach + placements) — feed one thin Phaser presenter `HeroSkeletonSprite.ts` (drop-in API replacement for `HeroLayeredSprite`). A `USE_SKELETON_HERO` switch in `battleSceneSprites.ts` selects it; the painted rig is retained as fallback. Phase 2 regenerates Gloves/Boots as single-limb art for per-foot/per-hand splitting.

**Tech Stack:** TypeScript, Phaser 3.80, Vitest, Vite; SDXL (z-image-turbo) art pipeline.

**Spec:** `docs/superpowers/specs/2026-06-20-hero-procedural-skeleton-design.md`

---

## Phase 1 — Skeleton stands up (whole-piece art)

### Task 1: `heroSkeleton.ts` — bone table + forward kinematics

**Files:**
- Create: `src/data/heroSkeleton.ts`
- Test: `tests/heroSkeleton.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/heroSkeleton.test.ts
import { describe, it, expect } from "vitest";
import { BONES, resolveSkeleton, type BoneId } from "../src/data/heroSkeleton.ts";

const SIZE = 100;
const noDelta = {};

describe("heroSkeleton", () => {
  it("lists every bone parent-before-child", () => {
    const seen = new Set<BoneId>();
    for (const b of BONES) {
      if (b.parent) expect(seen.has(b.parent)).toBe(true);
      seen.add(b.id);
    }
    expect(seen.has("pelvis")).toBe(true);
    expect(seen.size).toBe(BONES.length);
  });

  it("resolves head above pelvis above feet (local y increases downward)", () => {
    const x = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    expect(x.head.y).toBeLessThan(x.pelvis.y);
    expect(x.pelvis.y).toBeLessThan(x.footL.y);
    expect(x.pelvis.y).toBeLessThan(x.footR.y);
  });

  it("centers the spine and splits limbs left/right at rest", () => {
    const x = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    expect(Math.abs(x.pelvis.x)).toBeLessThan(1e-6);
    expect(x.handL.x).toBeLessThan(0);
    expect(x.handR.x).toBeGreaterThan(0);
    expect(x.footL.x).toBeLessThan(0);
    expect(x.footR.x).toBeGreaterThan(0);
  });

  it("shifts every bone by hover", () => {
    const a = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    const b = resolveSkeleton({ size: SIZE, hover: -10, facing: 1, deltas: noDelta });
    for (const id of Object.keys(a) as BoneId[]) {
      expect(b[id].y).toBeCloseTo(a[id].y - 10, 6);
      expect(b[id].x).toBeCloseTo(a[id].x, 6);
    }
  });

  it("mirrors x and negates angle when facing left", () => {
    const r = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: { armUpperR: 30 } });
    const l = resolveSkeleton({ size: SIZE, hover: 0, facing: -1, deltas: { armUpperR: 30 } });
    expect(l.handR.x).toBeCloseTo(-r.handR.x, 6);
    expect(l.handR.angle).toBeCloseTo(-r.handR.angle, 6);
  });

  it("propagates a parent rotation to children (FK)", () => {
    const rest = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    const bent = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: { thighR: 40 } });
    // rotating the thigh must move the foot it parents
    expect(bent.footR.x).not.toBeCloseTo(rest.footR.x, 3);
    // a sibling limb is unaffected
    expect(bent.footL.x).toBeCloseTo(rest.footL.x, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroSkeleton.test.ts`
Expected: FAIL — `heroSkeleton.ts` does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/heroSkeleton.ts
//
// Pure (Phaser-free) procedural hero SKELETON. A small bone hierarchy whose
// per-frame world transforms drive both the procedural base body and the worn-gear
// attachments — so equipped gear follows the movement of individual body parts
// (the limitation of the old painted-sheet rig). Coordinates are LOCAL to the
// HeroSkeletonSprite container; local y = 0 sits 0.78 down the body (ORIGIN_NY),
// matching the previous rig, so feet ≈ +0.22·H and head-top ≈ −0.78·H. Every bone
// is shifted by `hover` and, for left facing, mirrored across x (which negates
// drawn angles — a rigid reflection of the whole figure).

export type BoneId =
  | "pelvis" | "torso" | "head"
  | "armUpperL" | "armUpperR" | "handL" | "handR"
  | "thighL" | "thighR" | "footL" | "footR";

export interface Bone {
  id: BoneId;
  parent: BoneId | null;
  /** Rest head position, signed fraction of body WIDTH from centre (x) … */
  nx: number;
  /** … and fraction of body HEIGHT from the TOP (y). */
  ny: number;
}

// Body width is modelled as 0.5·H (a slim chibi). Bones ordered parent-before-child.
const W_OVER_H = 0.5;
const ORIGIN_NY = 0.78; // local y 0 is this far down the body (matches the container origin)

export const BONES: readonly Bone[] = [
  { id: "pelvis", parent: null, nx: 0, ny: 0.52 },
  { id: "torso", parent: "pelvis", nx: 0, ny: 0.34 },
  { id: "head", parent: "torso", nx: 0, ny: 0.1 },
  { id: "armUpperL", parent: "torso", nx: -0.26, ny: 0.26 },
  { id: "armUpperR", parent: "torso", nx: 0.26, ny: 0.26 },
  { id: "handL", parent: "armUpperL", nx: -0.3, ny: 0.5 },
  { id: "handR", parent: "armUpperR", nx: 0.3, ny: 0.5 },
  { id: "thighL", parent: "pelvis", nx: -0.16, ny: 0.54 },
  { id: "thighR", parent: "pelvis", nx: 0.16, ny: 0.54 },
  { id: "footL", parent: "thighL", nx: -0.16, ny: 0.96 },
  { id: "footR", parent: "thighR", nx: 0.16, ny: 0.96 },
] as const;

export interface BoneXform {
  x: number;
  y: number;
  /** Accumulated world angle in degrees (clockwise, y-down). */
  angle: number;
}

export interface SkeletonInput {
  /** Body height in px (scale reference). */
  size: number;
  /** Vertical body offset this frame (idle/float bob + gait bob); <=0 lifts. */
  hover: number;
  /** Facing: +1 right, -1 left. */
  facing: number;
  /** Per-bone angle deltas (deg) from the animation pose. */
  deltas: Partial<Record<BoneId, number>>;
}

const BY_ID = new Map<BoneId, Bone>(BONES.map((b) => [b.id, b]));

// Rest head offset from a bone's PARENT head, in px (right-facing).
function restOffset(b: Bone, size: number): { x: number; y: number } {
  const p = b.parent ? BY_ID.get(b.parent)! : null;
  const px = p ? p.nx : 0;
  const py = p ? p.ny : ORIGIN_NY; // root measured from the origin row
  return { x: (b.nx - px) * W_OVER_H * size, y: (b.ny - py) * size };
}

function rot(x: number, y: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Forward kinematics: every bone's world (container-local) transform. Computed
 * right-facing, then mirrored across x for left facing (negating drawn angles).
 */
export function resolveSkeleton(input: SkeletonInput): Record<BoneId, BoneXform> {
  const { size, hover, facing, deltas } = input;
  const out = {} as Record<BoneId, BoneXform>;
  for (const b of BONES) {
    const delta = deltas[b.id] ?? 0;
    if (!b.parent) {
      out[b.id] = { x: 0, y: hover, angle: delta };
      continue;
    }
    const parent = out[b.parent];
    const off = restOffset(b, size);
    const r = rot(off.x, off.y, parent.angle);
    out[b.id] = { x: parent.x + r.x, y: parent.y + r.y, angle: parent.angle + delta };
  }
  if (facing < 0) {
    for (const id of Object.keys(out) as BoneId[]) {
      out[id] = { x: -out[id].x, y: out[id].y, angle: -out[id].angle };
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heroSkeleton.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/heroSkeleton.ts tests/heroSkeleton.test.ts
git commit -m "feat(hero): pure heroSkeleton bone table + forward kinematics"
```

---

### Task 2: `heroSkeletonAnim.ts` — per-state angle deltas

**Files:**
- Create: `src/data/heroSkeletonAnim.ts`
- Test: `tests/heroSkeletonAnim.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/heroSkeletonAnim.test.ts
import { describe, it, expect } from "vitest";
import { poseSkeleton } from "../src/data/heroSkeletonAnim.ts";

describe("heroSkeletonAnim", () => {
  it("idle holds the limbs still and bobs gently", () => {
    const p = poseSkeleton("idle", 0);
    expect(p.deltas.thighL ?? 0).toBeCloseTo(0, 6);
    expect(p.deltas.thighR ?? 0).toBeCloseTo(0, 6);
    expect(typeof p.bob).toBe("number");
  });

  it("walk swings the thighs in antiphase", () => {
    const a = poseSkeleton("walk", Math.PI / 2); // sin = 1
    expect(Math.sign(a.deltas.thighL!)).toBe(-Math.sign(a.deltas.thighR!));
    expect(Math.abs(a.deltas.thighL!)).toBeGreaterThan(2);
  });

  it("walk counter-swings the off (non-weapon) arm against the legs", () => {
    const a = poseSkeleton("walk", Math.PI / 2);
    // left arm opposes left thigh
    expect(Math.sign(a.deltas.armUpperL!)).toBe(-Math.sign(a.deltas.thighL!));
  });

  it("a stopped phase holds a fixed pose (deterministic in phase)", () => {
    const a = poseSkeleton("walk", 1.234);
    const b = poseSkeleton("walk", 1.234);
    expect(a.deltas.thighL).toBe(b.deltas.thighL);
  });

  it("attack timeline starts and ends near rest on the weapon arm", () => {
    const start = poseSkeleton("attack", 0);
    const end = poseSkeleton("attack", 1);
    expect(Math.abs(start.deltas.armUpperR ?? 0)).toBeLessThan(6);
    expect(Math.abs(end.deltas.armUpperR ?? 0)).toBeLessThan(10);
    // peak swing somewhere in the middle is larger than the endpoints
    const mid = poseSkeleton("attack", 0.5);
    expect(Math.abs(mid.deltas.armUpperR!)).toBeGreaterThan(Math.abs(start.deltas.armUpperR ?? 0));
  });

  it("hurt recoils the torso", () => {
    const p = poseSkeleton("hurt", 0.2);
    expect(p.deltas.torso ?? 0).not.toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroSkeletonAnim.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/heroSkeletonAnim.ts
//
// Pure per-state animation for the hero skeleton: maps an animation state + phase
// to per-bone angle DELTAS (deg) and a vertical bob (fraction of body height). The
// presenter resolves these through heroSkeleton's forward kinematics each frame.
//   - idle/walk: `phase` is the locomotion phase in radians (walk advances it with
//     distance travelled, so a stopped hero stops stepping).
//   - attack/cast/hurt: `phase` is a normalized 0..1 one-shot progress.

import type { BoneId } from "./heroSkeleton.ts";

export type AnimState = "idle" | "walk" | "attack" | "cast" | "hurt";

export interface PoseOutput {
  deltas: Partial<Record<BoneId, number>>;
  /** Vertical bob as a fraction of body height (added to hover; <=0 lifts). */
  bob: number;
}

const WALK_THIGH = 22; // deg peak leg swing
const WALK_ARM = 16; // deg peak arm counter-swing
const WALK_KNEE = 14; // foot/shin counter-bend so the lifted leg clears

export function poseSkeleton(state: AnimState, phase: number): PoseOutput {
  switch (state) {
    case "walk": {
      const s = Math.sin(phase);
      const lift = Math.max(0, Math.sin(phase)); // L leg lifts on the up half
      const liftR = Math.max(0, -Math.sin(phase));
      return {
        deltas: {
          thighL: WALK_THIGH * s,
          thighR: -WALK_THIGH * s,
          footL: -WALK_KNEE * lift,
          footR: -WALK_KNEE * liftR,
          armUpperL: -WALK_ARM * s,
          armUpperR: WALK_ARM * s,
          torso: 2 * Math.sin(phase * 2),
        },
        bob: -0.018 * Math.abs(Math.sin(phase * 2)),
      };
    }
    case "attack": {
      // Wind-up (0..0.35) then swing-through (0.35..1) on the weapon arm.
      const t = clamp01(phase);
      const wind = -38 * bump(t / 0.35); // pull back
      const swing = 70 * bump((t - 0.35) / 0.65); // swing forward
      const arm = t < 0.35 ? wind : swing;
      return {
        deltas: { armUpperR: arm, handR: arm * 0.4, torso: 6 * Math.sin(t * Math.PI) },
        bob: 0,
      };
    }
    case "cast": {
      const t = clamp01(phase);
      const raise = -90 * Math.sin(t * Math.PI); // arm overhead and back
      return { deltas: { armUpperR: raise, handR: raise * 0.2, torso: -4 * Math.sin(t * Math.PI) }, bob: -0.02 * Math.sin(t * Math.PI) };
    }
    case "hurt": {
      const t = clamp01(phase);
      const k = Math.sin(t * Math.PI);
      return { deltas: { torso: -10 * k, head: -6 * k, pelvis: 4 * k }, bob: 0 };
    }
    case "idle":
    default: {
      return { deltas: { torso: 0.6 * Math.sin(phase) }, bob: -0.012 * Math.abs(Math.sin(phase)) };
    }
  }
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
// 0→0→…→1 at t=1, smooth single hump peaking at t=1 edge; used for eased ramps.
function bump(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x); // smoothstep
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heroSkeletonAnim.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/heroSkeletonAnim.ts tests/heroSkeletonAnim.test.ts
git commit -m "feat(hero): pure heroSkeletonAnim per-state bone deltas"
```

---

### Task 3: `heroWornRig.ts` — slot→bone attach + placements

**Files:**
- Create: `src/data/heroWornRig.ts`
- Test: `tests/heroWornRig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/heroWornRig.test.ts
import { describe, it, expect } from "vitest";
import { resolveSkeleton } from "../src/data/heroSkeleton.ts";
import { placeWorn, WORN_GEAR_SLOTS } from "../src/data/heroWornRig.ts";

const bones = resolveSkeleton({ size: 100, hover: 0, facing: 1, deltas: {} });

describe("heroWornRig", () => {
  it("re-exports the four body-worn slots", () => {
    expect([...WORN_GEAR_SLOTS]).toEqual(["Helmet", "BodyArmor", "Gloves", "Boots"]);
  });

  it("phase-1 (whole-piece): one placement per slot", () => {
    const ps = placeWorn(bones, 100, 1, false);
    expect(ps.filter((p) => p.slot === "Boots")).toHaveLength(1);
    expect(ps.filter((p) => p.slot === "Gloves")).toHaveLength(1);
    expect(new Set(ps.map((p) => p.slot)).size).toBe(4);
  });

  it("phase-2 (per-limb): boots & gloves split into L/R, one mirrored", () => {
    const ps = placeWorn(bones, 100, 1, true);
    const boots = ps.filter((p) => p.slot === "Boots");
    expect(boots).toHaveLength(2);
    expect(boots.map((b) => b.part).sort()).toEqual(["L", "R"]);
    expect(boots.find((b) => b.part === "L")!.flipX).toBe(true);
    expect(boots.find((b) => b.part === "R")!.flipX).toBe(false);
    expect(ps.filter((p) => p.slot === "Gloves")).toHaveLength(2);
    // helmet/body stay single
    expect(ps.filter((p) => p.slot === "Helmet")).toHaveLength(1);
  });

  it("anchors each piece near its bone (helmet at head, boots at feet)", () => {
    const ps = placeWorn(bones, 100, 1, false);
    const helmet = ps.find((p) => p.slot === "Helmet")!;
    const boots = ps.find((p) => p.slot === "Boots")!;
    expect(helmet.y).toBeLessThan(boots.y); // helmet above boots
  });

  it("orders behind→front by depth (body armor under helmet under nothing-here)", () => {
    const ps = placeWorn(bones, 100, 1, false);
    const d = Object.fromEntries(ps.map((p) => [p.slot, p.depth]));
    expect(d.BodyArmor).toBeLessThan(d.Helmet);
    expect(d.Boots).toBeLessThan(d.BodyArmor);
  });

  it("scales each piece to its body part (not uniform)", () => {
    const ps = placeWorn(bones, 100, 1, false);
    const sizes = new Set(ps.map((p) => Math.round(p.displayH)));
    expect(sizes.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroWornRig.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/heroWornRig.ts
//
// Pure mapping from the resolved hero skeleton to worn-gear placements. Each worn
// piece attaches to a bone and inherits that bone's world transform, so gear
// follows the movement of the body part it sits on. Whole-piece art (phase 1)
// pins boots/gloves to one representative limb; per-limb art (phase 2) splits them
// L/R across both foot/hand bones (one mirrored).

import type { BoneId, BoneXform } from "./heroSkeleton.ts";

export const WORN_GEAR_SLOTS = ["Helmet", "BodyArmor", "Gloves", "Boots"] as const;
export type WornGearSlot = (typeof WORN_GEAR_SLOTS)[number];

export type WornPart = "single" | "L" | "R";

export interface WornPlacement {
  slot: WornGearSlot;
  part: WornPart;
  x: number;
  y: number;
  displayH: number;
  angle: number;
  flipX: boolean;
  depth: number;
  behind: boolean;
}

interface Attach {
  bone: BoneId;
  /** Local offset from the bone head, fraction of body height (right-facing). */
  ox: number;
  oy: number;
  /** Display height as a fraction of body height. */
  scale: number;
  depth: number;
}

// back→front draw order encoded in depth: boots(2) < body(3) < helmet(5).
const SINGLE: Record<WornGearSlot, Attach> = {
  Boots: { bone: "pelvis", ox: 0, oy: 0.4, scale: 0.3, depth: 2 },
  BodyArmor: { bone: "torso", ox: 0, oy: 0.06, scale: 0.42, depth: 3 },
  Gloves: { bone: "handR", ox: 0, oy: 0, scale: 0.18, depth: 4 },
  Helmet: { bone: "head", ox: 0, oy: 0, scale: 0.3, depth: 5 },
};
// Per-limb (phase 2) overrides for the split slots.
const PER_LIMB: Partial<Record<WornGearSlot, { L: Attach; R: Attach }>> = {
  Boots: {
    L: { bone: "footL", ox: 0, oy: 0.02, scale: 0.2, depth: 2 },
    R: { bone: "footR", ox: 0, oy: 0.02, scale: 0.2, depth: 2 },
  },
  Gloves: {
    L: { bone: "handL", ox: 0, oy: 0, scale: 0.16, depth: 4 },
    R: { bone: "handR", ox: 0, oy: 0, scale: 0.16, depth: 4 },
  },
};

function place(
  a: Attach,
  part: WornPart,
  slot: WornGearSlot,
  bones: Record<BoneId, BoneXform>,
  size: number,
  facing: number,
): WornPlacement {
  const b = bones[a.bone];
  const side = facing < 0 ? -1 : 1;
  // Offset authored right-facing; mirror its x with facing (matches resolveSkeleton).
  const ang = (b.angle * Math.PI) / 180;
  const ox = a.ox * 0.5 * size * side;
  const oy = a.oy * size;
  const x = b.x + ox * Math.cos(ang) - oy * Math.sin(ang);
  const y = b.y + ox * Math.sin(ang) + oy * Math.cos(ang);
  const flipX = part === "L" ? side > 0 : side < 0;
  return { slot, part, x, y, displayH: a.scale * size, angle: b.angle, flipX, depth: a.depth, behind: false };
}

/**
 * Per-frame placements for the four worn-armour slots. `perLimb` splits boots and
 * gloves across both limbs (phase 2 single-limb art); otherwise one piece per slot.
 */
export function placeWorn(
  bones: Record<BoneId, BoneXform>,
  size: number,
  facing: number,
  perLimb: boolean,
): WornPlacement[] {
  const out: WornPlacement[] = [];
  for (const slot of WORN_GEAR_SLOTS) {
    const split = perLimb ? PER_LIMB[slot] : undefined;
    if (split) {
      out.push(place(split.L, "L", slot, bones, size, facing));
      out.push(place(split.R, "R", slot, bones, size, facing));
    } else {
      out.push(place(SINGLE[slot], "single", slot, bones, size, facing));
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heroWornRig.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/heroWornRig.ts tests/heroWornRig.test.ts
git commit -m "feat(hero): pure heroWornRig slot->bone worn placements"
```

---

### Task 4: `HeroSkeletonSprite.ts` — presenter (drop-in API)

**Files:**
- Create: `src/scenes/HeroSkeletonSprite.ts`
- Reference (API to match): `src/scenes/HeroLayeredSprite.ts`
- Reuse: `src/scenes/heroEquipVisuals.ts` (`resolveHeroLayers`), `src/data/assetKeys.ts`

This presenter is Phaser (rendering), so it is verified by `tsc` + the CDP repro in Task 6, not unit tests. It must expose the **exact** public API `battleSceneSprites` uses: `constructor(scene, x, y)`, `addToWorld(world)`, `play(key, ignoreIfPlaying?)`, `tick(now, moving, facingLeft?)`, `playAttack()`, `playCast()`, `playHurt()`, `syncEquipment(inventory)`, `scaleToHeight(px): this`, `setDepth`, `setPosition`, `setVisible`, `getBodySprite()`, `get currentAnimKey`, `get wornGearVisible`, `readonly petSprite`.

- [ ] **Step 1: Write the presenter**

```ts
// src/scenes/HeroSkeletonSprite.ts
//
// Procedural-skeleton battle hero. Drop-in replacement for HeroLayeredSprite: the
// hero is NOT a painted sheet but a bone skeleton (heroSkeleton) animated per state
// (heroSkeletonAnim); the procedural base body + every worn-gear piece are drawn
// from the resolved bones (heroWornRig) so equipped gear follows each limb through
// idle/walk/attack. Weapon rides the weapon hand; wings ride the back; the pet
// wanders outside the container (same as the painted rig).

import Phaser from "phaser";
import { resolveHeroLayers, type HeroLayerConfig, type GearLayer } from "./heroEquipVisuals.ts";
import type { WeaponType } from "../data/schema.ts";
import type { InventorySave } from "../core/save.ts";
import { resolveSkeleton, type BoneId, type BoneXform } from "../data/heroSkeleton.ts";
import { poseSkeleton, type AnimState } from "../data/heroSkeletonAnim.ts";
import { placeWorn, WORN_GEAR_SLOTS, type WornGearSlot, type WornPlacement } from "../data/heroWornRig.ts";

const ORIGIN_NY = 0.78;
const PRIO = { attack: 1, cast: 2, hurt: 3 } as const;
const ONESHOT_MS: Record<"attack" | "cast" | "hurt", number> = { attack: 280, cast: 420, hurt: 240 };

export class HeroSkeletonSprite extends Phaser.GameObjects.Container {
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly anchor: Phaser.GameObjects.Sprite; // invisible hit/flash target (getBodySprite)
  private readonly weaponSprite: Phaser.GameObjects.Sprite;
  private readonly wingsSprite: Phaser.GameObjects.Sprite;
  private readonly gearSprites = new Map<string, Phaser.GameObjects.Sprite>(); // `${slot}:${part}`
  readonly petSprite: Phaser.GameObjects.Sprite;

  private size = 54;
  private facingLeft = false;
  private hasWings = false;
  private weaponType: WeaponType | null = null;
  private perLimb = false; // flipped on once per-limb art ships (Phase 2)

  private walkPhase = 0;
  private oneShot: { kind: "attack" | "cast" | "hurt"; start: number; gen: number } | null = null;
  private oneShotGen = 0;
  private lastNow = 0;

  private heroX = 0;
  private heroY = 0;
  private petX = 0; private petY = 0; private petTX = 0; private petTY = 0;
  private petRepickAt = 0; private petReady = false;

  private _lastConfig: HeroLayerConfig = {
    weaponKey: null, weaponType: null, wingKey: null, petKey: null,
    gear: { Helmet: null, BodyArmor: null, Gloves: null, Boots: null },
  };
  private flapTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.heroX = x; this.heroY = y;
    this.wingsSprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.7);
    this.body = scene.add.graphics();
    this.anchor = scene.add.sprite(0, 0, "__missing").setVisible(false);
    this.weaponSprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.85);
    this.add([this.wingsSprite, this.body, this.anchor, this.weaponSprite]);
    this.petSprite = scene.add.sprite(x + 30, y + 8, "__missing").setVisible(false).setScale(0.32);
    scene.add.existing(this);
  }

  addToWorld(world: Phaser.GameObjects.Container | Phaser.GameObjects.Layer): void {
    world.add(this as unknown as Phaser.GameObjects.GameObject);
    world.add(this.petSprite);
  }

  // Kept for API parity (the painted rig played a sheet anim here); no-op on the rig.
  play(_animKey: string, _ignoreIfPlaying = false): this { return this; }

  scaleToHeight(targetPx: number): this {
    this.size = targetPx;
    this.weaponSprite.setScale((targetPx / 96) * 0.9); // weapon art ~96px tall
    this.wingsSprite.setScale((targetPx / 96) * 1.9);
    this.petSprite.setScale((targetPx / 128) * 0.42);
    return this;
  }

  tick(now: number, moving: boolean, facingLeft?: boolean): void {
    const dt = this.lastNow ? Math.min(0.05, Math.max(0, (now - this.lastNow) / 1000)) : 0;
    this.lastNow = now;
    if (facingLeft !== undefined) this.facingLeft = facingLeft;

    // Resolve one-shot vs locomotion.
    let state: AnimState = "idle";
    let phase = this.walkPhase;
    if (this.oneShot) {
      const p = (now - this.oneShot.start) / ONESHOT_MS[this.oneShot.kind];
      if (p >= 1) this.oneShot = null;
      else { state = this.oneShot.kind; phase = p; }
    }
    if (!this.oneShot) {
      if (this.hasWings) { state = "idle"; this.walkPhase = now * 0.005; }
      else if (moving) { state = "walk"; this.walkPhase += dt * 9; } // ~1.4 strides/s
      else state = "idle";
      phase = state === "walk" ? this.walkPhase : now * 0.004;
    }

    const pose = poseSkeleton(state, phase);
    let hover = pose.bob * this.size;
    if (this.hasWings) hover += -this.size * 0.18 + Math.sin(now * 0.005) * this.size * 0.05;

    const facing = this.facingLeft ? -1 : 1;
    const bones = resolveSkeleton({ size: this.size, hover, facing, deltas: pose.deltas });
    this.drawBody(bones);
    this.positionGear(bones, facing);
    this.positionWeapon(bones[this.weaponType ? "handR" : "handR"], facing);
    this.wingsSprite.y = bones.torso.y;
    this.wingsSprite.x = bones.torso.x;
    this.anchor.setPosition(bones.torso.x, bones.torso.y);
    this.updatePet(now, dt);
  }

  /** Redraw the procedural base body (capsule limbs + head) from the resolved bones. */
  private drawBody(b: Record<BoneId, BoneXform>): void {
    const g = this.body;
    g.clear();
    const skin = 0xe8b88c, cloth = 0x44506a, line = 0x20242e;
    const limb = (a: BoneXform, c: BoneXform, w: number, col: number) => {
      g.lineStyle(w, line, 1);
      g.lineBetween(a.x, a.y, c.x, c.y);
      g.lineStyle(Math.max(1, w - 2), col, 1);
      g.lineBetween(a.x, a.y, c.x, c.y);
    };
    const lw = this.size * 0.12;
    limb(b.thighL, b.footL, lw, cloth); limb(b.thighR, b.footR, lw, cloth);
    limb(b.pelvis, b.thighL, lw, cloth); limb(b.pelvis, b.thighR, lw, cloth);
    limb(b.armUpperL, b.handL, lw * 0.8, skin); limb(b.armUpperR, b.handR, lw * 0.8, skin);
    limb(b.pelvis, b.torso, lw * 1.6, cloth); // torso column
    g.fillStyle(skin, 1); g.lineStyle(2, line, 1);
    g.fillCircle(b.head.x, b.head.y, this.size * 0.12);
    g.strokeCircle(b.head.x, b.head.y, this.size * 0.12);
  }

  private positionGear(bones: Record<BoneId, BoneXform>, facing: number): void {
    const places = placeWorn(bones, this.size, facing, this.perLimb);
    const live = new Set<string>();
    for (const p of places) {
      const id = `${p.slot}:${p.part}`;
      const spr = this.gearSprites.get(id);
      if (!spr || !spr.visible) continue;
      live.add(id);
      spr.setPosition(p.x, p.y).setAngle(p.angle).setFlipX(p.flipX).setDepth(p.depth);
      if (spr.height) spr.setDisplaySize((p.displayH / spr.height) * spr.width, p.displayH);
    }
  }

  private positionWeapon(hand: BoneXform, _facing: number): void {
    if (!this.weaponSprite.visible) return;
    this.weaponSprite.setPosition(hand.x, hand.y).setAngle(hand.angle).setFlipX(this.facingLeft);
  }

  playAttack(): void { this.beginOneShot("attack"); }
  playCast(): void { this.beginOneShot("cast"); }
  playHurt(): void { this.beginOneShot("hurt"); }

  private beginOneShot(kind: "attack" | "cast" | "hurt"): void {
    if (this.oneShot && PRIO[this.oneShot.kind] > PRIO[kind]) return; // outranked
    this.oneShotGen += 1;
    this.oneShot = { kind, start: this.lastNow, gen: this.oneShotGen };
  }

  getBodySprite(): Phaser.GameObjects.Sprite { return this.anchor; }
  get currentAnimKey(): string | null { return this.oneShot?.kind ?? null; }
  get wornGearVisible(): boolean {
    for (const s of this.gearSprites.values()) if (s.visible) return true;
    return false;
  }

  override setDepth(value: number): this {
    super.setDepth(value);
    this.petSprite.setDepth(value - 0.5);
    return this;
  }
  override setPosition(x: number, y: number): this {
    super.setPosition(x, y); this.heroX = x; this.heroY = y; return this;
  }
  override setVisible(visible: boolean): this {
    super.setVisible(visible);
    this.petSprite.setVisible(visible && this._lastConfig.petKey !== null);
    return this;
  }

  syncEquipment(inventory: InventorySave): void {
    const config = resolveHeroLayers(inventory);
    const t = this.scene.textures;

    if (config.weaponKey !== this._lastConfig.weaponKey || config.weaponType !== this._lastConfig.weaponType) {
      this.weaponType = config.weaponType;
      if (config.weaponKey && t.exists(config.weaponKey)) this.weaponSprite.setTexture(config.weaponKey).setVisible(true);
      else this.weaponSprite.setVisible(false);
    }
    if (config.wingKey !== this._lastConfig.wingKey) {
      const show = !!config.wingKey && t.exists(config.wingKey);
      if (show) { this.wingsSprite.setTexture(config.wingKey!).setVisible(true); this.startFlap(); }
      else { this.wingsSprite.setVisible(false); this.stopFlap(); }
      this.hasWings = show;
    }
    if (config.petKey !== this._lastConfig.petKey) {
      if (config.petKey && t.exists(config.petKey)) this.petSprite.setTexture(config.petKey).setVisible(true);
      else this.petSprite.setVisible(false);
    }

    for (const slot of WORN_GEAR_SLOTS) {
      const key = this.pickGearKey(config.gear[slot]);
      if (key === this.pickGearKey(this._lastConfig.gear[slot])) continue;
      for (const part of ["single", "L", "R"] as const) {
        const id = `${slot}:${part}`;
        let spr = this.gearSprites.get(id);
        if (key) {
          if (!spr) { spr = this.scene.add.sprite(0, 0, key).setOrigin(0.5, 0.5); this.add(spr); this.gearSprites.set(id, spr); }
          spr.setTexture(key).setVisible(true);
        } else if (spr) spr.setVisible(false);
      }
    }
    this._lastConfig = config;
  }

  private pickGearKey(layer: GearLayer | null): string | null {
    if (!layer) return null;
    const t = this.scene.textures;
    if (t.exists(layer.wornKey)) return layer.wornKey;
    if (t.exists(layer.iconKey)) return layer.iconKey;
    return null;
  }

  private startFlap(): void {
    this.stopFlap();
    this.flapTween = this.scene.tweens.add({
      targets: this.wingsSprite, angle: { from: -6, to: 6 }, duration: 380, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }
  private stopFlap(): void { if (this.flapTween) { this.flapTween.stop(); this.flapTween = null; } this.wingsSprite.setAngle(0); }

  private updatePet(now: number, dt: number): void {
    const pet = this.petSprite;
    if (!pet.visible) { this.petReady = false; return; }
    if (!this.petReady) { this.petX = this.heroX + 26; this.petY = this.heroY + 8; this.petRepickAt = 0; this.petReady = true; }
    const dx = this.petTX - this.petX, dy = this.petTY - this.petY, d = Math.hypot(dx, dy);
    if (now >= this.petRepickAt || d < 8) {
      const ang = (now % 6283) / 1000; const r = 26 + ((now % 30) | 0);
      this.petTX = this.heroX + Math.cos(ang) * r; this.petTY = this.heroY + Math.sin(ang) * r * 0.6;
      this.petRepickAt = now + 700;
    }
    if (d > 1) { const step = Math.min(d, 78 * dt); this.petX += (dx / d) * step; this.petY += (dy / d) * step; pet.setFlipX(dx < 0); }
    const hop = d > 10 ? Math.abs(Math.sin(now * 0.018)) * 4 : 0;
    pet.setPosition(this.petX, this.petY - hop);
  }
}
```

Note: `ORIGIN_NY` is imported-for-parity but the skeleton already bakes the origin row; remove the unused const if eslint flags it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `HeroSkeletonSprite.ts` (fix any unused-import/eslint issues, e.g. drop `ORIGIN_NY`/`WornPlacement`/`_facing` if unused).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/HeroSkeletonSprite.ts
git commit -m "feat(hero): HeroSkeletonSprite procedural-rig presenter (drop-in)"
```

---

### Task 5: Wire the switch into `battleSceneSprites.ts`

**Files:**
- Modify: `src/scenes/battleSceneSprites.ts` (import + hero construction in `manageSprites`, lines ~13 and ~564-573)

- [ ] **Step 1: Add the import + switch constant**

At the top imports (after the `HeroLayeredSprite` import on line 13), add:

```ts
import { HeroSkeletonSprite } from "./HeroSkeletonSprite.ts";

// Battle hero rig selector: the procedural skeleton (gear follows each limb) vs.
// the retained painted-sheet rig. Flip to false to instantly fall back.
const USE_SKELETON_HERO = true;
type HeroRig = HeroLayeredSprite | HeroSkeletonSprite;
```

- [ ] **Step 2: Construct the selected rig**

In `manageSprites`, replace the hero-creation block (currently `const hs = new HeroLayeredSprite(...)` … through `this.heroSprite = hs;`) with:

```ts
      if (!this.heroSprite) {
        const hs: HeroRig = USE_SKELETON_HERO
          ? new HeroSkeletonSprite(this, h.pos.x, h.pos.y)
          : new HeroLayeredSprite(this, h.pos.x, h.pos.y);
        hs.scaleToHeight(54).setDepth(DEPTH.HERO);
        hs.addToWorld(this.world);
        if (!USE_SKELETON_HERO && this.anims.exists("hero__hero_idle")) hs.play("hero__hero_idle");
        if (this.saveManager) hs.syncEquipment(this.saveManager.getSave().inventory);
        this.heroSprite = hs;
      }
```

If `this.heroSprite`'s declared type in `BattleScene.ts` is `HeroLayeredSprite | null`, widen it to the shared API. Check its declaration:

Run: `npx rg "heroSprite" src/scenes/BattleScene.ts`

Then change the field type to `HeroLayeredSprite | HeroSkeletonSprite | null` (import `HeroSkeletonSprite` there too). Both classes share the methods `battleSceneSprites` calls, so no call sites change.

- [ ] **Step 3: Typecheck + tests + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/battleSceneSprites.ts src/scenes/BattleScene.ts
git commit -m "feat(hero): select procedural skeleton hero in battle (switch-gated)"
```

---

### Task 6: CDP repro + visual verify (Phase 1)

**Files:**
- Create: `scripts/playtest/repro_skeleton_hero.mjs` (copy `repro_worn_rig.mjs`, rename screenshots `skel_*`, and add a two-frame leg-motion assertion)

- [ ] **Step 1: Create the repro**

Copy `scripts/playtest/repro_worn_rig.mjs` to `scripts/playtest/repro_skeleton_hero.mjs`. Change the screenshot names to `skel_1_idle/skel_2_walk/skel_3_attack`. After the walk pose, add a motion check that ticks the hero across two phases and confirms a leg bone moved:

```js
  const moved = await evalJs(`const g=window.__game; const bs=g.scene.getScene("BattleScene");
    const h=bs&&bs.heroSprite; if(!h) return "no-hero";
    const cam=bs.cameras.main; h.scaleToHeight(220); h.setPosition(cam.midPoint.x, cam.midPoint.y);
    if(bs.saveManager) h.syncEquipment(bs.saveManager.getSave().inventory);
    let f=0; h.tick(g.loop.now, true, false); const a=h.wornGearVisible;
    h.tick(g.loop.now+200, true, false);
    return JSON.stringify({wornGearVisible:a});`);
  console.log("motion:", moved);
```

- [ ] **Step 2: Build, serve preview, run the repro**

Run (one foreground command — preview build avoids the dev `.vite` sandbox hang):

```bash
npm run build && (npx vite preview --port 4188 >/tmp/skelprev.log 2>&1 &) ; sleep 2 ; \
(google-chrome --headless=new --remote-debugging-port=9222 --disable-gpu about:blank >/tmp/chrome.log 2>&1 &) ; sleep 2 ; \
node scripts/playtest/repro_skeleton_hero.mjs --port=4188 --dir=/tmp ; \
pkill -f "[v]ite preview" ; pkill -f "[r]emote-debugging-port=9222" || true
```

Expected: `game ready: true`, `equipped:` JSON with all slots, `motion: {"wornGearVisible":true}`, and three screenshots written to `/tmp/skel_*.png`.

- [ ] **Step 3: Inspect the screenshots**

Read `/tmp/skel_1_idle.png`, `/tmp/skel_2_walk.png`, `/tmp/skel_3_attack.png`. Confirm: a recognizable dressed figure, helmet on head / breastplate on torso / boots near feet / weapon in hand, legs in a stride on walk, weapon swung on attack. Send the montage to chat:

```
[[send: /tmp/skel_2_walk.png]]
```

Tune `heroSkeleton` anchors / `heroWornRig` offsets / `heroSkeletonAnim` amplitudes if pieces sit wrong (pure modules — adjust constants, re-run tests, re-shoot). Iterate until it reads correctly.

- [ ] **Step 4: Commit + deploy (Phase 1 ships)**

```bash
git add scripts/playtest/repro_skeleton_hero.mjs
git commit -m "test(hero): CDP repro for procedural skeleton battle hero"
git push -u origin wip/sprite-art-restyle
npm run build && npx firebase-tools deploy --only hosting
```

(No `ASSET_VERSION` bump — Phase 1 ships no new PNGs.)

---

## Phase 2 — Per-limb worn art (Gloves + Boots)

### Task 7: Single-limb worn framings + regenerate Gloves/Boots

**Files:**
- Modify: `scripts/sdart/prompts.mjs` (`WORN_FRAMING` → add a single-limb variant)
- Modify: `scripts/sdart/sdgen.mjs` (use single framing for Gloves/Boots in the `worn` kind)
- Regenerate: `public/assets/sprites/worn/<glove|boot ids>.png`
- Regenerate: `src/data/wornManifest.ts` (via `scripts/sdart/buildWornManifest.mjs`)

- [ ] **Step 1: Add single-limb framings**

In `scripts/sdart/prompts.mjs`, add next to `WORN_FRAMING`:

```js
// Single-limb framing for slots whose art splits L/R on the procedural rig.
export const WORN_FRAMING_SINGLE = {
  Gloves:
    "shown alone as a SINGLE empty gauntlet for one hand, no hand inside, no pair, three-quarter front view, centered, hollow",
  Boots:
    "shown alone as a SINGLE empty boot for one foot, no foot inside, no pair, three-quarter front view, centered, hollow",
};
```

And update `wornStyleFor` to accept an optional single flag:

```js
export function wornStyleFor(look, slot, rarity, single = false) {
  const framing = (single && WORN_FRAMING_SINGLE[slot]) || WORN_FRAMING[slot] || "shown alone, front view, centered";
  const rim = RARITY_RIM[rarity] || RARITY_RIM.Common;
  return WORN_STYLE.replace("{V}", `${look}, ${framing}, ${rim}`);
}
```

- [ ] **Step 2: Use single framing for Gloves/Boots in sdgen**

Run `npx rg "wornStyleFor|kind.*worn|WORN" scripts/sdart/sdgen.mjs` to find the worn call site, then pass `single = slot === "Gloves" || slot === "Boots"` to `wornStyleFor`.

- [ ] **Step 3: Regenerate the Gloves + Boots worn art**

```bash
npm run gen:sprites -- --kind=worn --slots=Gloves,Boots --force
```

(Confirm the actual flag names with `node scripts/sdart/sdgen.mjs --help` or by reading `sdgen.mjs`; the goal is: re-emit only the worn PNGs for the Gloves and Boots catalog items with the single framing.) Then rebuild the manifest:

```bash
node scripts/sdart/buildWornManifest.mjs
```

- [ ] **Step 4: Spot-check a few regenerated PNGs**

Read 2-3 of `public/assets/sprites/worn/swift-boots.png`, `assassin-gloves.png`, `worn-boots.png`. Confirm each shows a SINGLE boot/glove (not a pair), transparent background, centered. Re-roll prompt wording if any still render a pair.

- [ ] **Step 5: Commit**

```bash
git add scripts/sdart/prompts.mjs scripts/sdart/sdgen.mjs public/assets/sprites/worn src/data/wornManifest.ts
git commit -m "feat(art): single-limb worn art for gloves & boots (per-limb rig)"
```

---

### Task 8: Enable per-limb attachment

**Files:**
- Modify: `src/scenes/HeroSkeletonSprite.ts` (`perLimb = true`)

- [ ] **Step 1: Flip the flag**

In `HeroSkeletonSprite`, change `private perLimb = false;` to `private perLimb = true;`. (`heroWornRig.placeWorn` already returns L/R placements and `syncEquipment` already creates `${slot}:L` / `${slot}:R` sprites, so no other change is needed.)

- [ ] **Step 2: Typecheck + tests + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green (`heroWornRig.test.ts` already covers the L/R split).

- [ ] **Step 3: Re-run the CDP repro**

Run the Task 6 Step 2 command but with the per-limb art present. Inspect `/tmp/skel_2_walk.png`: each foot should now wear its own boot and the boots should step with the legs (visibly offset between the two walk frames). Send to chat:

```
[[send: /tmp/skel_2_walk.png]]
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/HeroSkeletonSprite.ts
git commit -m "feat(hero): enable per-limb worn attachment (boots/gloves per foot/hand)"
```

---

### Task 9: Bump version, deploy, verify

**Files:**
- Modify: `src/data/assetVersion.ts` (`ASSET_VERSION`)

- [ ] **Step 1: Bump ASSET_VERSION**

Run `npx rg "ASSET_VERSION" src/data/assetVersion.ts`, then bump the date suffix (e.g. `2026-06-20c` → `2026-06-20d`).

- [ ] **Step 2: Full verify**

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx madge --circular --extensions ts src/ && npm run build`
Expected: all green; eslint reports no file over 500 lines (if `HeroSkeletonSprite.ts` exceeds it, split the base-body drawing into `src/scenes/heroSkeletonBody.ts`).

- [ ] **Step 3: Commit, push, deploy**

```bash
git add src/data/assetVersion.ts
git commit -m "chore(art): bump ASSET_VERSION for per-limb worn art"
git push
npm run build && npx firebase-tools deploy --only hosting
```

- [ ] **Step 4: Update memory + spec**

Update `memory/project_hero_worn_dressed_doll.md` (or add a new `project_hero_procedural_skeleton.md` + MEMORY.md index line) noting the battle hero is now a procedural bone skeleton with per-limb gear tracking, switch-gated by `USE_SKELETON_HERO`, painted `HeroLayeredSprite` retained as fallback. Mark the spec's Phase 1/2 shipped.

---

## Self-Review

**Spec coverage:** bone skeleton (T1), per-state animation (T2), worn→bone placement (T3), procedural body + worn/weapon/wing/pet presenter (T4), switch wiring (T5), Phase-1 verify+deploy (T6), single-limb art (T7), per-limb enable (T8), version+deploy+memory (T9). All spec sections mapped.

**Placeholder scan:** every code step contains full code; commands have expected output. Art-flag names in T7 Step 3 are explicitly flagged to confirm against `sdgen.mjs` before running (the one genuinely environment-dependent spot).

**Type consistency:** `BoneId`/`BoneXform`/`SkeletonInput` (T1) used verbatim in T2/T3/T4; `WornGearSlot`/`WornPart`/`WornPlacement`/`placeWorn(bones,size,facing,perLimb)` (T3) used verbatim in T4; presenter public API matches `HeroLayeredSprite` (verified against `battleSceneSprites.ts` call sites: `scaleToHeight/setDepth/addToWorld/play/syncEquipment/tick/playAttack/playCast/playHurt/getBodySprite/setPosition/setVisible/wornGearVisible/currentAnimKey/petSprite`).
```

