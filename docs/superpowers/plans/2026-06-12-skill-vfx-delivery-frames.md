# Skill VFX — Source-Delivery + Multi-Beat Choreography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every hero skill cast visibly *arrive from a source* (fly from caster, fall from sky, erupt from ground, beam from caster) as a ≥4-beat animated sequence, so casts read as cool, impressive and lively.

**Architecture:** Thread the caster's world position (`from`) end-to-end into the `cast` FxEvent. Add a data-driven `delivery` archetype per skill plus a reusable `renderDelivery` choreography layer that plays *before* the existing impact signature and calls `onArrive()` to fire it. Extract the shared `VfxDraw` kit into its own module so all touched files stay under the 500-line limit. Pure presentation — no gameplay/damage change.

**Tech Stack:** TypeScript, Phaser 3 (tweens + shapes, no art assets), Vitest.

---

## File Structure

- **Create `src/scenes/vfxDraw.ts`** — the `VfxDraw` drawing kit (moved verbatim from `skillSignatures.ts`) + 5 new travel primitives (`chargeGlow`, `orbTravel`, `fallStreak`, `riser`, `marker`). Shared by signatures + delivery.
- **Create `src/scenes/skillDelivery.ts`** — `DeliveryFn` per kind + `renderDelivery(d, kind, from, at, palette, radius, onArrive)`.
- **Modify `src/data/skillVfxMeta.ts`** — add `DeliveryKind` type + `DELIVERY_KINDS`, add `delivery` to each of 14 specs, add `deliveryForStyle(style)`.
- **Modify `src/scenes/skillSignatures.ts`** — import `VfxDraw` from `vfxDraw.ts` (delete the inline class); top up the 3 thinnest signatures with an aftermath beat.
- **Modify `src/scenes/skillVfx.ts`** — `cast(from, at, radius, skillId, source)` runs `renderDelivery` then fires impact on arrival; pass `from` into element fallbacks too.
- **Modify `src/core/battleTypes.ts`** — `cast` event gains `from: Vec2`.
- **Modify `src/core/battleDamage.ts`** — `castActive` gains `from: Vec2` param, emits it.
- **Modify `src/core/battle.ts`** (line 482) — pass `h.pos`.
- **Modify `src/core/battleTowers.ts`** (line 77) — pass `t.pos`.
- **Modify `src/scenes/fx.ts`** (line 80) — pass `e.from` to `skillVfx.cast`.
- **Modify `tests/skillVfx.test.ts`** — add delivery-coverage + `from`-plumbing tests.

---

## Task 1: Plumb the caster position (`from`) end-to-end

This is the enabling change: without `from`, "fly from source" cannot be rendered. Damage still lands at `at`; `from` is presentation-only.

**Files:**
- Modify: `src/core/battleTypes.ts:46`
- Modify: `src/core/battleDamage.ts:250-262`
- Modify: `src/core/battle.ts:482`
- Modify: `src/core/battleTowers.ts:77`
- Modify: `src/scenes/fx.ts:79-81`
- Test: `tests/skillVfx.test.ts`

- [x] **Step 1: Write the failing test** — append to the `hero cast plumbing` describe block in `tests/skillVfx.test.ts` (before its closing `});`):

```ts
  it("tags the cast event with the caster's position (fly-from-source plumbing)", () => {
    const b = heroBattleCasting("execute-slash");
    b.hero.stats.range = 400;
    b.hero.stats.attackSpeed = 10;
    let castFrom: { x: number; y: number } | null = null;
    let heroPos: { x: number; y: number } | null = null;
    for (let t = 0; t < 160 && castFrom === null; t++) {
      b.hero.mana = MANA_MAX;
      heroPos = { x: b.hero.pos.x, y: b.hero.pos.y };
      b.tick(0.05);
      for (const fx of b.fx) if (fx.type === "cast" && fx.source === "hero") castFrom = fx.from;
    }
    expect(castFrom).not.toBeNull();
    // `from` is the hero's own position at cast time, distinct from the target `at`.
    expect(castFrom!.x).toBeCloseTo(heroPos!.x, 1);
    expect(castFrom!.y).toBeCloseTo(heroPos!.y, 1);
  });
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skillVfx.test.ts -t "fly-from-source"`
Expected: FAIL — `fx.from` is `undefined` (TS error or `castFrom` stays null).

- [x] **Step 3: Add `from` to the cast event type** — in `src/core/battleTypes.ts` line 46, change:

```ts
  | { type: "cast"; uid: number; at: Vec2; damageType: DamageType; radius: number; source: "tower" | "hero"; skillId?: string }
```

to:

```ts
  | { type: "cast"; uid: number; from: Vec2; at: Vec2; damageType: DamageType; radius: number; source: "tower" | "hero"; skillId?: string }
```

- [x] **Step 4: Add the `from` parameter to `castActive` and emit it** — in `src/core/battleDamage.ts`, change the signature (lines 250-261) so `from: Vec2` is inserted right after `center: Vec2`:

```ts
  castActive(
    this: BattleState,
    attacker: Stats,
    effAtk: number,
    damageType: DamageType,
    center: Vec2,
    from: Vec2,
    source: "tower" | "hero",
    uid: number,
    skillId?: string,
    defenseScale?: { armor?: number; magicResist?: number; maxHp?: number },
    powerMult = 2,
  ): void {
    this.emit({ type: "cast", uid, from: { x: from.x, y: from.y }, at: { x: center.x, y: center.y }, damageType, radius: SPLASH_RADIUS, source, skillId });
```

(Only the signature + the `emit` line change; the rest of the method body is untouched.)

- [x] **Step 5: Pass `h.pos` at the hero call site** — in `src/core/battle.ts` line 482, change:

```ts
      this.castActive(h.stats, h.stats.atk, h.activeDamageType ?? h.damageType, target.pos, "hero", -1, h.equippedSkillId, undefined, h.activeMult ?? 2);
```

to (insert `h.pos` after `target.pos`):

```ts
      this.castActive(h.stats, h.stats.atk, h.activeDamageType ?? h.damageType, target.pos, h.pos, "hero", -1, h.equippedSkillId, undefined, h.activeMult ?? 2);
```

- [x] **Step 6: Pass `t.pos` at the tower call site** — in `src/core/battleTowers.ts` line 77, change:

```ts
        this.castActive(t.stats, effAtk, activeType, target.pos, "tower", t.uid, t.def.active ?? undefined, t.behavior?.defenseScale);
```

to (insert `t.pos` after `target.pos`):

```ts
        this.castActive(t.stats, effAtk, activeType, target.pos, t.pos, "tower", t.uid, t.def.active ?? undefined, t.behavior?.defenseScale);
```

- [x] **Step 7: Forward `from` in the FX dispatcher** — in `src/scenes/fx.ts` line 80, change:

```ts
        this.skillVfx.cast(e.at, e.radius, e.skillId, e.source);
```

to:

```ts
        this.skillVfx.cast(e.from, e.at, e.radius, e.skillId, e.source);
```

- [x] **Step 8: Update `SkillVfx.cast` to accept `from`** — in `src/scenes/skillVfx.ts`, change the method signature (line 36) only — body unchanged for now:

```ts
  cast(from: V, at: V, radius: number, skillId: string | undefined, source: "tower" | "hero"): void {
```

The existing body still ignores `from`; Task 4 wires it. This keeps Task 1 a pure-plumbing, compiling change.

- [x] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/skillVfx.test.ts -t "fly-from-source"`
Expected: PASS.

- [x] **Step 10: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (the old cast tests still pass — `from` is additive).

- [x] **Step 11: Commit**

```bash
git add src/core/battleTypes.ts src/core/battleDamage.ts src/core/battle.ts src/core/battleTowers.ts src/scenes/fx.ts src/scenes/skillVfx.ts tests/skillVfx.test.ts
git commit -m "feat(vfx): plumb caster position (from) into cast event

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Extract `VfxDraw` into a shared `vfxDraw.ts` module + add travel primitives

`skillSignatures.ts` is 353 lines and both signatures and the new delivery layer need the kit. Extract it (keeps both files small) and add the primitives delivery needs.

**Files:**
- Create: `src/scenes/vfxDraw.ts`
- Modify: `src/scenes/skillSignatures.ts:9-149` (remove the inline `VfxDraw`, import it)

- [x] **Step 1: Create `src/scenes/vfxDraw.ts`** with the existing `VfxDraw` class moved verbatim out of `skillSignatures.ts` (lines 15-149: the class plus its `type V`/`type Fac` aliases), exported, then append the 5 new travel primitives as methods inside the class (before its closing `}`):

```ts
// src/scenes/vfxDraw.ts
//
// Shared procedural VFX drawing kit. Every object self-destructs when its tween
// completes, so callers never clean up. Used by the per-skill impact signatures
// (skillSignatures.ts) and the source-delivery choreographies (skillDelivery.ts).
// No art assets — pure Phaser shapes + tweens.
import Phaser from "phaser";

export type V = { x: number; y: number };
export type Fac = Phaser.GameObjects.GameObjectFactory;

/** Compact drawing kit shared by every signature + delivery. Self-destructs each object. */
export class VfxDraw {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Fac,
    private readonly depth: number,
  ) {}

  /* ── MOVE VERBATIM from skillSignatures.ts lines 23-148: ──
     go, after, shake, flash, ring, disc, spark, motes, crescent, beam, crack,
     shards, sigil, glyphs, smoke, gleam. Copy them exactly as-is. ── */

  // ── NEW travel primitives for source-delivery ──────────────────────────────

  /** A gather/charge glow that swells then implodes at a point (anticipation beat). */
  chargeGlow(at: V, color: number, r: number, dur: number): void {
    const c = this.fac.circle(at.x, at.y, r, color, 0.5).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
    this.scene.tweens.add({ targets: c, scale: 1, duration: dur * 0.6, ease: "Quad.easeOut",
      onComplete: () => this.go(c, { scale: 0.1, alpha: 0 }, dur * 0.4, "Quad.easeIn") });
    this.spark(at, color, 6, r * 1.6);
  }

  /** A glowing orb that flies from→to leaving a fading trail, then `onArrive`. */
  orbTravel(from: V, to: V, color: number, hot: number, r: number, dur: number, onArrive: () => void): void {
    const glow = this.fac.circle(from.x, from.y, r + 3, color, 0.35).setDepth(this.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    const body = this.fac.circle(from.x, from.y, r, hot).setStrokeStyle(2, color, 0.9).setDepth(this.depth + 3).setBlendMode(Phaser.BlendModes.ADD);
    let last = { x: from.x, y: from.y };
    const trail = this.scene.time.addEvent({ delay: 24, loop: true, callback: () => {
      const t = this.fac.circle(last.x, last.y, r * 0.7, color, 0.5).setDepth(this.depth).setBlendMode(Phaser.BlendModes.ADD);
      this.go(t, { scale: 0.2, alpha: 0 }, 220);
      last = { x: body.x, y: body.y };
    } });
    this.scene.tweens.add({ targets: [glow, body], x: to.x, y: to.y, duration: dur, ease: "Quad.easeIn",
      onComplete: () => { trail.remove(); glow.destroy(); body.destroy(); onArrive(); } });
  }

  /** A vertical streak that plummets from `sky` down to `to`, then `onArrive`. */
  fallStreak(to: V, height: number, color: number, hot: number, width: number, dur: number, onArrive: () => void): void {
    const sky = { x: to.x, y: to.y - height };
    const streak = this.fac.rectangle(sky.x, sky.y, width, height, color, 0.85).setOrigin(0.5, 0).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(1, 0.1);
    const head = this.fac.circle(sky.x, sky.y, width * 0.9, hot).setDepth(this.depth + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: streak, scaleY: 1, duration: dur, ease: "Quad.easeIn", onComplete: () => this.go(streak, { alpha: 0 }, 120) });
    this.scene.tweens.add({ targets: head, y: to.y, duration: dur, ease: "Quad.easeIn",
      onComplete: () => { head.destroy(); onArrive(); } });
  }

  /** A column of energy/shards that erupts upward from the ground at `at`, then `onArrive`. */
  riser(at: V, color: number, hot: number, height: number, dur: number, onArrive: () => void): void {
    const col = this.fac.rectangle(at.x, at.y, 10, height, color, 0.55).setOrigin(0.5, 1).setDepth(this.depth + 1).setBlendMode(Phaser.BlendModes.ADD).setScale(1, 0);
    this.scene.tweens.add({ targets: col, scaleY: 1, duration: dur * 0.6, ease: "Cubic.easeOut", onComplete: () => this.go(col, { alpha: 0, scaleX: 0.4 }, dur * 0.4) });
    for (let i = 0; i < 5; i++) {
      const s = this.fac.triangle(at.x + Phaser.Math.Between(-12, 12), at.y, 0, 0, 5, -16, 10, 0, hot).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: s, y: at.y - Phaser.Math.Between(18, height), alpha: 0, duration: dur, ease: "Quad.easeOut", delay: i * 18, onComplete: () => s.destroy() });
    }
    this.after(Math.round(dur * 0.6), onArrive);
  }

  /** A ground target-marker reticle that blooms then snaps (skyfall telegraph). */
  marker(at: V, radius: number, color: number, dur: number): void {
    const c = this.fac.circle(at.x, at.y, radius).setStrokeStyle(2, color, 0.8).setDepth(this.depth).setScale(1.4).setAlpha(0);
    this.scene.tweens.add({ targets: c, scale: 1, alpha: 0.9, duration: dur, ease: "Quad.easeOut", onComplete: () => this.go(c, { scale: 0.85, alpha: 0 }, 140) });
  }
}
```

> Note: `go` is `private`. The new methods call `this.go(...)` from inside the class, which is allowed. Keep `go` exactly as it was (`private go(...)`).

- [x] **Step 2: Replace the inline class in `skillSignatures.ts` with an import** — in `src/scenes/skillSignatures.ts`, delete lines 12-149 (the `type V` / `type Fac` aliases and the entire `class VfxDraw { ... }`) and replace the import region near the top so it reads:

```ts
import Phaser from "phaser";
import type { SkillVfxSpec, SkillSignature } from "../data/skillVfxMeta.ts";
import { VfxDraw, type V } from "./vfxDraw.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;
```

The `SigFn` type and all `const xxxSweep: SigFn = ...` signatures below stay exactly as they are (they already use `d: VfxDraw`, `at: V`). `renderSignature` still does `new VfxDraw(scene, fac, depth)` — now from the import.

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (the moved class is identical; only its home changed).

- [x] **Step 4: Run the suite to prove no behavioral regression**

Run: `npx vitest run`
Expected: all pass (rendering is unchanged; signatures still compile against the same kit).

- [x] **Step 5: Confirm file sizes are under the limit**

Run: `wc -l src/scenes/vfxDraw.ts src/scenes/skillSignatures.ts`
Expected: both well under 500 (vfxDraw ~210, skillSignatures ~220).

- [x] **Step 6: Commit**

```bash
git add src/scenes/vfxDraw.ts src/scenes/skillSignatures.ts
git commit -m "refactor(vfx): extract shared VfxDraw kit + add travel primitives

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Add `delivery` metadata + `deliveryForStyle` (data, TDD)

**Files:**
- Modify: `src/data/skillVfxMeta.ts`
- Test: `tests/skillVfx.test.ts`

- [x] **Step 1: Write the failing tests** — append a new describe block to `tests/skillVfx.test.ts` (after the `skill VFX metadata` block). Import additions go at the top of the file:

```ts
// add to the existing import from skillVfxMeta.ts:
import { SKILL_VFX, skillVfxSpec, DELIVERY_KINDS, deliveryForStyle } from "../src/data/skillVfxMeta.ts";
```

```ts
describe("skill VFX delivery", () => {
  it("gives every active skill a known delivery archetype", () => {
    for (const s of ACTIVE_SKILLS) {
      const spec = SKILL_VFX[s.id];
      expect(DELIVERY_KINDS.includes(spec.delivery), `${s.id}.delivery="${spec.delivery}"`).toBe(true);
    }
  });

  it("maps every elemental tower style to a known delivery", () => {
    const styles = ["fire", "ice", "lightning", "heal", "slash", "poison", "arcane"] as const;
    for (const st of styles) {
      expect(DELIVERY_KINDS.includes(deliveryForStyle(st)), `style ${st}`).toBe(true);
    }
  });

  it("uses more than one delivery archetype across the roster (variety)", () => {
    const used = new Set(ACTIVE_SKILLS.map((s) => SKILL_VFX[s.id].delivery));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/skillVfx.test.ts -t "delivery"`
Expected: FAIL — `DELIVERY_KINDS` / `deliveryForStyle` not exported; `spec.delivery` undefined.

- [x] **Step 3: Add the type, constant, and fallback map** — in `src/data/skillVfxMeta.ts`, add after the `SkillSignature` type union (after line 42) and import `SkillStyle`:

```ts
import type { SkillStyle } from "./attackStyle.ts";

/** How a cast travels from its origin to the impact point (the "fly-from-source" beat). */
export type DeliveryKind = "bolt" | "beam" | "skyfall" | "ground" | "cast";

/** Runtime-checkable list of every delivery kind (keep in sync with DeliveryKind). */
export const DELIVERY_KINDS: readonly DeliveryKind[] = ["bolt", "beam", "skyfall", "ground", "cast"];
```

Add `delivery` to the `SkillVfxSpec` interface (inside it, after `signature`):

```ts
  /** How the cast arrives — caster→target, sky-fall, ground-erupt, etc. */
  delivery: DeliveryKind;
```

- [x] **Step 4: Set `delivery` on each of the 14 specs** — add the field to every entry in `SKILL_VFX` per this mapping (place it right after each `signature:` line):

```
valiant-strike   → delivery: "cast"
spirit-bolt      → delivery: "bolt"
iron-cleave      → delivery: "cast"
stone-bash       → delivery: "ground"
execute-slash    → delivery: "skyfall"
tri-shot         → delivery: "bolt"
piercing-arrow   → delivery: "beam"
mana-burst       → delivery: "bolt"
arcane-nova      → delivery: "skyfall"
rapid-fire       → delivery: "bolt"
concussion-round → delivery: "skyfall"
shadow-curse     → delivery: "ground"
true-strike      → delivery: "beam"
void-palm        → delivery: "beam"
```

For example the first entry becomes:

```ts
  "valiant-strike": {
    signature: "valiant-sweep",
    delivery: "cast",
    palette: { core: 0xffe07a, hot: 0xffffff, deep: 0xc8962a },
    appearance: /* unchanged */
```

- [x] **Step 5: Add `deliveryForStyle`** — append near the bottom of `src/data/skillVfxMeta.ts` (after `skillVfxSpec`):

```ts
/** Fallback delivery for tower/elemental casts that have no bespoke signature. */
export function deliveryForStyle(style: SkillStyle): DeliveryKind {
  if (style === "lightning") return "skyfall";
  if (style === "slash") return "cast";
  return "bolt";
}
```

- [x] **Step 6: Run the delivery tests to verify they pass**

Run: `npx vitest run tests/skillVfx.test.ts -t "delivery"`
Expected: PASS.

- [x] **Step 7: Typecheck (proves the spec literal still satisfies the interface everywhere)**

Run: `npx tsc --noEmit`
Expected: clean.

- [x] **Step 8: Commit**

```bash
git add src/data/skillVfxMeta.ts tests/skillVfx.test.ts
git commit -m "feat(vfx): data-driven delivery archetype per skill + style fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Build the delivery choreographies + wire `SkillVfx.cast`

**Files:**
- Create: `src/scenes/skillDelivery.ts`
- Modify: `src/scenes/skillVfx.ts`

- [x] **Step 1: Create `src/scenes/skillDelivery.ts`**:

```ts
// src/scenes/skillDelivery.ts
//
// Source-delivery choreographies: the "fly from the source" beats that play BEFORE
// a skill's impact signature. Each kind animates the cast travelling from its origin
// (caster, sky, or ground) to the impact point, then calls onArrive() to fire the
// per-skill impact set-piece. Pure presentation, built on the shared VfxDraw kit.
import { VfxDraw, type V } from "./vfxDraw.ts";
import type { DeliveryKind } from "../data/skillVfxMeta.ts";

type Palette = { core: number; hot: number; deep: number };
type DeliveryFn = (d: VfxDraw, from: V, at: V, p: Palette, radius: number, onArrive: () => void) => void;

// Travel from caster: charge, then an orb streaks to the target.
const bolt: DeliveryFn = (d, from, at, p, radius, onArrive) => {
  d.chargeGlow(from, p.core, 10, 180);
  d.after(120, () => d.orbTravel(from, at, p.core, p.hot, 6, Math.min(220, 80 + dist(from, at) * 0.5), onArrive));
};

// Instant lance/beam from caster straight to target.
const beam: DeliveryFn = (d, from, at, p, radius, onArrive) => {
  d.chargeGlow(from, p.hot, 8, 130);
  const ang = Math.atan2(at.y - from.y, at.x - from.x);
  d.beam(from, ang, dist(from, at), p.core, 6, 200);
  d.beam(from, ang, dist(from, at), p.hot, 2, 170);
  d.after(110, onArrive);
};

// Falls from the sky onto the target; a ground reticle telegraphs the landing.
const skyfall: DeliveryFn = (d, _from, at, p, radius, onArrive) => {
  d.marker(at, radius * 0.7, p.hot, 150);
  d.fallStreak(at, 230, p.core, p.hot, 9, 200, onArrive);
};

// Erupts upward out of the ground at the target.
const ground: DeliveryFn = (d, _from, at, p, radius, onArrive) => {
  d.marker(at, radius * 0.6, p.deep, 130);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    d.crack(at, a, radius * 0.7, p.deep, 220);
  }
  d.riser(at, p.core, p.hot, 40, 240, onArrive);
};

// Melee draw: wind-up at the caster, a quick streak to the target.
const cast: DeliveryFn = (d, from, at, p, radius, onArrive) => {
  d.chargeGlow(from, p.core, 9, 150);
  const ang = Math.atan2(at.y - from.y, at.x - from.x);
  d.gleam(from, (ang * 180) / Math.PI, dist(from, at), p.hot, 5);
  d.after(110, onArrive);
};

const DELIVERIES: Record<DeliveryKind, DeliveryFn> = { bolt, beam, skyfall, ground, cast };

function dist(a: V, b: V): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Play the delivery for `kind`, firing `onArrive` when the cast reaches the target. */
export function renderDelivery(
  d: VfxDraw, kind: DeliveryKind, from: V, at: V, palette: Palette, radius: number, onArrive: () => void,
): void {
  DELIVERIES[kind](d, from, at, palette, radius, onArrive);
}
```

- [x] **Step 2: Wire `SkillVfx.cast` to play delivery → impact** — in `src/scenes/skillVfx.ts`, update the imports and the `cast` body. Add imports:

```ts
import { skillVfxSpec, deliveryForStyle } from "../data/skillVfxMeta.ts";
import { renderSignature } from "./skillSignatures.ts";
import { renderDelivery } from "./skillDelivery.ts";
import { VfxDraw } from "./vfxDraw.ts";
```

Replace the entire `cast(...)` method body with:

```ts
  cast(from: V, at: V, radius: number, skillId: string | undefined, source: "tower" | "hero"): void {
    const draw = new VfxDraw(this.scene, this.fac, this.depth);
    const spec = skillVfxSpec(skillId);
    if (spec) {
      // Hero skill: deliver from the source, then fire the bespoke impact set-piece.
      renderDelivery(draw, spec.delivery, from, at, spec.palette, radius, () => {
        this.baseBurst(at, spec.palette.core, radius, skillId);
        renderSignature(this.scene, this.fac, this.depth, at, spec, radius);
      });
      return;
    }
    const style = skillStyleFor(skillId);
    const color = SKILL_STYLE_COLOR[style];
    const accent = ACCENT[style];
    renderDelivery(draw, deliveryForStyle(style), from, at, { core: color, hot: accent.hot, deep: accent.deep }, radius, () => {
      this.baseBurst(at, color, radius, skillId);
      switch (style) {
        case "fire": this.fire(at, color, radius); break;
        case "ice": this.ice(at, color, radius); break;
        case "lightning": this.lightning(at, color, radius); break;
        case "arcane": this.arcane(at, color, radius); break;
        case "poison": this.poison(at, color, radius); break;
        case "heal": this.heal(at, color, radius); break;
        case "slash": this.slash(at, color, radius); break;
      }
      if (source === "hero" || style === "lightning" || style === "fire") {
        this.scene.cameras.main.shake(style === "lightning" ? 200 : 130, style === "lightning" ? 0.007 : 0.004);
      }
    });
  }
```

(`ACCENT` already exists in this file; `skillStyleFor` / `SKILL_STYLE_COLOR` are already imported.)

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [x] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: all pass (the plumbing + metadata tests now exercise the wired path; rendering itself is presentation, asserted via playtest).

- [x] **Step 5: Confirm file sizes**

Run: `wc -l src/scenes/skillDelivery.ts src/scenes/skillVfx.ts`
Expected: both under 500.

- [x] **Step 6: Commit**

```bash
git add src/scenes/skillDelivery.ts src/scenes/skillVfx.ts
git commit -m "feat(vfx): source-delivery choreography wired into every cast

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Top up the three thinnest impact signatures to a clear aftermath beat

`triple-volley`, `piercing-lance`, and `muzzle-barrage` are the shortest set-pieces. With delivery added they already exceed 4 beats overall, but give each a distinct settling beat so the *impact itself* stays satisfying.

**Files:**
- Modify: `src/scenes/skillSignatures.ts`

- [x] **Step 1: Add an aftermath beat to `tripleVolley`** — in `src/scenes/skillSignatures.ts`, change the `tripleVolley` body to append rising motes + a lingering ring after the arrows land:

```ts
const tripleVolley: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  [-32, 0, 32].forEach((deg, i) => d.after(i * 45, () => {
    const a = Phaser.Math.DegToRad(deg);
    d.beam(at, a, radius * 1.1, core, 3, 240);
    const tip = { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius };
    d.spark(tip, hot, 5, 12);
  }));
  d.ring(at, radius * 0.7, deep, 360, 2);
  d.after(180, () => d.motes(at, radius, 8, () => (Math.random() < 0.5 ? core : hot), -1)); // verdant drift settles
};
```

- [x] **Step 2: Add an aftermath beat to `piercingLance`** — append a recoil smoke + lingering ring:

```ts
const piercingLance: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.ring(at, 30, hot, 220, 4);             // sonic muzzle ring
  d.beam(at, 0, radius * 2.2, core, 6, 260);
  d.beam(at, 0, radius * 2.2, hot, 2, 220);
  d.after(40, () => d.beam(at, Math.PI, radius * 0.4, deep, 3, 200)); // recoil flick
  d.spark(at, hot, 7, 16);
  d.after(200, () => { d.ring(at, radius * 1.1, core, 320, 2); d.smoke(at, deep, 8); }); // pierce-wake
};
```

- [x] **Step 3: Add an aftermath beat to `muzzleBarrage`** — append a final shell-casing spark + drifting smoke after the 5 shots:

```ts
const muzzleBarrage: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  for (let i = 0; i < 5; i++) d.after(i * 55, () => {
    const off = { x: at.x + (i - 2) * 8, y: at.y };
    d.disc(off, 9, hot, 0.9, 1.6, 160);                  // muzzle flash
    d.beam(off, Phaser.Math.FloatBetween(-0.15, 0.15), radius, core, 3, 200); // tracer
    d.smoke({ x: off.x, y: off.y }, deep, 6);
  });
  d.after(320, () => { d.spark(at, hot, 8, 20); d.smoke(at, deep, 12); }); // gunsmoke settles
};
```

- [x] **Step 4: Typecheck + suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + all pass.

- [x] **Step 5: Commit**

```bash
git add src/scenes/skillSignatures.ts
git commit -m "polish(vfx): aftermath beats for the three thinnest impact signatures

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Verify whole — build, playtest, document

**Files:**
- Modify: memory `project_skill_vfx_signatures.md` (+ MEMORY.md pointer if needed)

- [x] **Step 1: Production build**

Run: `npm run build`
Expected: succeeds, no type errors.

- [x] **Step 2: Full suite once more**

Run: `npx vitest run`
Expected: all pass (count ≥ previous total + the new delivery/plumbing tests).

- [x] **Step 3: Playtest several casts via CDP** — capture a hero casting a `skyfall`, a `bolt`, a `beam`, and a `ground` skill mid-delivery and at impact:

Run: `bash scripts/playtest/snap.sh --scene BattleScene --wait 4000 --out /tmp/vfx-delivery.png --eval "(()=>{const g=window.__game;return 'ok';})()"`
Expected: screenshot written, console reports 0 runtime errors. Inspect that casts visibly travel from the hero / fall from sky / erupt from ground before bursting.

- [x] **Step 4: Update memory** — prepend a dated paragraph to `project_skill_vfx_signatures.md` describing: the `from`-plumbed cast event, the `delivery` field + `DeliveryKind` (`bolt`/`beam`/`skyfall`/`ground`/`cast`), `renderDelivery` + the extracted `vfxDraw.ts` kit, `deliveryForStyle` for tower fallback, and that each cast is now a ≥4-beat sequence (charge → travel → impact → aftermath). Keep it to a few sentences; update the MEMORY.md hook line if the summary changed.

- [x] **Step 5: Final commit**

```bash
git add -A
git commit -m "docs(vfx): record source-delivery + multi-beat cast system in memory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Source delivery (fly/fall/grow/beam) → Tasks 1 (plumbing), 3 (data), 4 (choreography). ✓
- ≥4 beats per effect → delivery (≥2 beats) + impact + aftermath; Task 5 tops up the thin ones. ✓
- All 14 hero skills → Task 3 maps every one; Task 4 wires the hero path. ✓
- Tower fallback bonus → `deliveryForStyle` (Task 3) + element path (Task 4). ✓
- No gameplay change → `from` is presentation-only; damage still at `at` (Task 1). ✓
- File-size limit → `VfxDraw` extraction (Task 2); sizes checked in Tasks 2/4. ✓
- Testing strategy → delivery-coverage + `from`-plumbing tests (Tasks 1, 3); playtest (Task 6). ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code. The one "move verbatim" note (Task 2 Step 1) names the exact source lines (skillSignatures.ts 23-148) and lists every method — acceptable since the content is a literal copy of existing, in-repo code.

**3. Type consistency:** `DeliveryKind`, `DELIVERY_KINDS`, `deliveryForStyle`, `renderDelivery`, `VfxDraw`, `V`, `chargeGlow`/`orbTravel`/`fallStreak`/`riser`/`marker` are named identically across Tasks 2-4. `castActive`'s new `from` param order (after `center`) matches both call sites (Task 1 Steps 4-6) and the `cast(from, at, ...)` arg order in fx.ts (Step 7) and `SkillVfx.cast` (Step 8 / Task 4). ✓
