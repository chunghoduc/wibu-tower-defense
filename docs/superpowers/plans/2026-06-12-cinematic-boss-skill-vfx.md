# Cinematic Boss-Skill VFX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every boss-skill cast look dramatic and visually distinct — a telegraph → burst → aftermath set-piece themed by the boss's element.

**Architecture:** A new pure resolver `bossSkillTheme(skillType, element)` (in `bossSkillVfx.ts`) layers an element accent + a camera-weight onto the existing signature spec. The boss's element is plumbed through the `bossCast` FX event (`battleTypes.ts` → `battleEnemies.ts` → `fx.ts`) into `BossSkillFx`, which renders each of the four signatures as a 3-beat cinematic using new shared primitives (extracted to `bossSkillFxPrimitives.ts` to stay under 500 lines).

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure logic is unit-tested; the Phaser renderer is exercised by CDP playtest.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/data/bossSkillVfx.ts` | Modify | Add `BossSkillTheme`, `ELEMENT_ACCENT`, `SIGNATURE_WEIGHT`, `bossSkillTheme()` (pure) |
| `tests/bossSkillVfx.test.ts` | Modify | Add `bossSkillTheme` cases (distinct accent, preserved primary, weight) |
| `src/core/battleTypes.ts` | Modify | Add `element: DamageType` to the `bossCast` event variant |
| `src/core/battleEnemies.ts` | Modify | Emit `element: e.def.damageType` in `castBossSkill` |
| `tests/boss-skill.test.ts` | Modify | Assert a `bossCast` event carries the boss's `damageType` |
| `src/scenes/bossSkillFxPrimitives.ts` | Create | Shared cinematic primitives: `flare`, `chargeCore`, `emberDrift`, `punch`, `ring`, `disc`, `tween`, `after` |
| `src/scenes/bossSkillSignatures.ts` | Modify | Use primitives + theme; rebuild each signature as telegraph→burst→aftermath; new `cast(...element)` signature |
| `src/scenes/fx.ts` | Modify | Pass `e.element` through `bossCast` → `bossFx.cast(...)` |

---

## Task 1: Pure `bossSkillTheme` resolver

**Files:**
- Modify: `src/data/bossSkillVfx.ts`
- Test: `tests/bossSkillVfx.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/bossSkillVfx.test.ts` (after the existing imports add `bossSkillTheme`; add a new `describe`):

Change line 2 import to:
```ts
import { bossSkillSignature, bossSkillTheme } from "../src/data/bossSkillVfx.ts";
```

Append this describe block:
```ts
describe("bossSkillTheme", () => {
  it("keeps the signature's base hue as the primary anchor for every element", () => {
    for (const el of ["Physical", "Magic", "True"] as const) {
      expect(bossSkillTheme("quake", el).primary).toBe(bossSkillSignature("quake").color);
    }
  });

  it("gives the same signature a distinct accent per element", () => {
    const accents = (["Physical", "Magic", "True"] as const).map((el) => bossSkillTheme("quake", el).accent);
    expect(new Set(accents).size).toBe(3);
  });

  it("assigns every known signature AND the fallback a defined camera weight", () => {
    for (const s of ["quake", "rally", "barrier", "summon-surge", "nonsense"]) {
      const w = bossSkillTheme(s, "Physical").weight;
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it("makes the quake heavier than the barrier (weight ordering)", () => {
    expect(bossSkillTheme("quake", "Physical").weight).toBeGreaterThan(
      bossSkillTheme("barrier", "Physical").weight,
    );
  });

  it("carries the signature kind and label through from the base spec", () => {
    expect(bossSkillTheme("rally", "Magic").signature).toBe("rally");
    expect(bossSkillTheme("rally", "Magic").label).toBe(bossSkillSignature("rally").label);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bossSkillVfx.test.ts`
Expected: FAIL — `bossSkillTheme is not a function` / not exported.

- [ ] **Step 3: Implement `bossSkillTheme`**

In `src/data/bossSkillVfx.ts`, add the `DamageType` import at the top (after the file's opening comment, before `export type BossSignature`):
```ts
import type { DamageType } from "./schemaEnums.ts";
```

Then append below the existing `bossSkillSignature` function:
```ts
/** Resolved cast palette + camera weight for ONE boss cast. */
export interface BossSkillTheme {
  /** Which set-piece to draw (same as the base signature). */
  signature: BossSignature;
  /** Base signature colour — the recognisable anchor hue. */
  primary: number;
  /** Element-derived secondary colour for glow/embers/accent layers. */
  accent: number;
  /** Flavour label floated on cast. */
  label: string;
  /** 0..1 camera-punch intensity (heaviest skills shake hardest). */
  weight: number;
}

/** Element → accent colour (mirrors the DMG_COLOR family in fx.ts). */
const ELEMENT_ACCENT: Record<DamageType, number> = {
  Physical: 0xdfe7f2, // steel white
  Magic: 0xc77dde,    // violet
  True: 0xfff3a0,     // gold
};

/** Per-signature camera weight: quake hits hardest, barrier softest. */
const SIGNATURE_WEIGHT: Record<BossSignature, number> = {
  "quake": 1.0,
  "summon-surge": 0.7,
  "rally": 0.6,
  "barrier": 0.4,
  "ring": 0.5,
};

/** Resolve a boss cast to its full themed palette + camera weight (never throws). */
export function bossSkillTheme(skillType: string, element: DamageType): BossSkillTheme {
  const base = bossSkillSignature(skillType);
  return {
    signature: base.signature,
    primary: base.color,
    accent: ELEMENT_ACCENT[element] ?? ELEMENT_ACCENT.Physical,
    label: base.label,
    weight: SIGNATURE_WEIGHT[base.signature],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bossSkillVfx.test.ts`
Expected: PASS (all existing + 5 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/data/bossSkillVfx.ts tests/bossSkillVfx.test.ts
git commit -m "feat(boss-vfx): pure bossSkillTheme — element accent + camera weight

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Plumb `element` through the bossCast event

**Files:**
- Modify: `src/core/battleTypes.ts:49`
- Modify: `src/core/battleEnemies.ts:204`
- Test: `tests/boss-skill.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/boss-skill.test.ts` inside the `describe("T16 — boss active skills", ...)` block (after the "bosses accumulate mana" test). It captures emitted FX events via the battle's event hook:

```ts
it("a boss cast emits a bossCast FX event carrying the boss's element", () => {
  const b = bossBattle("warden");
  for (let i = 0; i < 60 && b.enemies.length === 0; i++) b.tick(0.1);
  const boss = b.enemies.find((e) => e.def.id === "warden")!;
  boss.mana = boss.def.boss!.skill!.manaCost;
  b.tick(0.1); // FX events for this tick land in b.fx (cleared at each tick start)
  const cast = b.fx.find((e) => e.type === "bossCast");
  expect(cast).toBeDefined();
  expect(cast).toMatchObject({ element: boss.def.damageType });
});
```

> The battle exposes emitted FX as the public `readonly fx: FxEvent[]` array (`battle.ts:74`), reset at the start of every `tick()` (`battle.ts:417`). Reading `b.fx` right after the casting tick is the established way to inspect emitted events. `toMatchObject` avoids a TS narrow on the union.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/boss-skill.test.ts`
Expected: FAIL — `cast.element` is `undefined` (event doesn't carry it yet).

- [ ] **Step 3a: Add `element` to the event type**

In `src/core/battleTypes.ts`, change line 49 from:
```ts
  | { type: "bossCast"; uid: number; at: Vec2; skill: string; radius: number; name: string }
```
to:
```ts
  | { type: "bossCast"; uid: number; at: Vec2; skill: string; radius: number; name: string; element: DamageType }
```
(`DamageType` is already imported in this file — it is used by the other variants.)

- [ ] **Step 3b: Populate `element` at the emit site**

In `src/core/battleEnemies.ts`, in `castBossSkill` (line ~204), change:
```ts
    this.emit({ type: "bossCast", uid: e.uid, at: { x: e.pos.x, y: e.pos.y }, skill: skill.type, radius: R, name: skill.name });
```
to:
```ts
    this.emit({ type: "bossCast", uid: e.uid, at: { x: e.pos.x, y: e.pos.y }, skill: skill.type, radius: R, name: skill.name, element: e.def.damageType });
```

- [ ] **Step 4: Run test + typecheck to verify they pass**

Run: `npx vitest run tests/boss-skill.test.ts && npx tsc --noEmit`
Expected: test PASS; tsc reports the `fx.ts` `bossCast` handler is now missing `element` ONLY if fx.ts destructures exhaustively — that is fixed in Task 4. If tsc errors solely about `e.element` unused or `bossFx.cast` arity, that is expected and resolved in Tasks 3–4. The Vitest run must pass now.

> If `tsc --noEmit` fails because `fx.ts` builds a `bossCast` object literal somewhere, that's Task 4. Proceed.

- [ ] **Step 5: Commit**

```bash
git add src/core/battleTypes.ts src/core/battleEnemies.ts tests/boss-skill.test.ts
git commit -m "feat(boss-vfx): plumb boss element through the bossCast event

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extract shared cinematic primitives

**Files:**
- Create: `src/scenes/bossSkillFxPrimitives.ts`
- Modify: `src/scenes/bossSkillSignatures.ts`

This task is a pure refactor + new primitives — no behavior change yet beyond the new helpers being available. No new unit test (Phaser); guard with `tsc` + existing suite.

- [ ] **Step 1: Create the primitives module**

Create `src/scenes/bossSkillFxPrimitives.ts`:
```ts
// Shared cinematic primitives for boss-skill set-pieces: telegraph charge,
// additive bloom, settling embers, and a weight-tuned camera punch. Pure
// presentation — every object self-destructs on tween/timer complete, so this
// stays stateless between casts. No art assets.
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;
const ADD = Phaser.BlendModes.ADD;

/** Cinematic helpers bound to one scene + factory + base depth. */
export class BossFxKit {
  constructor(
    readonly scene: Phaser.Scene,
    readonly fac: Fac,
    readonly depth: number,
  ) {}

  /** Tween a transient object, destroying it on complete. */
  tween(o: Phaser.GameObjects.GameObject, props: Record<string, number>, dur: number, ease = "Quad.easeOut", delay = 0): void {
    this.scene.tweens.add({ targets: o, ...props, duration: dur, ease, delay, onComplete: () => o.destroy() });
  }

  /** Run `fn` after `ms`. */
  after(ms: number, fn: () => void): void {
    this.scene.time.delayedCall(ms, fn);
  }

  /** An expanding stroked ring. */
  ring(at: Vec2, radius: number, color: number, dur: number, width = 3, delay = 0): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(width, color, 0.9).setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, dur, "Cubic.easeOut", delay);
  }

  /** A filled additive disc that grows and fades. */
  disc(at: Vec2, r: number, color: number, alpha: number, grow: number, dur: number, delay = 0): void {
    const d = this.fac.circle(at.x, at.y, r, color, alpha).setDepth(this.depth + 3).setBlendMode(ADD);
    this.tween(d, { scale: grow, alpha: 0 }, dur, "Cubic.easeOut", delay);
  }

  /** Soft additive radial bloom — the "impressive" glow layer behind a burst. */
  flare(at: Vec2, r: number, color: number, dur: number, delay = 0): void {
    const f = this.fac.circle(at.x, at.y, r, color, 0.5).setDepth(this.depth + 2).setBlendMode(ADD).setScale(0.2);
    this.tween(f, { scale: 1.4, alpha: 0 }, dur, "Quint.easeOut", delay);
  }

  /** Telegraph wind-up: a core that scales DOWN into a tight bright point. */
  chargeCore(at: Vec2, from: number, color: number, dur: number): void {
    const core = this.fac.circle(at.x, at.y, from, color, 0.0).setStrokeStyle(2, color, 0.9)
      .setDepth(this.depth + 2).setBlendMode(ADD);
    this.scene.tweens.add({
      targets: core, scale: 0.15, alpha: 1, duration: dur, ease: "Cubic.easeIn",
      onComplete: () => this.tween(core, { scale: 2.2, alpha: 0 }, 160, "Quad.easeOut"),
    });
  }

  /** Aftermath: small additive motes that drift up/out and fade. */
  emberDrift(at: Vec2, spread: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const d = spread * (0.4 + Math.random() * 0.7);
      const m = this.fac.circle(at.x, at.y, 2 + Math.random() * 2, color).setDepth(this.depth + 2).setBlendMode(ADD);
      this.tween(m, { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d - 14, alpha: 0, scale: 0.3 }, 420 + Math.random() * 260, "Quad.easeOut", 80 + i * 14);
    }
  }

  /** Camera punch tuned by a 0..1 weight: shake + a tinted flash. */
  punch(weight: number, color: number): void {
    const cam = this.scene.cameras.main;
    cam.shake(180 + weight * 140, 0.004 + weight * 0.007);
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    cam.flash(110 + weight * 90, Math.round(r * 0.5), Math.round(g * 0.5), Math.round(b * 0.5));
  }
}
```

- [ ] **Step 2: Point `BossSkillFx` at the kit (drop its private duplicates)**

In `src/scenes/bossSkillSignatures.ts`:

Replace the import block + class field setup. Change the top imports to add:
```ts
import { BossFxKit } from "./bossSkillFxPrimitives.ts";
```

In the constructor, build a kit and keep it:
```ts
  private readonly kit: BossFxKit;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Fac,
    private readonly depth: number,
  ) {
    this.kit = new BossFxKit(scene, fac, depth);
  }
```

Delete the private `ring`, `disc`, `tween`, and `after` methods at the bottom of the class (now provided by the kit). Inside the signature methods, replace `this.ring(` → `this.kit.ring(`, `this.disc(` → `this.kit.disc(`, `this.tween(` → `this.kit.tween(`, and `this.after(` → `this.kit.after(`. Leave `this.label(...)` and the signature methods themselves for now.

> The `makeCrisp` import and `label()` method stay in `bossSkillSignatures.ts`.

- [ ] **Step 3: Verify typecheck + existing tests stay green**

Run: `npx tsc --noEmit && npx vitest run tests/bossSkillVfx.test.ts`
Expected: tsc PASS (no references to deleted methods remain); tests PASS.

> If tsc reports a leftover `this.ring`/`this.disc`/`this.tween`/`this.after`, replace it with the `this.kit.` form.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/bossSkillFxPrimitives.ts src/scenes/bossSkillSignatures.ts
git commit -m "refactor(boss-vfx): extract shared cinematic primitives (BossFxKit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Themed 3-beat signatures + wire element through fx.ts

**Files:**
- Modify: `src/scenes/bossSkillSignatures.ts`
- Modify: `src/scenes/fx.ts:103-104,133-135`

- [ ] **Step 1: Change `BossSkillFx.cast` to take an element and resolve the theme**

In `src/scenes/bossSkillSignatures.ts`, change the import:
```ts
import { bossSkillTheme } from "../data/bossSkillVfx.ts";
```
(replacing the `bossSkillSignature` import — `bossSkillTheme` is what we use now.)

Add the `DamageType` import:
```ts
import type { DamageType, Vec2 } from "../data/schema.ts";
```

Rewrite `cast` and each signature method to take `(primary, accent, weight)`. Replace the whole `cast(...)` method and the four signature methods with:
```ts
  /** Entry point: draw the themed signature for `skillType` at `at`. */
  cast(at: Vec2, skillType: string, radius: number, name: string, element: DamageType): void {
    const t = bossSkillTheme(skillType, element);
    this.label(at, name, t.primary);
    this.kit.punch(t.weight, t.primary);
    switch (t.signature) {
      case "quake":        this.quake(at, radius, t.primary, t.accent); break;
      case "rally":        this.rally(at, radius, t.primary, t.accent); break;
      case "barrier":      this.barrier(at, radius, t.primary, t.accent); break;
      case "summon-surge": this.summonSurge(at, radius, t.primary, t.accent); break;
      default:             this.fallback(at, radius, t.primary, t.accent); break;
    }
  }

  // ---- signatures: telegraph -> burst -> aftermath -------------------------

  /** EARTHSHATTER — charge, radial fissures + slam rings, launched shards, accent embers. */
  private quake(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.chargeCore(at, R * 0.5, color, 140); // telegraph
    this.kit.after(150, () => {
      this.kit.flare(at, R * 0.9, color, 360);
      this.kit.ring(at, R, color, 520, 5);
      this.kit.ring(at, R * 0.7, 0xffe0b0, 360, 3, 90);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + 0.2;
        const len = R * (0.7 + Math.random() * 0.5);
        const crack = this.fac.rectangle(at.x, at.y, 4, 3, 0x2a1a12).setOrigin(0, 0.5).setRotation(a).setDepth(this.depth);
        this.kit.tween(crack, { scaleX: len / 4, alpha: 0 }, 520, "Cubic.easeOut");
      }
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const d = R * (0.4 + Math.random() * 0.6);
        const rock = this.fac.rectangle(at.x, at.y, 5, 5, 0x6b4a36).setDepth(this.depth + 2).setRotation(Math.random() * Math.PI);
        this.kit.tween(rock, { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d - 18, angle: 220, alpha: 0 }, 560, "Quad.easeOut");
      }
      this.kit.disc(at, 16, color, 0.7, 2.6, 420);
      this.kit.emberDrift(at, R * 0.8, accent, 9); // aftermath
    });
  }

  /** WAR ROAR — inhale pulse, concentric shockwaves, rising accent chevrons. */
  private rally(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.chargeCore(at, R * 0.4, color, 130); // telegraph
    this.kit.after(140, () => {
      this.kit.flare(at, R * 0.8, color, 320);
      for (let k = 0; k < 3; k++) this.kit.ring(at, R, color, 520, 4, k * 110);
      this.kit.disc(at, 14, color, 0.6, 2.4, 460);
      for (let i = 0; i < 7; i++) {
        const ox = (Math.random() - 0.5) * R * 1.2;
        const chev = this.fac.star(at.x + ox, at.y + 8, 3, 3, 8, color).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
        this.kit.tween(chev, { y: at.y - R * 0.7, alpha: 0, scale: 0.4 }, 700, "Quad.easeOut", i * 30);
      }
      this.kit.emberDrift(at, R * 0.7, accent, 8); // aftermath
    });
  }

  /** AEGIS DOME — plates gather, lock into a shimmering dome, accent shimmer settles. */
  private barrier(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.flare(at, R * 0.7, accent, 260); // soft telegraph glow
    const dome = this.fac.circle(at.x, at.y, R * 0.9, color, 0.12).setStrokeStyle(3, color, 0.85).setDepth(this.depth + 1).setScale(0.2);
    this.scene.tweens.add({ targets: dome, scale: 1, duration: 320, ease: "Back.easeOut",
      onComplete: () => this.kit.tween(dome, { alpha: 0, scale: 1.06 }, 520, "Quad.easeIn", 280) });
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const sx = at.x + Math.cos(a) * R * 1.4, sy = at.y + Math.sin(a) * R * 1.4;
      const hex = this.fac.star(sx, sy, 6, 5, 9, color, 0.9).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.kit.tween(hex, { x: at.x + Math.cos(a) * R * 0.82, y: at.y + Math.sin(a) * R * 0.82, alpha: 0.2, angle: 90 }, 360, "Cubic.easeOut", i * 18);
    }
    this.kit.ring(at, R * 0.9, 0xffffff, 300, 2, 360);
    this.kit.after(380, () => this.kit.emberDrift(at, R * 0.9, accent, 6)); // aftermath
  }

  /** RIFT SUMMON — converging telegraph claws, a torn portal, accent burst outward. */
  private summonSurge(at: Vec2, R: number, color: number, accent: number): void {
    // telegraph: claw-motes converge inward
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const claw = this.fac.circle(at.x + Math.cos(a) * R, at.y + Math.sin(a) * R, 3, accent).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.kit.tween(claw, { x: at.x, y: at.y, alpha: 0.2 }, 300, "Quad.easeIn", i * 12);
    }
    this.kit.after(160, () => {
      const tear = this.fac.ellipse(at.x, at.y, 10, R * 0.5, 0x120018, 0.95).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: tear, scaleX: 3.2, duration: 260, ease: "Back.easeOut",
        onComplete: () => this.kit.tween(tear, { scaleX: 0, alpha: 0 }, 420, "Quad.easeIn", 240) });
      const glow = this.fac.ellipse(at.x, at.y, 18, R * 0.55, color, 0.5).setDepth(this.depth).setBlendMode(Phaser.BlendModes.ADD);
      this.kit.tween(glow, { scaleX: 3.4, alpha: 0 }, 640, "Cubic.easeOut");
      const glyph = this.fac.star(at.x, at.y, 5, R * 0.18, R * 0.42, color, 0).setStrokeStyle(2, color, 0.9).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.kit.tween(glyph, { angle: 200, alpha: 0, scale: 0.4 }, 560, "Quad.easeOut");
      this.kit.flare(at, R * 0.6, accent, 420); // burst bloom
      this.kit.emberDrift(at, R * 0.9, accent, 10); // aftermath
    });
  }

  /** Fallback — a brighter double ring + bloom (no longer a bare single ring). */
  private fallback(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.flare(at, R * 0.7, color, 320);
    this.kit.ring(at, R, color, 600, 4);
    this.kit.ring(at, R * 0.6, accent, 420, 3, 80);
    this.kit.emberDrift(at, R * 0.7, accent, 6);
  }
```

> Delete the old `ring(at, radius, spec.color, 600)` default-case body and the old single-burst signature bodies — they are fully replaced above. Keep `label()` unchanged. Remove the now-unused top-level `const ADD = ...` only if nothing else references it (the signatures above use `Phaser.BlendModes.ADD` directly); if `ADD` is still referenced elsewhere in the file, leave it.

- [ ] **Step 2: Wire the element through `fx.ts`**

In `src/scenes/fx.ts`, change the `bossCast` case (line ~103-104) from:
```ts
      case "bossCast":
        this.bossCast(e.at, e.skill, e.radius, e.name);
        break;
```
to:
```ts
      case "bossCast":
        this.bossCast(e.at, e.skill, e.radius, e.name, e.element);
        break;
```

And the private `bossCast` method (line ~133-135) from:
```ts
  private bossCast(at: Vec2, skill: string, radius: number, name: string): void {
    this.bossFx.cast(at, skill, radius, name);
  }
```
to:
```ts
  private bossCast(at: Vec2, skill: string, radius: number, name: string, element: DamageType): void {
    this.bossFx.cast(at, skill, radius, name, element);
  }
```
(`DamageType` is already imported in `fx.ts` — it types `DMG_COLOR`.)

- [ ] **Step 3: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc PASS; all tests PASS (the Task 2 `element` plumbing is now consumed end-to-end).

- [ ] **Step 4: Verify file sizes stay under the 500-line rule**

Run: `wc -l src/scenes/bossSkillSignatures.ts src/scenes/bossSkillFxPrimitives.ts`
Expected: both well under 500. If `bossSkillSignatures.ts` is over 500, move `label()` + the `makeCrisp` import into `bossSkillFxPrimitives.ts` as `BossFxKit.label(...)` and call `this.kit.label(...)`.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/bossSkillSignatures.ts src/scenes/fx.ts
git commit -m "feat(boss-vfx): themed 3-beat boss-skill set-pieces (telegraph/burst/aftermath)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Verify whole — build, playtest, montage

**Files:** none (verification only)

- [ ] **Step 1: Full build + typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green, build succeeds.

- [ ] **Step 2: CDP self-playtest**

Launch the dev server and drive a boss fight via `window.__game` (see memory: "Playtest & art regen"). Force a boss to full mana and trigger each of the four skill types. Confirm for each: a visible wind-up (telegraph), a punchy themed burst, and settling embers (aftermath); and that two same-type bosses of different elements (e.g. a Physical vs a Magic quake) show different accent colours. Capture a short screenshot montage of the four casts.

- [ ] **Step 3: Send the montage to chat**

Save the montage frames to `/tmp` and reference each with a `[[send: /tmp/<file>.png]]` line in the report.

- [ ] **Step 4: Update memory**

Append a one-line pointer to `MEMORY.md` and write a `project_boss_skill_vfx.md` memory noting: boss casts now resolve `bossSkillTheme(skillType, element)` (pure, in `bossSkillVfx.ts`) → `BossSkillFx` renders telegraph→burst→aftermath via `BossFxKit` (`bossSkillFxPrimitives.ts`); element plumbed through the `bossCast` event; 4 signatures + fallback, accent = element (Physical/Magic/True). Link `[[project_skill_vfx_signatures]]`.

- [ ] **Step 5: Final commit (if memory/docs changed)**

```bash
git add docs/superpowers/plans/2026-06-12-cinematic-boss-skill-vfx.md
git commit -m "docs(boss-vfx): plan for cinematic boss-skill VFX overhaul

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Pillar 1 (3-beat choreography + primitives) → Tasks 3–4. Pillar 2 (`bossSkillTheme` accent + weight) → Task 1. Element plumbing → Task 2 + Task 4 Step 2. File-size guard → Task 4 Step 4. Testing section → Tasks 1, 2 + Task 5 playtest. All covered.
- **Type consistency:** `bossSkillTheme` returns `{signature, primary, accent, label, weight}` — consumed verbatim in Task 4 `cast`. `BossFxKit` method names (`ring/disc/flare/chargeCore/emberDrift/punch/tween/after`) are defined in Task 3 and called in Task 4. `cast(at, skillType, radius, name, element)` arity matches the `fx.ts` call site.
- **No placeholders:** every code step shows full code; the one investigative note (FX subscription method name in Task 2) gives an explicit grep + fallback.
