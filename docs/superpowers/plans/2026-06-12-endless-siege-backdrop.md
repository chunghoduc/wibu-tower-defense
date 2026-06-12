# Endless Siege Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give endless mode a dedicated, impressive backdrop — an SDXL-painted siege panorama plus an animated procedural "siege atmosphere" layer (focus vignette, glowing ley-line battle-scars to every gate, pulsing castle heart-ring, drifting embers) centered on the maze arena's castle.

**Architecture:** A pure, seeded geometry module (`endlessBackdrop.ts`) produces a plain-data spec (no Phaser types) so it is unit-testable; a thin Phaser presenter (`EndlessBackdropFx`) draws the static pieces once and animates embers/pulses each frame. `BattleScene` swaps in the painted base texture and builds the FX only when `stage.arena` is present, so campaign rendering is byte-for-byte unchanged.

**Tech Stack:** TypeScript, Phaser 3, Vitest, deterministic mulberry32 `Rng`, z-image-turbo SDXL HTTP API (`127.0.0.1:8765/generate`).

---

### Task 1: Pure siege-backdrop geometry module

**Files:**

- Create: `src/core/endlessBackdrop.ts`
- Test: `tests/endlessBackdrop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/endlessBackdrop.test.ts
import { describe, it, expect } from "vitest";
import { buildEndlessBackdrop, emberPos, type Dims } from "../src/core/endlessBackdrop.ts";
import type { ArenaDef } from "../src/data/schema.ts";

const DIMS: Dims = { width: 1280, height: 720 };

// A tiny hand-made arena: center + 3 gates on different edges.
const ARENA: ArenaDef = {
  center: { x: 640, y: 360 },
  gates: [
    { x: 640, y: -20 }, // top
    { x: -20, y: 360 }, // left
    { x: 1300, y: 360 }, // right
  ],
  airSpawns: [],
  routes: [],
};

describe("buildEndlessBackdrop", () => {
  it("is deterministic for the same (arena, dims, seed)", () => {
    expect(buildEndlessBackdrop(ARENA, DIMS, 3)).toEqual(buildEndlessBackdrop(ARENA, DIMS, 3));
  });

  it("centers the vignette and castle ring on the arena center", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    expect(s.vignette.cx).toBe(640);
    expect(s.vignette.cy).toBe(360);
    expect(s.castleRing.cx).toBe(640);
    expect(s.castleRing.cy).toBe(360);
    expect(s.vignette.outerR).toBeGreaterThan(s.vignette.innerR);
  });

  it("emits one battle-scar per gate, each starting at the castle and heading toward its gate", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    expect(s.scars).toHaveLength(ARENA.gates.length);
    s.scars.forEach((scar, i) => {
      const first = scar.points[0];
      const last = scar.points[scar.points.length - 1];
      // starts at the castle
      expect(Math.hypot(first.x - 640, first.y - 360)).toBeLessThan(2);
      // far end is on the castle→gate side: dot(last-center, gate-center) > 0
      const gx = ARENA.gates[i].x,
        gy = ARENA.gates[i].y;
      const dot = (last.x - 640) * (gx - 640) + (last.y - 360) * (gy - 360);
      expect(dot).toBeGreaterThan(0);
      // far end stays on-screen (gates can sit off-map)
      expect(last.x).toBeGreaterThanOrEqual(0);
      expect(last.x).toBeLessThanOrEqual(DIMS.width);
      expect(last.y).toBeGreaterThanOrEqual(0);
      expect(last.y).toBeLessThanOrEqual(DIMS.height);
    });
  });

  it("scatters embers inside the field with sane alphas", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    expect(s.embers.length).toBeGreaterThan(0);
    for (const e of s.embers) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(DIMS.width);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(DIMS.height);
      expect(e.alpha).toBeGreaterThan(0);
      expect(e.alpha).toBeLessThanOrEqual(1);
    }
  });

  it("emberPos rises, wraps within height, and sways within drift", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    const e = s.embers[0];
    for (const t of [0, 1.3, 5, 40]) {
      const p = emberPos(e, t, DIMS);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(DIMS.height);
      expect(Math.abs(p.x - e.x)).toBeLessThanOrEqual(e.drift + 1e-6);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/endlessBackdrop.test.ts`
Expected: FAIL — `Cannot find module '../src/core/endlessBackdrop.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/endlessBackdrop.ts
/**
 * Pure, seeded geometry for the endless-mode "siege atmosphere" backdrop layer
 * (the painted SDXL base is a separate texture). Produces plain data — no Phaser
 * types — so the layout is deterministic and unit-testable; EndlessBackdropFx is
 * the presenter that draws and animates it. See
 * docs/superpowers/specs/2026-06-12-endless-siege-backdrop-design.md.
 */
import type { ArenaDef, Vec2 } from "../data/schema.ts";
import { Rng } from "./rng.ts";

export interface Dims {
  width: number;
  height: number;
}

/** Radial focus pull: dark at the rim (edgeAlpha), clear toward the castle. */
export interface Vignette {
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  edgeAlpha: number;
}
/** A glowing ley-line battle-scar: jittered polyline castle→gate, color `glow`. */
export interface Scar {
  points: Vec2[];
  width: number;
  glow: number;
}
export interface CastleRing {
  cx: number;
  cy: number;
  baseR: number;
  color: number;
}
export interface Ember {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  alpha: number;
  phase: number;
}

export interface EndlessBackdropSpec {
  vignette: Vignette;
  scars: Scar[];
  castleRing: CastleRing;
  embers: Ember[];
  dims: Dims;
}

const EMBER_COUNT = 60;
const SCAR_SEGS = 5;

export function buildEndlessBackdrop(
  arena: ArenaDef,
  dims: Dims,
  seed: number,
): EndlessBackdropSpec {
  const rng = new Rng(seed * 2246822519 + 7);
  const cx = arena.center.x,
    cy = arena.center.y;
  const outerR = Math.hypot(dims.width, dims.height) / 2;

  const vignette: Vignette = {
    cx,
    cy,
    innerR: Math.round(outerR * 0.34),
    outerR: Math.round(outerR),
    edgeAlpha: 0.7,
  };

  // One battle-scar per gate: a perpendicular-jittered polyline from the castle
  // out to the (on-screen-clamped) gate mouth, so the war-roads visibly converge.
  const scars: Scar[] = arena.gates.map((g) => {
    const gx = Math.max(8, Math.min(dims.width - 8, g.x));
    const gy = Math.max(8, Math.min(dims.height - 8, g.y));
    const dx = gx - cx,
      dy = gy - cy;
    const len = Math.hypot(dx, dy) || 1;
    const points: Vec2[] = [];
    for (let i = 0; i <= SCAR_SEGS; i++) {
      const t = i / SCAR_SEGS;
      const jitter = i === 0 || i === SCAR_SEGS ? 0 : (rng.next() - 0.5) * 26;
      points.push({
        x: Math.round(cx + dx * t + (-dy / len) * jitter),
        y: Math.round(cy + dy * t + (dx / len) * jitter),
      });
    }
    return { points, width: 6, glow: 0xff5a2a };
  });

  const castleRing: CastleRing = { cx, cy, baseR: 54, color: 0xffb060 };

  const embers: Ember[] = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    embers.push({
      x: rng.next() * dims.width,
      y: rng.next() * dims.height,
      r: 1 + rng.next() * 2.5,
      speed: 8 + rng.next() * 22,
      drift: 6 + rng.next() * 14,
      alpha: 0.25 + rng.next() * 0.5,
      phase: rng.next() * Math.PI * 2,
    });
  }

  return { vignette, scars, castleRing, embers, dims };
}

/** Position of an ember at time `tSec`: steady rise (wraps) + sine sway. Pure. */
export function emberPos(e: Ember, tSec: number, dims: Dims): { x: number; y: number } {
  let y = (e.y - e.speed * tSec) % dims.height;
  if (y < 0) y += dims.height;
  const x = e.x + Math.sin(tSec * 0.8 + e.phase) * e.drift;
  return { x, y };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/endlessBackdrop.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/endlessBackdrop.ts tests/endlessBackdrop.test.ts
git commit -m "feat(endless): pure seeded siege-backdrop geometry (vignette/scars/embers)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Phaser presenter — EndlessBackdropFx

**Files:**

- Create: `src/scenes/fx/EndlessBackdropFx.ts`

No unit test: this is a thin Phaser-drawing presenter (no logic beyond delegating
to the tested pure module). It is exercised by the CDP playtest in Task 5.

- [ ] **Step 1: Write the presenter**

```ts
// src/scenes/fx/EndlessBackdropFx.ts
/**
 * Presenter for the endless siege-atmosphere layer. Draws the static pieces once
 * (edge-darkening vignette + glowing ley-line battle-scars) and animates the live
 * pieces each frame (castle heart-ring pulse, breathing red gate auras, drifting
 * embers). Sits above the painted base texture (depth -10) and below the roads
 * and units. Pure geometry comes from core/endlessBackdrop.ts. Built only for
 * endless arenas, so campaign battles never construct it.
 */
import Phaser from "phaser";
import type { EndlessBackdropSpec, Scar } from "../../core/endlessBackdrop.ts";
import { emberPos } from "../../core/endlessBackdrop.ts";

export class EndlessBackdropFx {
  private base: Phaser.GameObjects.Graphics;
  private anim: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private spec: EndlessBackdropSpec,
    layer: Phaser.GameObjects.Layer,
  ) {
    this.base = scene.add.graphics().setDepth(-6);
    this.anim = scene.add.graphics().setDepth(-5);
    layer.add([this.base, this.anim]);
    this.drawStaticLayer();
  }

  private static strokePoly(g: Phaser.GameObjects.Graphics, pts: Scar["points"]): void {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
  }

  /** Static layer: radial vignette (stacked translucent rings) + glowing scars. */
  private drawStaticLayer(): void {
    const g = this.base;
    g.clear();
    const v = this.spec.vignette;
    const RINGS = 18;
    const ringW = (v.outerR - v.innerR) / RINGS + 3;
    for (let i = 1; i <= RINGS; i++) {
      const t = i / RINGS;
      const r = v.innerR + (v.outerR - v.innerR) * t;
      g.lineStyle(ringW, 0x000000, (v.edgeAlpha * t * t) / 3);
      g.strokeCircle(v.cx, v.cy, r);
    }
    for (const s of this.spec.scars) {
      g.lineStyle(s.width * 2.4, s.glow, 0.1); // soft outer glow
      EndlessBackdropFx.strokePoly(g, s.points);
      g.lineStyle(s.width, s.glow, 0.22); // bright core
      EndlessBackdropFx.strokePoly(g, s.points);
    }
  }

  /** Animated layer: castle ring pulse, gate auras, rising embers. */
  update(timeMs: number): void {
    const t = timeMs / 1000;
    const g = this.anim;
    g.clear();

    const cr = this.spec.castleRing;
    const pulse = 1 + Math.sin(t * 2.2) * 0.12;
    g.lineStyle(3, cr.color, 0.32 + Math.sin(t * 2.2) * 0.12);
    g.strokeCircle(cr.cx, cr.cy, cr.baseR * pulse);
    g.lineStyle(2, cr.color, 0.16);
    g.strokeCircle(cr.cx, cr.cy, cr.baseR * pulse * 1.6);

    for (const s of this.spec.scars) {
      const p = s.points[s.points.length - 1]; // gate mouth (on-screen end)
      const aura = 0.12 + (Math.sin(t * 1.6 + p.x * 0.01) * 0.5 + 0.5) * 0.16;
      g.fillStyle(0xff3020, aura);
      g.fillCircle(p.x, p.y, 22);
    }

    for (const e of this.spec.embers) {
      const { x, y } = emberPos(e, t, this.spec.dims);
      g.fillStyle(0xffb060, e.alpha);
      g.fillCircle(x, y, e.r);
    }
  }

  destroy(): void {
    this.base.destroy();
    this.anim.destroy();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the class is not yet referenced; this just confirms it compiles).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/fx/EndlessBackdropFx.ts
git commit -m "feat(endless): EndlessBackdropFx presenter (vignette/scars/embers/pulses)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Generate the SDXL painted base + register the texture

**Files:**

- Create: `public/assets/bg/endless-siege.png` (generated)
- Modify: `src/data/bgManifest.ts`

- [ ] **Step 1: Confirm the SDXL service is ready**

Run:

```bash
curl -s -m 5 http://127.0.0.1:8765/health
```

Expected: `{"status":"ok","model":"z-image-turbo","ready":true}`. If `ready:false`,
wait and retry (do not tight-loop); if the service is down, skip generation — the
procedural layer (Task 1/2) renders a complete siege scene over the flat ground on
its own, so the feature still ships. In that case still do Step 3 (manifest entry)
so the texture loads once the art exists.

- [ ] **Step 2: Generate the backdrop**

Run (single line; 1152×640 is a clean 16:9 the loader stretches to 1280×720, then
resized to the 960×540 sibling convention):

```bash
curl -s -X POST http://127.0.0.1:8765/generate -H 'content-type: application/json' \
  -d '{"prompt":"epic dark fantasy battlefield seen from directly above, a scorched circular plain with a glowing molten arcane focal point at the very center, cracked blackened earth and ash, drifting embers and smoke, blood-red and ember-orange light radiating from the middle and fading to deep shadow at the edges, ominous siege atmosphere, ruined war camps and broken siege engines around the dark rim, cinematic top-down concept art, highly detailed, dramatic volumetric light, dark moody palette with a warm glowing core","steps":9,"width":1152,"height":640,"seed":74211}' \
  -o /tmp/endless-siege-raw.png
python3 -c "from PIL import Image; Image.open('/tmp/endless-siege-raw.png').convert('RGB').resize((960,540), Image.LANCZOS).save('public/assets/bg/endless-siege.png')"
ls -l public/assets/bg/endless-siege.png
```

Expected: a non-trivial PNG (tens–hundreds of KB) at 960×540.

- [ ] **Step 3: Register the texture key**

In `src/data/bgManifest.ts`, add `"endless-siege"` to the `BG_IMAGES` array (last
entry). `PreloadScene` already loops `BG_IMAGES` loading `bg__<id>`, so no scene
change is needed.

```ts
export const BG_IMAGES = [
  "menu-hall",
  "chapter-greenwood",
  "chapter-frost",
  "chapter-desert",
  "chapter-volcanic",
  "chapter-swamp",
  "chapter-corrupted",
  "endless-siege",
] as const;
```

- [ ] **Step 4: Commit**

```bash
git add public/assets/bg/endless-siege.png src/data/bgManifest.ts
git commit -m "feat(endless): SDXL siege backdrop art + manifest entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire the backdrop into BattleScene

**Files:**

- Modify: `src/scenes/BattleScene.ts` (import, field, reset, drawStatic, update)

- [ ] **Step 1: Add the import**

Near the other data imports (the `bgManifest` is not yet imported here), add:

```ts
import { bgKey } from "../data/bgManifest.ts";
import { buildEndlessBackdrop } from "../core/endlessBackdrop.ts";
import { EndlessBackdropFx } from "./fx/EndlessBackdropFx.ts";
```

- [ ] **Step 2: Add the field**

Next to `terrainSprites` (around line 71), add:

```ts
  endlessBackdropFx: EndlessBackdropFx | null = null;
```

- [ ] **Step 3: Reset the field on (re-)entry**

In `create()` where other per-battle fields are reset (around line 133, next to
`this.terrainSprites = [];`), add:

```ts
this.endlessBackdropFx?.destroy();
this.endlessBackdropFx = null;
```

- [ ] **Step 4: Prefer the siege base texture + build the FX in `drawStatic`**

In `drawStatic()`, replace the base-key selection + veil block. Find:

```ts
const stageBg = stageBgKey(this.stage.id);
const bgKeyToUse = this.textures.exists(stageBg)
  ? stageBg
  : this.textures.exists(theme.bgKey)
    ? theme.bgKey
    : null;
if (bgKeyToUse) {
  const bg = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, bgKeyToUse).setDepth(-10);
  bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
  this.world.add(bg);
  this.terrainSprites.push(bg as unknown as Phaser.GameObjects.Image);
  // Lighter veil for the painted per-stage art (it's already balanced).
  const veil = bgKeyToUse === stageBg ? 0.22 : 0.4;
  g.fillStyle(theme.groundOverlay, veil).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
} else {
  g.fillStyle(0x202a22, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}
```

Replace with (endless prefers the siege backdrop; lighter veil over it because the
procedural vignette already darkens the rim):

```ts
const stageBg = stageBgKey(this.stage.id);
const endlessBg = bgKey("endless-siege");
const bgKeyToUse =
  this.stage.arena && this.textures.exists(endlessBg)
    ? endlessBg
    : this.textures.exists(stageBg)
      ? stageBg
      : this.textures.exists(theme.bgKey)
        ? theme.bgKey
        : null;
if (bgKeyToUse) {
  const bg = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, bgKeyToUse).setDepth(-10);
  bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
  this.world.add(bg);
  this.terrainSprites.push(bg as unknown as Phaser.GameObjects.Image);
  // Lighter veil for painted art; lighter still for endless (vignette darkens it).
  const veil = bgKeyToUse === endlessBg ? 0.12 : bgKeyToUse === stageBg ? 0.22 : 0.4;
  g.fillStyle(theme.groundOverlay, veil).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
} else {
  g.fillStyle(0x202a22, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}
// Endless: build the animated siege-atmosphere layer over the base, centered on
// the arena castle (same stage-number seed as the maze). Rebuilt each drawStatic.
this.endlessBackdropFx?.destroy();
this.endlessBackdropFx = null;
if (this.stage.arena) {
  const seed = stageNumber(this.stage.id) || 1;
  const spec = buildEndlessBackdrop(
    this.stage.arena,
    { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    seed,
  );
  this.endlessBackdropFx = new EndlessBackdropFx(this, spec, this.world);
}
```

- [ ] **Step 5: Animate it in `update`**

In `update(_time, deltaMs)` (around line 398), rename `_time` to `time` and call
the FX after `this.draw()`:

```ts
  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.handleKeyboardHero();
    for (let i = 0; i < this.gameSpeed; i++) this.battle.tick(dt); // 0 = paused, 2/3 = fast-forward
    this.draw();
    this.endlessBackdropFx?.update(time);
  }
```

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (campaign battles never touch `arena`, so no
regressions).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(endless): wire siege backdrop into BattleScene (base swap + animated FX)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify, playtest, document

**Files:**

- Modify: `memory/project_endless_maze_arena.md` (note the backdrop), `MEMORY.md` if needed

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 2: File-size guard**

Run: `wc -l src/core/endlessBackdrop.ts src/scenes/fx/EndlessBackdropFx.ts src/scenes/BattleScene.ts`
Expected: every file < 500 lines.

- [ ] **Step 3: CDP playtest**

Launch the dev server + headless Chrome on port 9223 (fresh user-data-dir), drive
`window.__game` into an endless battle, and assert: the backdrop renders, the FX
exists, embers move between two samples, 0 console errors. Capture a screenshot to
`/tmp/endless-siege.png`. (Reuse the CDP harness pattern from the maze-arena work.)

- [ ] **Step 4: Update memory**

Append a short paragraph to `memory/project_endless_maze_arena.md` noting that
endless mode now also renders a dedicated siege backdrop (SDXL `bg__endless-siege`
base + procedural `EndlessBackdropFx`: vignette, ley-line scars to each gate,
castle heart-ring, drifting embers), seeded by stage number, campaign untouched.

- [ ] **Step 5: Final commit (if memory changed) + report**

```bash
git add memory/
git commit -m "docs(memory): note endless siege backdrop layer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Report completion with the screenshot.

---

## Self-Review

- **Spec coverage:** SDXL base (Task 3) ✓; vignette/scars/castle-ring/embers (Task 1) ✓; animated presenter (Task 2) ✓; endless-only wiring + base swap + update (Task 4) ✓; determinism + invariants tests (Task 1) ✓; verify/playtest/file-size/memory (Task 5) ✓. Campaign-untouched is guaranteed by the `stage.arena` guard in Task 4.
- **Placeholder scan:** none — all code shown in full.
- **Type consistency:** `EndlessBackdropSpec`/`Dims`/`Scar`/`Ember` defined in Task 1 are the exact names imported in Task 2 and Task 4; `buildEndlessBackdrop(arena, dims, seed)` and `emberPos(e, tSec, dims)` signatures match across tasks; `EndlessBackdropFx(scene, spec, layer)` constructor + `update(timeMs)` + `destroy()` match the BattleScene calls.
