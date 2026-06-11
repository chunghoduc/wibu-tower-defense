# Antihero Gallery Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 10 Antihero bosses look cinematic, walk with a lively weighty stride, and cast four visually-distinct, impressive skill effects — with zero engine/sim change.

**Architecture:** Three pillars, all presentation-layer. (1) A new pure `"stomp"` walk-warp profile drives a procedural 4-frame boss stride baked at preload into a *separate* texture key (preserving sliced attack/skill frames). (2) A new `BossSkillFx` renderer dispatches four bespoke cast set-pieces (quake/rally/barrier/summon-surge), keyed by a pure mapping. (3) Richer SDXL `BOSS_VISUAL` descriptors regenerate the sprites. The pure-core sim already emits `bossCast{skill,radius,name,uid,at}` and the boss `_skill` one-shot is already wired — nothing in `src/core/` changes.

**Tech Stack:** TypeScript, Phaser 3, Vitest, SDXL art flow (`scripts/sdart/`), CDP playtest.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/scenes/enemyWalkWarp.ts` | pure band-warp math | **modify** — add `"stomp"` profile + `sway?` opt |
| `tests/enemyWalkWarp.test.ts` | warp math tests | **modify** — add `stomp` describe block |
| `src/data/bossSkillVfx.ts` | pure skill-type → signature spec mapping | **create** |
| `tests/bossSkillVfx.test.ts` | mapping tests | **create** |
| `src/scenes/bossWalkBake.ts` | preload canvas baker (separate `__walk` key) | **create** |
| `src/scenes/bossSkillSignatures.ts` | the 4 Phaser cast set-pieces + dispatch | **create** |
| `src/scenes/fx.ts` | dispatch `bossCast` to the new renderer | **modify** |
| `src/scenes/PreloadScene.ts` | call `bakeBossWalks(this)` | **modify** |
| `scripts/sdart/prompts.mjs` | 10 richer `BOSS_VISUAL` descriptors | **modify** |
| `public/assets/sprites/boss/<id>.{png,json}` | regenerated sprites | **regen** |
| `src/data/spriteManifest.ts` | refreshed 10 boss entries | **regen-script** |

All new files are well under 500 lines.

---

## Task 1: Pure `"stomp"` walk profile (TDD)

A boss lumbers: heavier vertical bob, wider leg swing, and a subtle upper-torso lateral sway, distinct from the rank-and-file `"walk"`.

**Files:**
- Modify: `src/scenes/enemyWalkWarp.ts`
- Test: `tests/enemyWalkWarp.test.ts`

- [ ] **Step 1: Write the failing tests** — append this `describe` block to `tests/enemyWalkWarp.test.ts`:

```ts
describe("bandWarp — stomp (boss gait)", () => {
  it("alternates legs at the feet, opposite per side mid-stride", () => {
    const l = bandWarp("stomp", 1, -1, HALF_PI);
    const r = bandWarp("stomp", 1, 1, HALF_PI);
    expect(Math.sign(l.dx)).toBe(-Math.sign(r.dx));
    expect(l.dx).not.toBe(0);
  });

  it("leg swing grows from waist (~0) to feet (max)", () => {
    const waist = Math.abs(bandWarp("stomp", 0.5, 1, HALF_PI).dx);
    const feet = Math.abs(bandWarp("stomp", 1, 1, HALF_PI).dx);
    expect(waist).toBeLessThan(feet);
    expect(waist).toBeCloseTo(0, 5);
  });

  it("neutral foot contact at phase 0 (feet do not shear)", () => {
    expect(bandWarp("stomp", 1, -1, 0).dx).toBeCloseTo(0, 6);
    expect(bandWarp("stomp", 1, 1, 0).dx).toBeCloseTo(0, 6);
  });

  it("is heavier than a normal walk: bigger bob and stride", () => {
    const sBob = Math.abs(bandWarp("stomp", 0.2, 1, HALF_PI).dy);
    const wBob = Math.abs(bandWarp("walk", 0.2, 1, HALF_PI).dy);
    expect(sBob).toBeGreaterThan(wBob);
    const sStride = Math.abs(bandWarp("stomp", 1, 1, HALF_PI).dx);
    const wStride = Math.abs(bandWarp("walk", 1, 1, HALF_PI).dx);
    expect(sStride).toBeGreaterThan(wStride);
  });

  it("all stomp outputs finite over a full cycle", () => {
    for (let p = 0; p <= Math.PI * 2; p += 0.3)
      for (const y of [0, 0.25, 0.5, 0.75, 1])
        for (const s of [-1, 1] as const) {
          const w = bandWarp("stomp", y, s, p);
          expect(Number.isFinite(w.dx)).toBe(true);
          expect(Number.isFinite(w.dy)).toBe(true);
        }
  });
});
```

- [ ] **Step 2: Run the tests, verify they FAIL**

Run: `npx vitest run tests/enemyWalkWarp.test.ts`
Expected: FAIL — the `stomp` branch doesn't exist, `"stomp"` isn't an allowed `MotionProfile`.

- [ ] **Step 3: Implement the `"stomp"` profile** in `src/scenes/enemyWalkWarp.ts`.

Change the type union (line 6):

```ts
export type MotionProfile = "walk" | "flap" | "stomp";
```

Add `sway` to `WarpOpts` (inside the interface, after `flap?`):

```ts
  /** Upper-torso lateral lumber for the boss stomp, px. Default 2.5. */
  sway?: number;
```

Add the `stomp` branch in `bandWarp`, immediately **before** the existing `const legSwing = opts.legSwing ?? 9;` walk code:

```ts
  if (profile === "stomp") {
    const legSwing = opts.legSwing ?? 12;   // wider stride than walk's 9
    const bob = opts.bob ?? 8;              // heavier lift than walk's 4
    const sway = opts.sway ?? 2.5;
    const lw = legWeight(yNorm);
    const tw = yNorm >= WAIST ? 0 : (WAIST - yNorm) / WAIST;
    // legs shear opposite per side; torso counter-leads AND sways side-to-side
    // (sway rides cos(phase) and is weighted to the torso only, so the feet — tw=0 —
    // still rest neutral at phase 0, keeping the contact pose clean).
    const dx = side * legSwing * lw * s - 0.25 * legSwing * tw * s + sway * tw * Math.cos(phase);
    const dy = -bob * Math.abs(s);
    return { dx, dy };
  }
```

(`s`, `WAIST`, `legWeight`, and the walk constants already exist above/below this point — leave them.)

- [ ] **Step 4: Run the tests, verify they PASS**

Run: `npx vitest run tests/enemyWalkWarp.test.ts`
Expected: PASS (all walk, flap, and the 5 new stomp tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/enemyWalkWarp.ts tests/enemyWalkWarp.test.ts
git commit -m "feat(bosses): heavy 'stomp' walk-warp profile for boss gait

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure boss-skill → signature mapping (TDD)

A tiny, data-tested mapping from a boss skill type to its VFX signature + theme color + label. Mirrors `skillVfxMeta.ts`.

**Files:**
- Create: `src/data/bossSkillVfx.ts`
- Test: `tests/bossSkillVfx.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/bossSkillVfx.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bossSkillSignature } from "../src/data/bossSkillVfx.ts";
import { ANTIHERO_BOSSES } from "../src/data/enemiesAntiheroes.ts";

describe("bossSkillSignature", () => {
  it("maps each known skill type to its own named signature", () => {
    expect(bossSkillSignature("quake").signature).toBe("quake");
    expect(bossSkillSignature("rally").signature).toBe("rally");
    expect(bossSkillSignature("barrier").signature).toBe("barrier");
    expect(bossSkillSignature("summon-surge").signature).toBe("summon-surge");
  });

  it("gives each signature a distinct theme color", () => {
    const colors = ["quake", "rally", "barrier", "summon-surge"].map((s) => bossSkillSignature(s).color);
    expect(new Set(colors).size).toBe(4);
  });

  it("falls back to the generic ring for an unknown type", () => {
    expect(bossSkillSignature("nonsense").signature).toBe("ring");
  });

  it("every Antihero boss's skill resolves to a real (non-ring) signature", () => {
    for (const b of ANTIHERO_BOSSES) {
      if (!b.boss?.skill) continue;
      const sig = bossSkillSignature(b.boss.skill.type);
      expect(sig.signature, b.id).not.toBe("ring");
    }
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/bossSkillVfx.test.ts`
Expected: FAIL — `Cannot find module '../src/data/bossSkillVfx.ts'`.

- [ ] **Step 3: Implement** — create `src/data/bossSkillVfx.ts`:

```ts
// Pure mapping: a boss active-skill TYPE -> its cast-VFX signature, theme colour
// and on-screen label. One source of truth shared by the unit test and the
// scene-side renderer (bossSkillSignatures.ts). No Phaser import — stays testable.

export type BossSignature = "quake" | "rally" | "barrier" | "summon-surge" | "ring";

export interface BossSignatureSpec {
  /** Which bespoke set-piece to draw ("ring" = the cheap legacy fallback). */
  signature: BossSignature;
  /** Theme colour (also tints the legacy ring). */
  color: number;
  /** Short flavour label floated on cast (empty for the fallback). */
  label: string;
}

const SPECS: Record<string, BossSignatureSpec> = {
  "quake":        { signature: "quake",        color: 0xff5a4a, label: "EARTHSHATTER" },
  "rally":        { signature: "rally",        color: 0x9ccc65, label: "WAR ROAR" },
  "barrier":      { signature: "barrier",      color: 0x8ad8ff, label: "AEGIS DOME" },
  "summon-surge": { signature: "summon-surge", color: 0xb085f5, label: "RIFT SUMMON" },
};

const FALLBACK: BossSignatureSpec = { signature: "ring", color: 0xff5a4a, label: "" };

/** Resolve a boss skill type to its VFX signature spec (never throws). */
export function bossSkillSignature(skillType: string): BossSignatureSpec {
  return SPECS[skillType] ?? FALLBACK;
}
```

- [ ] **Step 4: Run it, verify it PASSES**

Run: `npx vitest run tests/bossSkillVfx.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/bossSkillVfx.ts tests/bossSkillVfx.test.ts
git commit -m "feat(bosses): pure boss-skill VFX signature mapping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Boss walk baker — lively stride at preload

Synthesize a 4-frame `"stomp"` stride per boss into a **separate** canvas texture (`boss__<id>__walk`), then rebuild the `boss__<id>_walk` anim from it. The original `boss__<id>` texture (with sliced `atk*/skill*` frames) is left untouched, so the already-wired `_skill` one-shot still plays.

**Files:**
- Create: `src/scenes/bossWalkBake.ts`
- Modify: `src/scenes/PreloadScene.ts`

> No unit test: this is canvas/DOM scene code, same boundary as the existing `enemyWalkBake.ts` (verified by build + playtest in Task 6). The math it relies on (`bandWarp("stomp", …)`) is already tested in Task 1.

- [ ] **Step 1: Create `src/scenes/bossWalkBake.ts`:**

```ts
// Preload-time synthesis of a heavy 4-frame "stomp" walk cycle for every BOSS,
// baked from the FIRST frame of its loaded SDXL sprite by warping horizontal
// bands (see enemyWalkWarp.ts, "stomp" profile). Unlike enemyWalkBake, this
// writes to a SEPARATE texture key (`boss__<id>__walk`) and never removes the
// original texture, so the sliced atk*/skill* one-shot frames + their anims
// (built earlier in PreloadScene.create) survive for the boss cast pose.
import Phaser from "phaser";
import { ENEMIES } from "../data/enemies.ts";
import { bandWarp } from "./enemyWalkWarp.ts";

const FRAMES = 4;   // contact-L → passing → contact-R → passing
const BANDS = 24;   // horizontal slices per frame

const BOSS_IDS = ENEMIES.filter((e) => e.archetype === "Boss").map((e) => e.id);

/** Bake one boss's stomp cycle. Idempotent (skips if the walk texture exists). */
function bakeOne(scene: Phaser.Scene, id: string): void {
  const key = `boss__${id}`;
  const walkKey = `${key}__walk`;
  if (!scene.textures.exists(key)) return;
  if (scene.textures.exists(walkKey)) return; // re-entry safe

  // Bake from the FIRST frame only (the sheet may hold atk/skill frames too).
  const frame0 = scene.textures.getFrame(key, 0);
  if (!frame0) return;
  const fw = frame0.cutWidth, fh = frame0.cutHeight;
  const ox = frame0.cutX, oy = frame0.cutY;
  if (!fw || !fh) return;

  const src = scene.textures.get(key).getSourceImage() as CanvasImageSource;
  const cx = fw / 2;

  const canvas = document.createElement("canvas");
  canvas.width = fw * FRAMES;
  canvas.height = fh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (let f = 0; f < FRAMES; f++) {
    const phase = (f / FRAMES) * Math.PI * 2;
    const baseX = f * fw;
    for (let b = 0; b < BANDS; b++) {
      const sy = Math.floor((b / BANDS) * fh);
      const sh = Math.ceil(fh / BANDS) + 1;            // +1px overlap hides seams
      const yNorm = (sy + sh / 2) / fh;
      for (const side of [-1, 1] as const) {
        const sx = side < 0 ? 0 : Math.floor(cx);
        const sw = side < 0 ? Math.ceil(cx) : fw - Math.floor(cx);
        const { dx, dy } = bandWarp("stomp", yNorm, side, phase);
        ctx.drawImage(src, ox + sx, oy + sy, sw, sh, baseX + sx + dx, sy + dy, sw, sh);
      }
    }
  }

  const tex = scene.textures.addCanvas(walkKey, canvas);
  if (!tex) return;
  for (let f = 0; f < FRAMES; f++) tex.add(`walk${f + 1}`, 0, f * fw, 0, fw, fh);

  // Replace the preload-built 2-frame fake walk with the real baked stride.
  if (scene.anims.exists(`${key}_walk`)) scene.anims.remove(`${key}_walk`);
  scene.anims.create({
    key: `${key}_walk`,
    frames: Array.from({ length: FRAMES }, (_, f) => ({ key: walkKey, frame: `walk${f + 1}` })),
    frameRate: 6,   // a touch slower than enemies (7) — bosses are heavy
    repeat: -1,
  });
}

/** Bake every boss's stomp cycle. Call once from PreloadScene.create(). */
export function bakeBossWalks(scene: Phaser.Scene): void {
  for (const id of BOSS_IDS) bakeOne(scene, id);
}
```

- [ ] **Step 2: Wire it into preload.** In `src/scenes/PreloadScene.ts`, add the import near the existing `bakeEnemyWalks` import:

```ts
import { bakeBossWalks } from "./bossWalkBake.ts";
```

Then in `create()`, immediately after the existing `bakeEnemyWalks(this);` line (currently line 95):

```ts
    bakeBossWalks(this); // synthesize the heavy 4-frame stomp stride for bosses
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/bossWalkBake.ts src/scenes/PreloadScene.ts
git commit -m "feat(bosses): bake a lively stomp walk cycle for every boss

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Four bespoke boss-skill cast set-pieces

Replace the single generic `bossCast` ring with four distinct, dramatic effects dispatched by skill type. Mirrors `skillSignatures.ts` (self-destructing Phaser shapes + tweens, no art).

**Files:**
- Create: `src/scenes/bossSkillSignatures.ts`
- Modify: `src/scenes/fx.ts`

> Scene-side rendering — not unit-tested (matches `skillSignatures.ts`). The type→signature dispatch is already tested in Task 2; this draws each one.

- [ ] **Step 1: Create `src/scenes/bossSkillSignatures.ts`:**

```ts
// Bespoke per-boss-skill cast set-pieces. Each of the four boss skill types
// (quake/rally/barrier/summon-surge) renders ONE unique, dramatic signature from
// Phaser shapes + tweens — no art assets. Dispatched from fx.ts by skill type via
// bossSkillSignature(); an unknown type draws the cheap legacy ring. Every object
// self-destructs on tween-complete, so this stays stateless between casts.
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";
import { bossSkillSignature } from "../data/bossSkillVfx.ts";
import { makeCrisp } from "./ui.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;
const ADD = Phaser.BlendModes.ADD;

export class BossSkillFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Fac,
    private readonly depth: number,
  ) {}

  /** Entry point: draw the signature for `skillType` at `at`. */
  cast(at: Vec2, skillType: string, radius: number, name: string): void {
    const spec = bossSkillSignature(skillType);
    this.label(at, name, spec.color);
    switch (spec.signature) {
      case "quake":        this.quake(at, radius, spec.color); break;
      case "rally":        this.rally(at, radius, spec.color); break;
      case "barrier":      this.barrier(at, radius, spec.color); break;
      case "summon-surge": this.summonSurge(at, radius, spec.color); break;
      default:             this.ring(at, radius, spec.color, 600);
    }
  }

  // ---- signatures ----------------------------------------------------------

  /** EARTHSHATTER — radial fissures, a slam ring, launched rock shards, heavy shake. */
  private quake(at: Vec2, R: number, color: number): void {
    this.scene.cameras.main.shake(260, 0.011);
    this.ring(at, R, color, 520, 5);
    this.after(90, () => this.ring(at, R * 0.7, 0xffe0b0, 360, 3));
    // ground fissures: thin dark wedges radiating out
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + 0.2;
      const len = R * (0.7 + Math.random() * 0.5);
      const crack = this.fac.rectangle(at.x, at.y, 4, 3, 0x2a1a12).setOrigin(0, 0.5)
        .setRotation(a).setDepth(this.depth);
      this.tween(crack, { scaleX: len / 4, alpha: 0 }, 520, "Cubic.easeOut");
    }
    // launched rock shards arcing up then fading
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const d = R * (0.4 + Math.random() * 0.6);
      const rock = this.fac.rectangle(at.x, at.y, 5, 5, 0x6b4a36).setDepth(this.depth + 2)
        .setRotation(Math.random() * Math.PI);
      this.tween(rock, { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d - 18, angle: 220, alpha: 0 }, 560, "Quad.easeOut");
    }
    this.disc(at, 16, color, 0.7, 2.6, 420);
  }

  /** WAR ROAR — concentric red shockwaves, rising chevrons, an empowerment flash. */
  private rally(at: Vec2, R: number, color: number): void {
    this.scene.cameras.main.flash(160, 120, 20, 20);
    for (let k = 0; k < 3; k++) this.after(k * 110, () => this.ring(at, R, color, 520, 4));
    this.disc(at, 14, color, 0.6, 2.4, 460);
    // rising battle chevrons (allies emboldened)
    for (let i = 0; i < 7; i++) {
      const ox = (Math.random() - 0.5) * R * 1.2;
      const chev = this.fac.star(at.x + ox, at.y + 8, 3, 3, 8, color).setDepth(this.depth + 2).setBlendMode(ADD);
      this.tween(chev, { y: at.y - R * 0.7, alpha: 0, scale: 0.4 }, 700, "Quad.easeOut", i * 30);
    }
  }

  /** AEGIS DOME — hex plates assemble into a shimmering locked dome. */
  private barrier(at: Vec2, R: number, color: number): void {
    const dome = this.fac.circle(at.x, at.y, R * 0.9, color, 0.12).setStrokeStyle(3, color, 0.85)
      .setDepth(this.depth + 1).setScale(0.2);
    this.scene.tweens.add({ targets: dome, scale: 1, duration: 320, ease: "Back.easeOut",
      onComplete: () => this.tween(dome, { alpha: 0, scale: 1.06 }, 520, "Quad.easeIn", 280) });
    // hex plates spiral inward and lock onto the dome
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const sx = at.x + Math.cos(a) * R * 1.4, sy = at.y + Math.sin(a) * R * 1.4;
      const hex = this.fac.star(sx, sy, 6, 5, 9, color, 0.9).setDepth(this.depth + 2).setBlendMode(ADD);
      this.tween(hex, { x: at.x + Math.cos(a) * R * 0.82, y: at.y + Math.sin(a) * R * 0.82, alpha: 0.2, angle: 90 }, 360, "Cubic.easeOut", i * 18);
    }
    this.after(360, () => this.ring(at, R * 0.9, 0xffffff, 300, 2));
  }

  /** RIFT SUMMON — a torn portal with a violet horizon, glyph spin, converging claws. */
  private summonSurge(at: Vec2, R: number, color: number): void {
    this.scene.cameras.main.shake(180, 0.006);
    // the rift core: a dark vertical tear with a violet glow
    const tear = this.fac.ellipse(at.x, at.y, 10, R * 0.5, 0x120018, 0.95).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: tear, scaleX: 3.2, duration: 260, ease: "Back.easeOut",
      onComplete: () => this.tween(tear, { scaleX: 0, alpha: 0 }, 420, "Quad.easeIn", 240) });
    const glow = this.fac.ellipse(at.x, at.y, 18, R * 0.55, color, 0.5).setDepth(this.depth).setBlendMode(ADD);
    this.tween(glow, { scaleX: 3.4, alpha: 0 }, 640, "Cubic.easeOut");
    // spiralling summon glyph
    const glyph = this.fac.star(at.x, at.y, 5, R * 0.18, R * 0.42, color, 0).setStrokeStyle(2, color, 0.9)
      .setDepth(this.depth + 2).setBlendMode(ADD);
    this.tween(glyph, { angle: 200, alpha: 0, scale: 0.4 }, 560, "Quad.easeOut");
    // grasping claw-motes converging then bursting outward
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const claw = this.fac.circle(at.x + Math.cos(a) * R, at.y + Math.sin(a) * R, 3, color).setDepth(this.depth + 2).setBlendMode(ADD);
      this.tween(claw, { x: at.x, y: at.y, alpha: 0.2 }, 300, "Quad.easeIn", i * 12);
    }
  }

  // ---- shared primitives ---------------------------------------------------

  private label(at: Vec2, name: string, color: number): void {
    if (!name) return;
    const t = makeCrisp(this.fac.text(at.x, at.y - 34, name, {
      fontFamily: '"Trebuchet MS", system-ui, sans-serif', fontSize: "13px",
      color: "#fff", fontStyle: "bold", stroke: "#1a0808", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.depth + 5));
    t.setTint?.(color);
    this.tween(t, { y: at.y - 56, alpha: 0 }, 1100, "Quad.easeOut");
  }

  private ring(at: Vec2, radius: number, color: number, dur: number, width = 3): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(width, color, 0.9).setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, dur, "Cubic.easeOut");
  }

  private disc(at: Vec2, r: number, color: number, alpha: number, grow: number, dur: number): void {
    const d = this.fac.circle(at.x, at.y, r, color, alpha).setDepth(this.depth + 3).setBlendMode(ADD);
    this.tween(d, { scale: grow, alpha: 0 }, dur, "Cubic.easeOut");
  }

  private tween(o: Phaser.GameObjects.GameObject, props: Record<string, number>, dur: number, ease = "Quad.easeOut", delay = 0): void {
    this.scene.tweens.add({ targets: o, ...props, duration: dur, ease, delay, onComplete: () => o.destroy() });
  }

  private after(ms: number, fn: () => void): void {
    this.scene.time.delayedCall(ms, fn);
  }
}
```

- [ ] **Step 2: Wire it into `fx.ts`.** Add the import after the `LootFlyFx` import (line 16):

```ts
import { BossSkillFx } from "./bossSkillSignatures.ts";
```

Add a field after `lootFly` (line 40):

```ts
  /** Bespoke per-skill boss cast set-pieces (quake/rally/barrier/summon-surge). */
  private readonly bossFx: BossSkillFx;
```

Construct it after `this.lootFly = …` (line 63):

```ts
    this.bossFx = new BossSkillFx(scene, this.fac, this.depth);
```

Replace the body of the existing private `bossCast(...)` method (lines 128–144) with a one-line delegate, and delete the old ring/core/particle/label/shake code:

```ts
  /** A menacing boss-skill cast — dispatched to its bespoke signature. */
  private bossCast(at: Vec2, skill: string, radius: number, name: string): void {
    this.bossFx.cast(at, skill, radius, name);
  }
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: success. (If `setTint` types complain, it's guarded with `?.` — leave as is.)

- [ ] **Step 4: Run the full suite — confirm nothing regressed**

Run: `npx vitest run`
Expected: PASS, including Tasks 1–2's new tests; total = prior 850 + 9 new.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/bossSkillSignatures.ts src/scenes/fx.ts
git commit -m "feat(bosses): four bespoke boss-skill cast set-pieces

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Cinematic sprite descriptors + regenerate art

Rewrite all 10 `BOSS_VISUAL` descriptors to read as epic boss art (battle aura, dramatic rim light, high contrast, imposing stance) while keeping the name-free homage silhouette. Then regenerate the sprites and refresh the manifest.

**Files:**
- Modify: `scripts/sdart/prompts.mjs`
- Regen: `public/assets/sprites/boss/<id>.{png,json}`
- Regen-script: `src/data/spriteManifest.ts`

- [ ] **Step 1: Replace the 10 Antihero entries** in `BOSS_VISUAL` (`scripts/sdart/prompts.mjs`, the block after the `// The Antihero Gallery` comment) with:

```js
  gravemourn: "a towering grim black-armored swordsman boss with a single scarred eye and a battle-worn iron prosthetic forearm, hefting a colossal slab-like greatsword as tall as himself, tattered blood-red cloak billowing, seething dark battle aura, heavy low battle stance, dramatic rim light, high contrast, epic",
  vindicator: "a hardened militant vigilante boss in matte-black tactical armor blazoned with a stark glowing white skull emblem across the chest, crossed ammunition belts, leveling two heavy smoking firearms, muzzle-flash glow, cold merciless stare, gritty dramatic rim light, high contrast, epic",
  sundermark: "a wandering scarred warrior-assassin boss with a large X-shaped facial scar, dark dreadlocks and small round dark glasses, one forearm blazing with glowing crimson destruction runes crackling with red energy, weathered grey traveler's robes flaring, dramatic rim light, high contrast, epic",
  crownfall: "a proud armored warrior-prince boss with sharp upswept flame-shaped black hair, royal blue battle armor over a white bodysuit with white gloves and boots, a blazing golden ki aura erupting around him with electric sparks, arrogant battle scowl, dramatic rim light, high contrast, epic",
  unkilling: "a feral muscular berserker boss with wild dark hair drawn into two sharp points and thick sideburns, a yellow and blue armored bodysuit, three gleaming metal claws extended from each fist glinting, savage crouched lunge, sparks along the claws, dramatic rim light, high contrast, epic",
  mawborn: "a hulking glistening pitch-black symbiote monster boss with a huge fanged maw and bulging white eyes, long writhing tendrils and a massive lashing tongue, dripping silvery alien ooze, menacing hunched lunge, eerie rim light, high contrast, epic",
  devourer: "a colossal skinless titan boss of exposed steaming red musculature wreathed in rising steam, long dark hair framing a gaunt determined glowing-eyed face, towering unstoppable stride, dramatic rim light, epic scale, high contrast",
  crimsonlord: "a lean aristocratic vampire gunslinger boss in a vivid bright crimson-red long coat and matching wide-brimmed red hat, pale white skin, neat black hair, round amber glasses, leveling a long silver pistol wreathed in smoke, swirling red aura, confident grin, dramatic rim light, high contrast, epic",
  fallenward: "a dread armored dark warlord boss in a flowing black cape and full glossy obsidian plate armor, an intimidating skull-like breathing-mask helmet, gripping a humming crimson energy blade casting a red glow, looming menace, dramatic rim light, high contrast, epic",
  ashghost: "a vengeful pale ash-skinned warrior boss with a bold red tattoo sweeping across one eye and a short dark beard, a scarred muscular body, twin chained blades wreathed in roaring fire whirling at his sides, flying embers, cold fury, dramatic rim light, epic scale, high contrast",
```

(Keep the existing `// homage:` comments above/around them unchanged — do not add real names to the data.)

- [ ] **Step 2: Confirm the SDXL art server is up, then regenerate the 10 boss sprites.**

Run: `curl -sf -X POST http://127.0.0.1:8765/generate -H 'Content-Type: application/json' -d '{"prompt":"ping","steps":1,"width":64,"height":64,"seed":1}' -o /dev/null && echo UP || echo DOWN`

If `UP`, regenerate (forces re-slice of all bosses):

Run: `npm run gen:sprites:anim -- --only=boss --force`
Expected: 10 boss sheets generated + sliced into `public/assets/sprites/boss/<id>.{png,json}`. If a boss slices to a low frame count it's fine — the Task 3 bake makes the walk robust. (If the server is `DOWN`, skip regen this run and proceed with existing PNGs; note it in the final report.)

- [ ] **Step 3: Verify each boss png is 160px-tall frames and inspect frame counts.**

Run:
```bash
cd /home/shyaken/Workplace/wibu-tower-defense
for id in gravemourn vindicator sundermark crownfall unkilling mawborn devourer crimsonlord fallenward ashghost; do
  echo -n "$id: "; python3 -c "import json;d=json.load(open('public/assets/sprites/boss/$id.json'));print(d['frames'],'frames',d.get('names'))"
done
```
Expected: each prints a frame count ≥ 1 with 160×160 cells. Note any with only 1 frame.

- [ ] **Step 4: Refresh the 10 manifest entries** from the regenerated JSON sidecars, remapping `idle*` frame names to `walk*` (so any non-baked fallback still loops) — run this Node script:

```bash
cd /home/shyaken/Workplace/wibu-tower-defense
node -e '
const fs = require("fs");
const IDS = ["gravemourn","vindicator","sundermark","crownfall","unkilling","mawborn","devourer","crimsonlord","fallenward","ashghost"];
let t = fs.readFileSync("src/data/spriteManifest.ts","utf8");
for (const id of IDS) {
  const j = JSON.parse(fs.readFileSync(`public/assets/sprites/boss/${id}.json`,"utf8"));
  const names = (j.names||[]).map(n => n.replace(/^idle/, "walk"));
  const entry = JSON.stringify({
    key:`boss__${id}`, kind:"boss", id, path:`assets/sprites/boss/${id}.png`,
    frameWidth:j.frameWidth, frameHeight:j.frameHeight, frames:j.frames, names,
  });
  // replace the existing object whose key is boss__<id>
  const re = new RegExp("\\{\"key\":\"boss__"+id+"\"[\\s\\S]*?\\}");
  if (!re.test(t)) { console.error("NO MATCH for "+id); process.exit(1); }
  t = t.replace(re, entry);
}
fs.writeFileSync("src/data/spriteManifest.ts", t);
console.log("manifest refreshed for", IDS.length, "bosses");
'
```
Expected: `manifest refreshed for 10 bosses`. (Object property order in the existing manifest is `key,kind,id,path,frameWidth,frameHeight,frames,names` — the script reproduces it.)

- [ ] **Step 5: Typecheck + build to confirm the manifest still parses.**

Run: `npx tsc --noEmit && npm run build`
Expected: success.

- [ ] **Step 6: Commit (art + prompts + manifest).**

```bash
git add scripts/sdart/prompts.mjs src/data/spriteManifest.ts public/assets/sprites/boss
git commit -m "feat(bosses): cinematic SDXL descriptors + regenerated boss sprites

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Verify whole — playtest, montage, memory

**Files:** none (verification + memory).

- [ ] **Step 1: Full gate — types, tests, build.**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean; all tests pass (prior 850 + 9 new = 859); build succeeds.

- [ ] **Step 2: Confirm no source file exceeds 500 lines.**

Run:
```bash
cd /home/shyaken/Workplace/wibu-tower-defense
wc -l src/scenes/bossWalkBake.ts src/scenes/bossSkillSignatures.ts src/data/bossSkillVfx.ts src/scenes/enemyWalkWarp.ts src/scenes/fx.ts | sort -n
```
Expected: every file < 500 lines. (If `fx.ts` is near the limit it shrank — the old `bossCast` body was deleted.)

- [ ] **Step 3: CDP playtest — spawn all 10 bosses, force each skill cast, verify lively walk + distinct VFX + the skill frames survived the bake, 0 console errors.**

Run (drives the live game via `scripts/playtest/playtest.mjs`):
```bash
cd /home/shyaken/Workplace/wibu-tower-defense
node scripts/playtest/playtest.mjs --scene BattleScene --stage 30 --wait 1500 \
  --eval '(() => {
    const g = window.__game, sc = g.scene.getScene("BattleScene"); const b = sc.battle;
    const ids = ["gravemourn","vindicator","sundermark","crownfall","unkilling","mawborn","devourer","crimsonlord","fallenward","ashghost"];
    const tex = ids.filter(id => g.textures.exists("boss__"+id)).length;
    const walk = ids.filter(id => g.anims.exists("boss__"+id+"_walk")).length;
    const walkBaked = ids.filter(id => g.textures.exists("boss__"+id+"__walk")).length;
    const skill = ids.filter(id => g.anims.exists("boss__"+id+"_skill") || g.anims.exists("boss__"+id+"_attack")).length;
    ids.forEach((id,i) => b.spawnEnemy({ enemyId: id, fromWave: true }));
    return JSON.stringify({ tex, walk, walkBaked, skillOrAtk: skill, spawned: b.enemies.length });
  })()' --out /tmp/boss-redesign-spawn.png
```
Expected JSON: `tex:10`, `walk:10`, `walkBaked:10`, `skillOrAtk:10`, `spawned:10`.

Then confirm the runtime log is clean:

Run: `tail -n 40 logs/runtime.log | grep -i error || echo "no errors"`
Expected: `no errors` (or no boss-related errors).

- [ ] **Step 4: Capture a montage of the redesigned bosses** for the owner.

Run:
```bash
cd /home/shyaken/Workplace/wibu-tower-defense
python3 - <<'PY'
import os
from PIL import Image
ids = ["gravemourn","vindicator","sundermark","crownfall","unkilling","mawborn","devourer","crimsonlord","fallenward","ashghost"]
cols, cell = 5, 160
rows = (len(ids)+cols-1)//cols
sheet = Image.new("RGBA",(cols*cell, rows*cell),(20,18,26,255))
for i,id in enumerate(ids):
    p=f"public/assets/sprites/boss/{id}.png"
    if not os.path.exists(p): continue
    im=Image.open(p).convert("RGBA").crop((0,0,cell,cell))
    sheet.paste(im,((i%cols)*cell,(i//cols)*cell),im)
sheet.save("/tmp/antihero-redesign.png")
print("wrote /tmp/antihero-redesign.png")
PY
```
Expected: `wrote /tmp/antihero-redesign.png`.

- [ ] **Step 5: Update memory** — append a visual-redesign note to `~/.claude/projects/-home-shyaken-Workplace-wibu-tower-defense/memory/project_antihero_bosses.md` (a new `**Visual redesign (2026-06-12):**` paragraph) covering: the `"stomp"` walk-warp profile + `bossWalkBake.ts` (separate `boss__<id>__walk` texture, preserves sliced atk/skill frames), the four `BossSkillFx` signatures dispatched via pure `bossSkillVfx.ts`, and the cinematic `BOSS_VISUAL` reprompt. Link `[[project_procedural_sprite_animation]]` and `[[project_skill_vfx_signatures]]`.

- [ ] **Step 6: Final confirmation — clean tree.**

Run: `git status --porcelain`
Expected: empty (all committed). If the playtest wrote artifacts under the repo, they're in `/tmp` (ignored) — confirm none are staged.

Report to the owner: what changed across the three pillars, the verification numbers (tests, playtest JSON), and deliver `/tmp/antihero-redesign.png`. Do **not** push/deploy without an explicit instruction.

---

## Self-review

**Spec coverage:**
- Pillar 1 (cooler sprites) → Task 5 (descriptors + regen + manifest). ✓
- Pillar 2 (lively walk) → Task 1 (`stomp` math) + Task 3 (baker, separate texture key). ✓ Preserves atk/skill frames (the spec's top risk) — baker never removes the original texture. ✓
- Pillar 3 (impressive VFX) → Task 2 (pure mapping) + Task 4 (four set-pieces + fx dispatch). ✓ Boss body-pose-on-cast is already wired (`battleSceneSprites.ts:55` `playSpriteOneShot(... ["skill","attack"], "walk")`) and Task 3 keeps those frames alive — verified in Task 6 Step 3 (`skillOrAtk:10`). ✓
- Testing plan → Task 1, 2 unit tests; Task 6 regression + CDP playtest + montage. ✓
- Risks (bake clobber, stomp wobble, reprompt regression, FPS) → designed out / falsified in Task 6 + bounded particle counts. ✓

**Placeholder scan:** none — all code, commands, and expected outputs are concrete.

**Type/name consistency:** `MotionProfile` adds `"stomp"` (Task 1) used by `bandWarp("stomp", …)` (Task 3). `bossSkillSignature()` + `BossSignatureSpec.signature` (Task 2) consumed by `BossSkillFx.cast` switch (Task 4). `bakeBossWalks` (Task 3) imported in PreloadScene (Task 3 Step 2). `BossSkillFx` (Task 4) constructed in fx.ts (Task 4 Step 2). Texture key `boss__<id>__walk` and anim key `boss__<id>_walk` are used consistently in Task 3 and asserted in Task 6. All consistent. ✓
