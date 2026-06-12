# Cinematic Living Throne-Hall — Main-Menu Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the dead, double-throne main menu into a cinematic, *alive* throne hall — god-ray shafts, drifting dust, rising embers, a warm key-light behind the throne, and a true radial vignette — backed by a regenerated throne-less hall image.

**Architecture:** A pure, seeded layout module (`menuAtmosphere.ts`) produces plain-data specs + deterministic animation helpers; a Phaser presenter (`menuBackdropFx.ts`) draws a static layer once and redraws an animated layer each frame, sitting between the painted backdrop (depth −10) and the diorama (depth ≥1). `MainMenuScene` darkens the painted hall, drops its flat bars, builds the FX, and ticks it in `update()`. A best-effort one-off script regenerates the SDXL hall art without a baked throne.

**Tech Stack:** TypeScript, Phaser 3, Vitest, the project `Rng` (mulberry32), the live Z-Image API at `127.0.0.1:8765/generate`.

---

### Task 1: Pure atmosphere spec + animation helpers (TDD)

**Files:**
- Create: `src/scenes/menuAtmosphere.ts`
- Test: `tests/menuAtmosphere.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  buildMenuAtmosphere, motePos, emberPos, rayAlpha, flicker,
} from "../src/scenes/menuAtmosphere.ts";

const W = 960, H = 540, SEED = 1337;
const dims = { width: W, height: H };

describe("buildMenuAtmosphere", () => {
  it("is deterministic for a fixed seed", () => {
    expect(buildMenuAtmosphere(W, H, SEED)).toEqual(buildMenuAtmosphere(W, H, SEED));
  });

  it("produces populated, sane layers", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    expect(s.rays.length).toBeGreaterThanOrEqual(3);
    expect(s.motes.length).toBeGreaterThan(10);
    expect(s.embers.length).toBeGreaterThan(10);
    expect(s.torches.length).toBeGreaterThan(0);
    // vignette pulls focus a bit ABOVE mid-screen (onto the hero/throne)
    expect(s.vignette.cy).toBeLessThan(H / 2);
    expect(s.vignette.innerR).toBeLessThan(s.vignette.outerR);
    // key light sits high-centre, behind the throne
    expect(Math.abs(s.keyLight.x - W / 2)).toBeLessThan(W * 0.2);
    expect(s.keyLight.y).toBeLessThan(H * 0.6);
  });

  it("places every mote and ember inside the canvas at t=0", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    for (const m of s.motes) {
      const p = motePos(m, 0, dims);
      expect(p.x).toBeGreaterThanOrEqual(-20); expect(p.x).toBeLessThanOrEqual(W + 20);
      expect(p.y).toBeGreaterThanOrEqual(-20); expect(p.y).toBeLessThanOrEqual(H + 20);
    }
    for (const e of s.embers) {
      const p = emberPos(e, 0, dims);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(H);
    }
  });

  it("keeps positions finite and embers rising across a time sweep", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    const e = s.embers[0];
    const y0 = emberPos(e, 0, dims).y, y1 = emberPos(e, 0.5, dims).y;
    expect(y1).toBeLessThan(y0); // embers drift upward
    for (let t = 0; t < 12; t += 0.37) {
      for (const m of s.motes) {
        const p = motePos(m, t, dims);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it("rayAlpha and flicker are bounded in [0,1] and vary with t", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    const r = s.rays[0];
    const a0 = rayAlpha(r, 0), a1 = rayAlpha(r, 1.3);
    for (const a of [a0, a1]) { expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(1); }
    expect(a0).not.toBe(a1);
    const f0 = flicker(0, 0.3), f1 = flicker(0.9, 0.3);
    for (const f of [f0, f1]) { expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThanOrEqual(1); }
    expect(f0).not.toBe(f1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/menuAtmosphere.test.ts`
Expected: FAIL — `buildMenuAtmosphere is not a function` (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Pure, seeded layout + animation maths for the main-menu "living throne hall"
 * atmosphere layer (god-rays, dust motes, brazier embers, vignette, key light,
 * torch flicker). Plain data only — no Phaser, no Date.now — so the look is
 * deterministic and unit-testable. menuBackdropFx.ts is the presenter. See
 * docs/superpowers/specs/2026-06-12-cinematic-menu-backdrop-design.md.
 */
import { Rng } from "../core/rng.ts";

export interface Dims { width: number; height: number; }
export interface Vignette { cx: number; cy: number; innerR: number; outerR: number; edgeAlpha: number; }
export interface KeyLight { x: number; y: number; r: number; color: number; }
/** A volumetric god-ray shaft falling from the top edge. */
export interface Ray { x: number; topW: number; botW: number; len: number; tilt: number; color: number; baseAlpha: number; phase: number; }
/** Slow floating dust speck: gentle drift + bob, wraps in x. */
export interface Mote { x: number; y: number; r: number; drift: number; rise: number; phase: number; alpha: number; }
/** Warm ember rising from a brazier: steady rise (wraps) + sine sway. */
export interface Ember { x: number; y: number; r: number; speed: number; drift: number; phase: number; alpha: number; }
/** A flickering torch/brazier light point. */
export interface Torch { x: number; y: number; r: number; color: number; phase: number; }

export interface MenuAtmosphereSpec {
  vignette: Vignette;
  keyLight: KeyLight;
  rays: Ray[];
  motes: Mote[];
  embers: Ember[];
  torches: Torch[];
  dims: Dims;
}

const RAY_COUNT = 5;
const MOTE_COUNT = 46;
const EMBER_COUNT = 34;
const RAY_COLOR = 0xffe6b0;

export function buildMenuAtmosphere(W: number, H: number, seed: number): MenuAtmosphereSpec {
  const rng = new Rng(seed * 2654435761 + 11);
  const dims: Dims = { width: W, height: H };
  const outerR = Math.hypot(W, H) / 2;

  const vignette: Vignette = {
    cx: W / 2, cy: H * 0.44,
    innerR: Math.round(outerR * 0.30), outerR: Math.round(outerR * 1.02), edgeAlpha: 0.72,
  };
  const keyLight: KeyLight = { x: W / 2, y: H * 0.40, r: Math.round(H * 0.42), color: 0xffd27a };

  // God-rays: a few wide soft shafts slanting down from the top windows.
  const rays: Ray[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const x = W * (0.12 + 0.76 * (i / (RAY_COUNT - 1))) + (rng.next() - 0.5) * 40;
    rays.push({
      x,
      topW: 26 + rng.next() * 34,
      botW: 80 + rng.next() * 90,
      len: H * (0.7 + rng.next() * 0.35),
      tilt: (rng.next() - 0.5) * 90, // px horizontal drift over the shaft length
      color: RAY_COLOR,
      baseAlpha: 0.05 + rng.next() * 0.06,
      phase: rng.next() * Math.PI * 2,
    });
  }

  // Dust motes: scattered everywhere, slow.
  const motes: Mote[] = [];
  for (let i = 0; i < MOTE_COUNT; i++) {
    motes.push({
      x: rng.next() * W, y: rng.next() * H,
      r: 0.6 + rng.next() * 1.6,
      drift: 8 + rng.next() * 20,
      rise: 4 + rng.next() * 10,
      phase: rng.next() * Math.PI * 2,
      alpha: 0.12 + rng.next() * 0.28,
    });
  }

  // Embers rise from the two side braziers (the lit walls of the hall).
  const embers: Ember[] = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    const left = i % 2 === 0;
    const bx = left ? W * (0.14 + rng.next() * 0.06) : W * (0.80 + rng.next() * 0.06);
    embers.push({
      x: bx, y: H * (0.55 + rng.next() * 0.45),
      r: 1 + rng.next() * 2.2,
      speed: 10 + rng.next() * 26,
      drift: 5 + rng.next() * 12,
      phase: rng.next() * Math.PI * 2,
      alpha: 0.3 + rng.next() * 0.5,
    });
  }

  const torches: Torch[] = [
    { x: W * 0.16, y: H * 0.52, r: 30, color: 0xff9a3c, phase: rng.next() * Math.PI * 2 },
    { x: W * 0.84, y: H * 0.52, r: 30, color: 0xff9a3c, phase: rng.next() * Math.PI * 2 },
  ];

  return { vignette, keyLight, rays, motes, embers, torches, dims };
}

/** Mote position at time `tSec`: slow upward rise (wraps) + horizontal sway. Pure. */
export function motePos(m: Mote, tSec: number, dims: Dims): { x: number; y: number } {
  let y = (m.y - m.rise * tSec) % dims.height;
  if (y < 0) y += dims.height;
  let x = m.x + Math.sin(tSec * 0.5 + m.phase) * m.drift;
  x = ((x % dims.width) + dims.width) % dims.width;
  return { x, y };
}

/** Ember position at time `tSec`: steady rise (wraps within the lower hall) + sway. Pure. */
export function emberPos(e: Ember, tSec: number, dims: Dims): { x: number; y: number } {
  let y = (e.y - e.speed * tSec) % dims.height;
  if (y < 0) y += dims.height;
  const x = e.x + Math.sin(tSec * 0.9 + e.phase) * e.drift;
  return { x, y };
}

/** God-ray live alpha: base intensity gently breathing in [0,1]. Pure. */
export function rayAlpha(r: Ray, tSec: number): number {
  const a = r.baseAlpha * (0.7 + 0.3 * Math.sin(tSec * 0.6 + r.phase));
  return Math.max(0, Math.min(1, a));
}

/** Torch flicker multiplier in [0,1]: layered sines so it reads as fire. Pure. */
export function flicker(tSec: number, phase: number): number {
  const v = 0.72 + 0.18 * Math.sin(tSec * 11 + phase) + 0.10 * Math.sin(tSec * 23 + phase * 1.7);
  return Math.max(0, Math.min(1, v));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/menuAtmosphere.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/scenes/menuAtmosphere.ts tests/menuAtmosphere.test.ts
git commit -m "feat(menu-bg): pure seeded throne-hall atmosphere spec + anim helpers"
```

---

### Task 2: `MenuBackdropFx` presenter

**Files:**
- Create: `src/scenes/menuBackdropFx.ts`

No new unit test (Phaser-rendering code is verified by the headless playtest in
Task 4 — same convention as `EndlessBackdropFx`). The pure maths it consumes is
already covered by Task 1.

- [ ] **Step 1: Write the presenter**

```ts
/**
 * Presenter for the main-menu "living throne hall" atmosphere. Draws the static
 * pieces once (whole-screen darken, radial vignette, warm key-light behind the
 * throne, soft god-ray cones) and animates the live pieces each frame (ray
 * shimmer, drifting dust motes, rising brazier embers, torch flicker). Sits
 * above the painted backdrop (depth -10) and below the diorama (throne depth 1).
 * Pure geometry comes from menuAtmosphere.ts. See
 * docs/superpowers/specs/2026-06-12-cinematic-menu-backdrop-design.md.
 */
import Phaser from "phaser";
import type { MenuAtmosphereSpec } from "./menuAtmosphere.ts";
import { motePos, emberPos, rayAlpha, flicker } from "./menuAtmosphere.ts";

const ADD = Phaser.BlendModes.ADD;

export class MenuBackdropFx {
  private base: Phaser.GameObjects.Graphics;   // static, normal blend (darken + vignette)
  private glow: Phaser.GameObjects.Graphics;   // static, additive (key light + ray cones)
  private anim: Phaser.GameObjects.Graphics;   // per-frame, additive

  constructor(scene: Phaser.Scene, private spec: MenuAtmosphereSpec) {
    this.base = scene.add.graphics().setDepth(-8);
    this.glow = scene.add.graphics().setDepth(-8).setBlendMode(ADD);
    this.anim = scene.add.graphics().setDepth(-7).setBlendMode(ADD);
    this.drawStatic();
  }

  private drawStatic(): void {
    const { dims, vignette: v, keyLight: k, rays } = this.spec;
    // Whole-screen darken so the busy painted hall recedes behind the lit diorama.
    this.base.fillStyle(0x05070c, 0.36).fillRect(0, 0, dims.width, dims.height);
    // Radial vignette: stacked translucent rings, dark at the rim, clear at the hero.
    const RINGS = 18, ringW = (v.outerR - v.innerR) / RINGS + 3;
    for (let i = 1; i <= RINGS; i++) {
      const t = i / RINGS;
      this.base.lineStyle(ringW, 0x000000, (v.edgeAlpha * t * t) / 3);
      this.base.strokeCircle(v.cx, v.cy, v.innerR + (v.outerR - v.innerR) * t);
    }
    // Warm key light behind the throne (additive, soft falloff via stacked discs).
    for (let i = 6; i >= 1; i--) {
      this.glow.fillStyle(k.color, 0.05).fillCircle(k.x, k.y, (k.r * i) / 6);
    }
    // Static god-ray cones (the shimmer rides on top in update()).
    for (const r of rays) {
      this.glow.fillStyle(r.color, r.baseAlpha * 0.7);
      this.glow.beginPath();
      this.glow.moveTo(r.x - r.topW / 2, 0);
      this.glow.lineTo(r.x + r.topW / 2, 0);
      this.glow.lineTo(r.x + r.tilt + r.botW / 2, r.len);
      this.glow.lineTo(r.x + r.tilt - r.botW / 2, r.len);
      this.glow.closePath();
      this.glow.fillPath();
    }
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    const g = this.anim;
    g.clear();
    const { dims, rays, motes, embers, torches } = this.spec;

    // Ray shimmer: a brighter narrow core, alpha breathing.
    for (const r of rays) {
      g.fillStyle(r.color, rayAlpha(r, t));
      g.beginPath();
      g.moveTo(r.x - r.topW / 4, 0);
      g.lineTo(r.x + r.topW / 4, 0);
      g.lineTo(r.x + r.tilt + r.botW / 4, r.len);
      g.lineTo(r.x + r.tilt - r.botW / 4, r.len);
      g.closePath();
      g.fillPath();
    }
    // Torch flicker pools.
    for (const tr of torches) {
      g.fillStyle(tr.color, 0.10 + 0.16 * flicker(t, tr.phase));
      g.fillCircle(tr.x, tr.y, tr.r * (0.85 + 0.25 * flicker(t, tr.phase)));
    }
    // Dust motes (cool/white) and rising embers (warm).
    for (const m of motes) {
      const p = motePos(m, t, dims);
      g.fillStyle(0xfff4d8, m.alpha);
      g.fillCircle(p.x, p.y, m.r);
    }
    for (const e of embers) {
      const p = emberPos(e, t, dims);
      g.fillStyle(0xffb060, e.alpha);
      g.fillCircle(p.x, p.y, e.r);
    }
  }

  destroy(): void {
    this.base.destroy();
    this.glow.destroy();
    this.anim.destroy();
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/scenes/menuBackdropFx.ts
git commit -m "feat(menu-bg): MenuBackdropFx presenter (vignette, key light, rays, motes, embers)"
```

---

### Task 3: Wire the FX into `MainMenuScene`

**Files:**
- Modify: `src/scenes/MainMenuScene.ts` (imports; field; `create`; `update`; `drawBackdrop`)

- [ ] **Step 1: Add imports**

At the top of `src/scenes/MainMenuScene.ts`, after the existing `bgKey` import line (`import { bgKey } from "../data/bgManifest.ts";`), add:

```ts
import { buildMenuAtmosphere } from "./menuAtmosphere.ts";
import { MenuBackdropFx } from "./menuBackdropFx.ts";
```

- [ ] **Step 2: Add the field + a stable seed constant**

Just below `const BTN = 58;` add:

```ts
const ATMOSPHERE_SEED = 4242; // stable look every time the menu is entered
```

Inside the class, next to `private pet?: ...`, add:

```ts
  private backdropFx?: MenuBackdropFx; // re-init in create() (scene reuse)
```

- [ ] **Step 3: Reset + build the FX in `create()`**

In `create()`, where the per-entry state is reset (the line `this.pet = undefined;`), add right after it:

```ts
    this.backdropFx = undefined; // scene instances are reused — reset per-entry state
```

`drawBackdrop` (called next) will construct it.

- [ ] **Step 4: Replace `drawBackdrop` body**

Replace the whole `drawBackdrop` method with:

```ts
  // ── backdrop ──────────────────────────────────────────────────────────────
  private drawBackdrop(W: number, H: number): void {
    if (this.textures.exists(bgKey("menu-hall"))) {
      this.add.image(W / 2, H / 2, bgKey("menu-hall")).setDisplaySize(W, H).setDepth(-10);
    } else {
      this.add.graphics().setDepth(-10).fillStyle(0x161b28, 1).fillRect(0, 0, W, H);
    }
    // Living throne-hall atmosphere: god-rays, dust, embers, key light, vignette.
    // Also darkens the painted hall so the lit diorama (throne + hero) reads as
    // the single focal subject (fixes the old double-throne clutter).
    this.backdropFx = new MenuBackdropFx(this, buildMenuAtmosphere(W, H, ATMOSPHERE_SEED));
  }
```

- [ ] **Step 5: Tick the FX in `update()`**

Replace the `update` method body's guard/return so it also drives the backdrop.
Change:

```ts
  update(_t: number, dtMs: number): void {
    if (!this.pet) return;
    this.elapsed += dtMs;
    const p = petWander(this.elapsed, this.scale.width, this.scale.height);
    this.pet.setPosition(p.x, p.y);
    this.pet.setFlipX(p.faceLeft);
  }
```

to:

```ts
  update(t: number, dtMs: number): void {
    this.elapsed += dtMs;
    this.backdropFx?.update(t);
    if (!this.pet) return;
    const p = petWander(this.elapsed, this.scale.width, this.scale.height);
    this.pet.setPosition(p.x, p.y);
    this.pet.setFlipX(p.faceLeft);
  }
```

(`this.elapsed` now advances independently of the pet; the pet still reads it.)

- [ ] **Step 6: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass (the new pure suite included).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(menu-bg): wire living-atmosphere backdrop into MainMenuScene"
```

---

### Task 4: Regenerate the throne-less hall art (best-effort) + verify whole

**Files:**
- Create: `scripts/sdart/genBackgrounds.mjs`
- Replace (asset): `public/assets/bg/menu-hall.png`

The SDXL flow is the sole art generator ([[project_art_pipeline_sdxl]]). The
script hits the live API directly (full-scene image — no transparent cutout,
unlike sprites).

- [ ] **Step 1: Write the one-off generator**

```js
// One-off scene-background generator for the main menu (and re-runnable for any
// full-scene bg). Hits the local Z-Image API directly and writes a 960x540 PNG
// straight into public/assets/bg/ — NO transparent cutout (scene art fills the
// frame). Usage: vite-node scripts/sdart/genBackgrounds.mjs [--n 4]
import { writeFileSync } from "node:fs";

const SD = "http://127.0.0.1:8765/generate";
const W = 960, H = 540;
const OUT = "public/assets/bg";

const PROMPT =
  "epic grand cathedral throne hall interior, deep symmetrical one-point " +
  "perspective, a raised empty stone dais at the centre with NO throne chair, " +
  "towering stained-glass windows casting dramatic volumetric god-ray light " +
  "shafts, rows of lit golden braziers along both walls, tall stone pillars, " +
  "long red royal banners, marble floor with subtle reflections, warm amber " +
  "key light and deep cool shadows, cinematic, atmospheric, moody, fantasy " +
  "anime game background art, highly detailed, painterly";
const NEG =
  "throne chair, seat, king on throne, character, person, people, hero, " +
  "knight, anime girl, anime boy, face, crowd, user interface, UI, hud, text, " +
  "words, watermark, logo, signature, frame, border, blurry, lowres, jpeg " +
  "artifacts, deformed, tiling seams";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const N = Number(arg("n", 4));

async function gen(seed) {
  const res = await fetch(SD, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: PROMPT, negative_prompt: NEG, steps: 30, width: W, height: H, seed }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not a PNG");
  return buf;
}

const seeds = Array.from({ length: N }, (_, i) => 71000 + i * 137);
for (const s of seeds) {
  try {
    const png = await gen(s);
    writeFileSync(`${OUT}/menu-hall-cand-${s}.png`, png);
    console.log(`wrote ${OUT}/menu-hall-cand-${s}.png`);
  } catch (e) { console.log(`seed ${s} failed: ${e.message}`); }
}
console.log("Review candidates, then copy the best over menu-hall.png");
```

- [ ] **Step 2: Generate candidates**

Run: `npx vite-node scripts/sdart/genBackgrounds.mjs --n 4`
Expected: up to 4 `public/assets/bg/menu-hall-cand-*.png` files written.
If the API is unreachable, every seed prints "failed" — skip to Step 5 (Pillar B
ships alone; the hall keeps its current image).

- [ ] **Step 3: Pick the best candidate**

Read each `menu-hall-cand-*.png` (visually) and choose the grandest, cleanest,
genuinely throne-LESS hall. Then promote it and delete the rest:

```bash
cp public/assets/bg/menu-hall-cand-<seed>.png public/assets/bg/menu-hall.png
rm public/assets/bg/menu-hall-cand-*.png
```

(If none is clearly better than the current image — e.g. all still bake a throne
— keep the existing `menu-hall.png` and just `rm` the candidates. Document the
choice in the commit message.)

- [ ] **Step 4: Confirm dimensions**

Run: `python3 -c "from PIL import Image; print(Image.open('public/assets/bg/menu-hall.png').size)"`
Expected: `(960, 540)`.

- [ ] **Step 5: Verify the whole feature**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc exit 0; full suite passes; build succeeds.

- [ ] **Step 6: Headless playtest the menu**

Run: `scripts/playtest/snap.sh "(async()=>{ const g=window.__game; g.scene.getScenes(true).forEach(s=>s.scene.key!=='MainMenuScene'&&g.scene.stop(s.scene.key)); g.scene.start('MainMenuScene'); await new Promise(r=>setTimeout(r,1200)); })()" /tmp/menu_backdrop.png`

(If the snap helper takes a single eval+output path differently, fall back to the
project's standard `scripts/playtest/snap.sh` invocation used elsewhere.)
Expected: screenshot written, no `EXC:` line. Open `/tmp/menu_backdrop.png` and
confirm: one throne, visible god-ray shafts, drifting motes/embers, warm
key-light, radial vignette. No double throne.

- [ ] **Step 7: Commit**

```bash
git add scripts/sdart/genBackgrounds.mjs public/assets/bg/menu-hall.png
git commit -m "feat(menu-bg): regenerate throne-less grand-hall backdrop art"
```

(If the art was NOT changed, commit only the script:
`git add scripts/sdart/genBackgrounds.mjs && git commit -m "chore(menu-bg): reproducible scene-background generator"`.)

---

### Task 5: Memory + final report

**Files:**
- Create: `memory/project_menu_backdrop.md`
- Modify: `memory/MEMORY.md`

- [ ] **Step 1: Write the memory file** documenting: `menuAtmosphere.ts` (pure,
  seeded) + `menuBackdropFx.ts` (presenter) compose the living throne-hall;
  `MainMenuScene.drawBackdrop` darkens the painted hall and builds the FX;
  the single throne is the procedural one (the baked throne was removed from the
  art to fix the double-throne clash); seed `ATMOSPHERE_SEED=4242`. Link
  `[[project_home_throne_room]]`, `[[project_endless_maze_arena]]`,
  `[[project_art_pipeline_sdxl]]`, `[[project_scene_reentry_reset]]`.

- [ ] **Step 2: Add the one-line pointer to `MEMORY.md`.**

- [ ] **Step 3: Confirm a clean tree** (only intended files committed; the
  pre-existing dirty tower-art files remain untouched), and deliver the final
  report with the playtest screenshot via `[[send: /tmp/menu_backdrop.png]]`.

---

## Self-Review

**Spec coverage:**
- Double-throne fix → Task 4 (throne-less art) + Task 3 Step 4 (darken). ✓
- Living atmosphere (rays/motes/embers/key-light/vignette/flicker) → Tasks 1–2, wired in Task 3. ✓
- Pure, deterministic, unit-testable maths → Task 1 + its tests. ✓
- No gameplay change / presentation only → Tasks touch only scene/FX/art. ✓
- No file > 500 lines → menuAtmosphere ≈170, menuBackdropFx ≈90, MainMenuScene grows by ~10. ✓
- Engine layer independent of art → Task 3 ships without Task 4; Task 4 is best-effort. ✓
- Scene-reuse reset → Task 3 Step 3 nulls `backdropFx` per entry. ✓
- Verification (tsc/tests/build/playtest) → Task 4 Steps 5–6. ✓

**Placeholder scan:** none — every code step shows full code; commands have expected output.

**Type consistency:** `MenuAtmosphereSpec`/`Mote`/`Ember`/`Ray`/`Torch`/`Vignette`/`KeyLight` defined in Task 1 and consumed unchanged in Task 2; helpers `motePos`/`emberPos`/`rayAlpha`/`flicker` signatures identical across Tasks 1–2. `buildMenuAtmosphere(W,H,seed)` and `new MenuBackdropFx(scene, spec)` match their Task-3 call sites. ✓
```
