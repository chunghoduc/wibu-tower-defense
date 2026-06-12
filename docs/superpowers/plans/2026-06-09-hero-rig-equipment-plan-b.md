# Hero Rig + Equipment Sockets (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make worn equipment track the hero's limbs frame-by-frame in battle by driving the hero body from the articulated procedural rig (which knows exact joint positions per frame), exporting those joints as a per-frame "socket" manifest, and placing purpose-drawn item _appearance_ art on those sockets — instead of pasting static inventory icons at fixed body anchors.

**Architecture:** The offline rig (`scripts/svgart/pixrig.mjs` + `poses.mjs`) already computes `handR/handL/footL/footR/head/neck/hip` for every pose frame and already renders the hero (`svgart/gen.mjs:85`). We (1) render the hero **weaponless / gear-less** in three weapon archetypes (melee / ranged / magic), (2) export a `*.sockets.json` alongside each hero sheet carrying each frame's joint transforms, (3) draw item _appearance_ art from a small DRY template registry (one silhouette per slot/shape, tinted per item) with a defined pivot, and (4) refactor the runtime `HeroLayeredSprite` to read the current body frame's sockets and pin each equipped layer there. The painterly SDXL body is a documented optional upgrade (Phase 5) that reuses the exact same socket runtime.

**Tech Stack:** TypeScript, Phaser 3.80, Vite, Vitest. Offline art = Node ESM scripts (`scripts/svgart`, `scripts/pixelart`) emitting PNG strips + JSON via `src/art/pngEncoder.ts`. No new runtime dependencies.

---

## Design Summary (read before starting)

**Why B over A.** Approach A keeps the painterly SDXL body but requires hand-annotating attachment points on every independently-painted frame, and re-annotating whenever art is regenerated. Approach B makes attachment points a _computed by-product_ of the rig that draws the body, so tracking is exact, free for unlimited poses, and never goes stale. Cost: the moving body is the pixel-rig look (B1). Phase 5 documents how to later swap in painterly SDXL limb art on the same sockets (B2) without touching the runtime.

**Archetypes.** Equipped weapon family selects the hero body sheet and motion:

- **melee** — `Sword`, `Fist`, `Any` → braced stance, overhead wind-up + downward strike.
- **ranged** — `Bow`, `Gun` → bladed stance, lead arm extends, draw → loose / recoil.
- **magic** — `Staff`, `Tome` → upright channel, both hands rise, charge pulse.

**Sockets per frame** (in scaled sprite-pixel space, origin = sheet top-left of the frame cell):
`handR` (main weapon: x,y,angle) · `handL` (offhand/tome: x,y,angle) · `head` (helmet: x,y,scale) · `torso` (body armor: x,y,angle) · `footL` / `footR` (boots: x,y,angle) · `back` (wings: x,y) · `shadow` (ground shadow anchor: x,y).

**Enhancements & Physics Corrections (added during brainstorming):**

1. **Phaser flipX Origin-Shift Correction:** In Phaser 3, setting `flipX = true` mirrors the texture, but the origin coordinates remain relative to the top-left bounds. Thus, if `facingLeft` is true, the layout engine must invert `originX` to `1 - (art.pivot.x / art.w)` so rotation and placement occur precisely around the flipped pivot (e.g. hilt/ankle).
2. **Angle Alignments:** Since item appearance templates are drawn pointing **Up** (along $-y$) and Phaser's default rotation $0^\circ$ is **Right** ($+x$), the runtime layout must apply appropriate angular offsets to align the rig's joint angles with Phaser's rendering rotation.
3. **Dynamic Weapon Trails/Swish VFX:** The runtime tracks the frame-by-frame velocity of the `handR` socket during attack animations (e.g. transitioning `act1` $\rightarrow$ `act2` $\rightarrow$ `act3`). When a swing occurs, a temporary trail/swish effect is drawn between consecutive socket coordinates.
4. **Rarity Glint/Sparkle Particles:** Legendary and Unique items emit subtle, slow-falling sparkle/aura particles at their corresponding socket locations to represent high-prestige gear.
5. **Ground Projection Shadows:** A dynamic ellipse shadow pins to the new `shadow` socket at the hero's base, scaling/contracting slightly based on the hero's vertical movement to give depth in battle.

**Item appearance art is templated, not per-item.** 378 items do not get 378 bespoke drawings. A `WORN_TEMPLATES` registry maps `(slot, shape)` → a small draw function + pivot. Each item resolves a `shape` (from `weaponType` for weapons, or a coarse slot default) and a tint trio derived from its rarity/existing color, producing `worn__<shape>` textures shared across items. Bespoke overrides remain possible via `appearanceRef`.

**Frame naming contract** (shared by all three archetypes so the runtime is archetype-agnostic):
`idle1, idle2, walk1, walk2, walk3, walk4, act1, act2, act3, hurt` (10 frames). Anim ranges: idle = idle1–2 (loop), walk = walk1–4 (loop), attack/skill = act1–3 (once), hurt = hurt (once).

**Files at a glance:**

- `scripts/svgart/poses.mjs` — add `HERO_MELEE / HERO_RANGED / HERO_MAGIC` pose sets + `heroPoseSets()`.
- `scripts/svgart/pixrig.mjs` — make `pixFrame` optionally skip baked weapon/gear and **return joint map**; add `frameSockets()`.
- `scripts/svgart/genHero.mjs` — NEW. Renders the 3 weaponless hero sheets + `*.sockets.json` (keeps `gen.mjs` untouched for towers).
- `scripts/pixelart/worn.mjs` — NEW. `WORN_TEMPLATES` + `composeWorn()` drawing appearance art with pivots; emits `worn/<shape>.png` + `worn/index.json` (pivots).
- `src/data/heroArchetype.ts` — NEW. `archetypeForWeapon(weaponType)`.
- `src/data/wornPivots.ts` — NEW (generated). Pivot table imported by runtime.
- `src/scenes/heroSockets.ts` — NEW. Loads socket manifests; `socketsForFrame(archetype, frameName, facingLeft)`.
- `src/scenes/heroEquipVisuals.ts` — resolve each slot to a `worn__<shape>` key + tint + slot, not raw icon.
- `src/scenes/HeroLayeredSprite.ts` — replace `GEAR_ANCHOR`/`REST_POSE` with per-frame socket placement; split helpers into `heroLayout.ts` to stay < 500 lines.
- `src/scenes/PreloadScene.ts` — load 3 hero sheets + their sockets + `worn` textures; build archetype anims.

---

## Phase 1 — Offline: weaponless rig body + socket export

### Task 1: Hero archetype pose sets

**Files:**

- Modify: `scripts/svgart/poses.mjs`
- Test: `tests/poses.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/poses.test.mjs
import { describe, it, expect } from "vitest";
import { heroPoseSets } from "../scripts/svgart/poses.mjs";

const NAMES = [
  "idle1",
  "idle2",
  "walk1",
  "walk2",
  "walk3",
  "walk4",
  "act1",
  "act2",
  "act3",
  "hurt",
];

describe("heroPoseSets", () => {
  const sets = heroPoseSets();
  it("exposes the three archetypes", () => {
    expect(Object.keys(sets).sort()).toEqual(["magic", "melee", "ranged"]);
  });
  for (const [arch, poses] of Object.entries(sets)) {
    it(`${arch} has the exact 10-frame contract in order`, () => {
      expect(poses.map((p) => p.name)).toEqual(NAMES);
    });
    it(`${arch} frames all carry both arm + leg joint angles`, () => {
      for (const p of poses) {
        expect(p.armL).toHaveLength(2);
        expect(p.armR).toHaveLength(2);
        expect(p.legL).toHaveLength(2);
        expect(p.legR).toHaveLength(2);
      }
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/poses.test.mjs`
Expected: FAIL — `heroPoseSets is not a function`.

- [ ] **Step 3: Implement the pose sets**

Append to `scripts/svgart/poses.mjs` (keep existing `MELEE`/`CAST`/`poseSetFor` exports — towers still use them):

```js
// --- Hero archetype pose sets (weaponless rig). 10-frame contract shared by all
// three so the runtime is archetype-agnostic. angle 0=down,90=right,-90=left,180=up.
const HERO_NAMES = [
  "idle1",
  "idle2",
  "walk1",
  "walk2",
  "walk3",
  "walk4",
  "act1",
  "act2",
  "act3",
  "hurt",
];
const _name = (rows) => rows.map((r, i) => ({ name: HERO_NAMES[i], ...r }));

export const HERO_MELEE = _name([
  { bob: 0, armL: [-18, -8], armR: [18, 8], legL: [-8, 0], legR: [8, 0] },
  { bob: -2, armL: [-14, -6], armR: [14, 6], legL: [-8, 0], legR: [8, 0] },
  { bob: -1, armL: [-30, -10], armR: [35, 12], legL: [-28, 4], legR: [22, -2] },
  { bob: 0, armL: [-6, -2], armR: [10, 4], legL: [-6, 0], legR: [8, 0] },
  { bob: -1, armL: [30, 10], armR: [-25, -8], legL: [24, -2], legR: [-26, 4] },
  { bob: 0, armL: [-6, -2], armR: [10, 4], legL: [8, 0], legR: [-6, 0] },
  { bob: -3, lean: -4, armL: [-30, -10], armR: [120, 150], legL: [-14, 2], legR: [20, -2] },
  { bob: -1, lean: 2, armL: [-18, -8], armR: [70, 40], legL: [-18, 2], legR: [18, -2] },
  { bob: 1, lean: 6, armL: [-10, -4], armR: [40, 15], legL: [-26, 4], legR: [14, 0] },
  {
    bob: 0,
    lean: -12,
    headX: -3,
    armL: [-50, -20],
    armR: [50, 20],
    legL: [-18, 4],
    legR: [26, -2],
  },
]);

export const HERO_RANGED = _name([
  { bob: 0, armL: [-22, -10], armR: [22, 10], legL: [-10, 0], legR: [10, 0] },
  { bob: -2, armL: [-18, -8], armR: [18, 8], legL: [-10, 0], legR: [10, 0] },
  { bob: -1, armL: [-26, -8], armR: [28, 10], legL: [-26, 4], legR: [20, -2] },
  { bob: 0, armL: [-8, -2], armR: [12, 4], legL: [-6, 0], legR: [8, 0] },
  { bob: -1, armL: [26, 8], armR: [-22, -6], legL: [22, -2], legR: [-24, 4] },
  { bob: 0, armL: [-8, -2], armR: [12, 4], legL: [8, 0], legR: [-6, 0] },
  { bob: -1, armL: [70, 20], armR: [-30, -15], legL: [-12, 2], legR: [18, -2] }, // draw: lead arm extends fwd, rear hand back
  { bob: -1, armL: [78, 16], armR: [-10, -8], legL: [-12, 2], legR: [18, -2] }, // loose
  { bob: 0, armL: [72, 18], armR: [-22, -12], legL: [-12, 2], legR: [18, -2] }, // settle
  {
    bob: 0,
    lean: -12,
    headX: -3,
    armL: [-50, -20],
    armR: [50, 20],
    legL: [-18, 4],
    legR: [26, -2],
  },
]);

export const HERO_MAGIC = _name([
  { bob: 0, armL: [-20, -8], armR: [20, 8], legL: [-8, 0], legR: [8, 0] },
  { bob: -2, armL: [-16, -6], armR: [16, 6], legL: [-8, 0], legR: [8, 0] },
  { bob: -1, armL: [-26, -8], armR: [28, 10], legL: [-24, 4], legR: [20, -2] },
  { bob: 0, armL: [-8, -2], armR: [12, 4], legL: [-6, 0], legR: [8, 0] },
  { bob: -1, armL: [26, 8], armR: [-22, -6], legL: [22, -2], legR: [-24, 4] },
  { bob: 0, armL: [-8, -2], armR: [12, 4], legL: [8, 0], legR: [-6, 0] },
  { bob: -2, armL: [40, 60], armR: [-40, -60], legL: [-12, 2], legR: [18, -2] }, // channel: both hands rise
  { bob: -3, lean: -3, armL: [55, 80], armR: [-55, -80], legL: [-12, 2], legR: [18, -2] }, // charge
  { bob: -2, armL: [44, 64], armR: [-44, -64], legL: [-12, 2], legR: [18, -2] }, // release
  {
    bob: 0,
    lean: -12,
    headX: -3,
    armL: [-50, -20],
    armR: [50, 20],
    legL: [-18, 4],
    legR: [26, -2],
  },
]);

export function heroPoseSets() {
  return { melee: HERO_MELEE, ranged: HERO_RANGED, magic: HERO_MAGIC };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/poses.test.mjs`
Expected: PASS (8 assertions).

- [ ] **Step 5: Commit**

```bash
git add scripts/svgart/poses.mjs tests/poses.test.mjs
git commit -m "feat(art): hero archetype pose sets (melee/ranged/magic, 10-frame rig contract)"
```

---

### Task 2: Rig returns joint map + optional weaponless/gearless render

**Files:**

- Modify: `scripts/svgart/pixrig.mjs:88-135` (the `pixFrame` function + add `frameSockets`)
- Test: `tests/pixrig-sockets.test.mjs`

The current `pixFrame(spec, pose, cell)` returns only the canvas. We add an `opts` arg `{ weaponless, gearless }` and return `{ cv, joints }`. `joints` holds the rig points already computed inside the function. Existing callers (towers, in `svgart/gen.mjs`) use the return as a canvas today, so we keep backward compatibility by returning the canvas when `opts` is omitted.

- [ ] **Step 1: Write the failing test**

```js
// tests/pixrig-sockets.test.mjs
import { describe, it, expect } from "vitest";
import { pixFrame, frameSockets } from "../scripts/svgart/pixrig.mjs";
import { HERO_MELEE } from "../scripts/svgart/poses.mjs";

const SPEC = {
  skin: "#f0c49a",
  outfit: "#8a96a8",
  pants: "#3a4258",
  weapon: "broadsword",
  headgear: "helm",
};

describe("pixFrame socket export", () => {
  it("returns canvas + joints when opts passed", () => {
    const r = pixFrame(SPEC, HERO_MELEE[0], 48, { weaponless: true });
    expect(r.cv).toBeTruthy();
    expect(r.joints.handR).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(r.joints.head).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(r.joints.footL).toBeTruthy();
    expect(r.joints.footR).toBeTruthy();
    expect(r.joints.shadow).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  });
  it("stays backward-compatible (canvas only) when no opts", () => {
    const cv = pixFrame(SPEC, HERO_MELEE[0], 48);
    expect(cv.w).toBe(48);
    expect(cv.d).toBeTruthy();
  });
  it("handR x differs between an idle and a strike frame (joint tracks pose)", () => {
    const idle = frameSockets(SPEC, HERO_MELEE[0], 48);
    const hit = frameSockets(SPEC, HERO_MELEE[7], 48);
    expect(idle.handR.y).not.toBeCloseTo(hit.handR.y, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pixrig-sockets.test.mjs`
Expected: FAIL — `frameSockets is not a function` / `r.cv` undefined.

- [ ] **Step 3: Implement**

In `scripts/svgart/pixrig.mjs`, change the `pixFrame` signature and end, and add `frameSockets`. Replace the function header line `export function pixFrame(spec, pose, cell = 48) {` with:

```js
export function pixFrame(spec, pose, cell = 48, opts = null) {
```

Immediately before the `weapon(cv, handR, pose.armR[1], spec);` line, guard the baked weapon:

```js
// front arm + weapon (weapon baked only when not driven by an equipment socket)
capsule(cv, sR, elbR, aw, sleeve);
capsule(cv, elbR, handR, aw, skin);
disc(cv, handR.x, handR.y, aw * 0.8, skin);
if (!opts || !opts.weaponless) weapon(cv, handR, pose.armR[1], spec);
```

Wrap the baked head/back gear when `gearless` so the base body is a clean mannequin (helmet/cape/etc become equipment). Change the `headgear(cv, head, hr, spec);` call and the `// back items` block to:

```js
if (!opts || !opts.gearless) headgear(cv, head, hr, spec);
```

```js
// back items (skipped when gearless — wings/cape/etc become equipment sockets)
if (!opts || !opts.gearless) {
  if (spec.back === "cape")
    rect(
      cv,
      Math.round(neck.x - 4),
      Math.round(neck.y),
      8,
      Math.round(cell * 0.32),
      spec.capeColor || "#c0392b",
    );
  // ...keep the existing gourd/tails/wings/banner lines unchanged inside this block...
}
```

Replace the final `return cv;` with a joints-aware return:

```js
const joints = {
  handR: { x: handR.x, y: handR.y, angle: pose.armR[0] + pose.armR[1] },
  handL: { x: handL.x, y: handL.y, angle: pose.armL[0] + pose.armL[1] },
  head: { x: head.x, y: head.y, r: hr },
  torso: { x: (neck.x + hip.x) / 2, y: (neck.y + hip.y) / 2, angle: pose.lean || 0 },
  footL: { x: ftL.x, y: ftL.y + 1, angle: pose.legL[0] + pose.legL[1] },
  footR: { x: ftR.x, y: ftR.y + 1, angle: pose.legR[0] + pose.legR[1] },
  back: { x: neck.x, y: neck.y + 2 },
  shadow: { x: (ftL.x + ftR.x) / 2, y: cell - 2 },
};
return opts ? { cv, joints } : cv;
```

Add at the end of the file:

```js
/** Compute only the joint/socket map for a pose (no drawing) — used by the manifest exporter. */
export function frameSockets(spec, pose, cell = 48) {
  return pixFrame(spec, pose, cell, { weaponless: true, gearless: true }).joints;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pixrig-sockets.test.mjs`
Expected: PASS (3 assertions).

- [ ] **Step 5: Verify towers still render (backward-compat smoke)**

Run: `node scripts/svgart/gen.mjs --only=tower`
Expected: prints `tower <id> 7 frames` lines and `done`; no exceptions. (Towers call `pixFrame` without `opts`, so they still get a canvas.)

- [ ] **Step 6: Commit**

```bash
git add scripts/svgart/pixrig.mjs tests/pixrig-sockets.test.mjs
git commit -m "feat(art): pixFrame can render weaponless/gearless + return per-frame joint map"
```

---

### Task 3: Hero sheet + socket manifest generator

**Files:**

- Create: `scripts/svgart/genHero.mjs`
- Test: `tests/genHero.test.mjs`

Renders one weaponless/gearless hero strip per archetype to `public/assets/sprites/hero/hero__<arch>.png` + a Phaser frame JSON, and writes `hero__<arch>.sockets.json` carrying every frame's scaled-pixel sockets. Reuses `HERO` spec from `scripts/pixelart/specs.mjs` for body proportions/colors. Scale is `SCALE=4`, `CELL=48` to match the rest of the pipeline; sockets are emitted in **scaled** pixels (×SCALE) and **frame-local** coordinates (x already within a single cell, not the strip).

- [ ] **Step 1: Write the failing test**

```js
// tests/genHero.test.mjs
import { describe, it, expect, beforeAll } from "vitest";
import { buildHeroAssets } from "../scripts/svgart/genHero.mjs";

describe("buildHeroAssets", () => {
  let out;
  beforeAll(() => {
    out = buildHeroAssets({ write: false });
  });

  it("produces a sheet + sockets for each archetype", () => {
    expect(Object.keys(out).sort()).toEqual(["magic", "melee", "ranged"]);
  });
  it("sheet json frame count matches sockets frame count and names line up", () => {
    for (const a of ["melee", "ranged", "magic"]) {
      const { sheet, sockets } = out[a];
      expect(sheet.frames).toBe(sockets.frames.length);
      expect(sheet.names).toEqual(sockets.frames.map((f) => f.name));
    }
  });
  it("sockets are in scaled (×4) frame-local pixels, within the cell", () => {
    const f = out.melee.sockets.frames[0];
    const cellPx = out.melee.sockets.cell; // 48*4 = 192
    expect(cellPx).toBe(192);
    for (const s of Object.values(f.sockets)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(cellPx);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(cellPx);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/genHero.test.mjs`
Expected: FAIL — cannot find module `genHero.mjs`.

- [ ] **Step 3: Implement the generator**

```js
// scripts/svgart/genHero.mjs
// Weaponless/gearless hero body sheets (one per weapon archetype) + a per-frame
// socket manifest so the runtime can pin equipment art to the hero's joints.
import { mkdirSync, writeFileSync } from "node:fs";
import { pixFrame, frameSockets } from "./pixrig.mjs";
import { heroPoseSets } from "./poses.mjs";
import { HERO } from "../pixelart/specs.mjs";
import { encodePng } from "../../src/art/pngEncoder.ts";

const CELL = 48,
  SCALE = 4;
const GAME = "public/assets/sprites/hero";

function hexRGBA(cells, w, h, scale) {
  const W = w * scale,
    H = h * scale,
    rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = cells[y * w + x];
      if (!c) continue;
      const n = parseInt(c.slice(1), 16),
        r = (n >> 16) & 255,
        g = (n >> 8) & 255,
        b = n & 255;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const o = ((y * scale + dy) * W + (x * scale + dx)) * 4;
          rgba[o] = r;
          rgba[o + 1] = g;
          rgba[o + 2] = b;
          rgba[o + 3] = 255;
        }
    }
  return { rgba, W, H };
}

export function buildHeroAssets({ write = true } = {}) {
  const sets = heroPoseSets();
  const out = {};
  for (const [arch, poses] of Object.entries(sets)) {
    const N = poses.length;
    const stripCells = new Array(CELL * N * CELL).fill(null);
    const frames = [];
    poses.forEach((pose, fi) => {
      const { cv } = pixFrame(HERO, pose, CELL, { weaponless: true, gearless: true });
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const v = cv.d[y * CELL + x];
          if (v) stripCells[y * (CELL * N) + (fi * CELL + x)] = v;
        }
      const j = frameSockets(HERO, pose, CELL);
      const scaled = {};
      for (const [k, s] of Object.entries(j)) {
        scaled[k] = {
          x: +(s.x * SCALE).toFixed(2),
          y: +(s.y * SCALE).toFixed(2),
          ...(s.angle !== undefined ? { angle: +s.angle.toFixed(2) } : {}),
          ...(s.r !== undefined ? { r: +(s.r * SCALE).toFixed(2) } : {}),
        };
      }
      frames.push({ name: pose.name, sockets: scaled });
    });
    const { rgba, W, H } = hexRGBA(stripCells, CELL * N, CELL, SCALE);
    const sheet = {
      frameWidth: CELL * SCALE,
      frameHeight: CELL * SCALE,
      frames: N,
      names: poses.map((p) => p.name),
    };
    const sockets = { cell: CELL * SCALE, scale: SCALE, frames };
    out[arch] = { sheet, sockets, png: { rgba, W, H } };
    if (write) {
      mkdirSync(GAME, { recursive: true });
      writeFileSync(`${GAME}/hero__${arch}.png`, encodePng(rgba, W, H));
      writeFileSync(`${GAME}/hero__${arch}.json`, JSON.stringify(sheet));
      writeFileSync(`${GAME}/hero__${arch}.sockets.json`, JSON.stringify(sockets));
      console.log("hero", arch, N, "frames + sockets");
    }
  }
  return out;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) buildHeroAssets({ write: true });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/genHero.test.mjs`
Expected: PASS (3 assertions).

- [ ] **Step 5: Generate the real assets**

Run: `node scripts/svgart/genHero.mjs`
Expected: three lines `hero melee 10 frames + sockets` etc. Confirm files exist:
Run: `ls public/assets/sprites/hero/hero__*.png public/assets/sprites/hero/hero__*.sockets.json`
Expected: 6 files (png + sockets.json × 3 archetypes).

- [ ] **Step 6: Commit**

```bash
git add scripts/svgart/genHero.mjs tests/genHero.test.mjs public/assets/sprites/hero/hero__*.png public/assets/sprites/hero/hero__*.json public/assets/sprites/hero/hero__*.sockets.json
git commit -m "feat(art): generate weaponless hero archetype sheets + per-frame socket manifests"
```

---

## Phase 2 — Offline: item appearance art (templated, with pivots)

### Task 4: Worn appearance templates

**Files:**

- Create: `scripts/pixelart/worn.mjs`
- Test: `tests/worn.test.mjs`

A small registry of silhouette draw functions keyed by `shape`. Each returns `{ cv, pivot:{x,y} }` in **unscaled** cell pixels; the exporter scales by `SCALE` and records pivots. Weapon shapes are drawn pointing **up** (blade/barrel along −y) with the pivot at the grip, so a socket `angle` rotates them naturally around the hand. Boots/helmet/body are drawn upright with pivots at ankle/crown/chest.

Shapes (MVP set, extend later): weapons `sword, fist, bow, gun, staff, tome`; armor `helmet, body, gloves, boots`; cosmetic `wing` (wing uses existing `appearanceRef` art when present, else this template).

- [ ] **Step 1: Write the failing test**

```js
// tests/worn.test.mjs
import { describe, it, expect } from "vitest";
import { WORN_SHAPES, composeWorn } from "../scripts/pixelart/worn.mjs";

describe("composeWorn", () => {
  it("exposes the MVP shape set", () => {
    expect(WORN_SHAPES).toEqual(
      expect.arrayContaining([
        "sword",
        "fist",
        "bow",
        "gun",
        "staff",
        "tome",
        "helmet",
        "body",
        "gloves",
        "boots",
        "wing",
      ]),
    );
  });
  it("each shape draws non-empty pixels and a pivot inside the canvas", () => {
    for (const shape of WORN_SHAPES) {
      const { cv, pivot } = composeWorn(shape, { tint: "#c0c0c0", accent: "#caa84a" });
      const filled = cv.d.filter(Boolean).length;
      expect(filled, `${shape} should draw pixels`).toBeGreaterThan(0);
      expect(pivot.x).toBeGreaterThanOrEqual(0);
      expect(pivot.x).toBeLessThanOrEqual(cv.w);
      expect(pivot.y).toBeGreaterThanOrEqual(0);
      expect(pivot.y).toBeLessThanOrEqual(cv.h);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worn.test.mjs`
Expected: FAIL — cannot find module `worn.mjs`.

- [ ] **Step 3: Implement templates**

```js
// scripts/pixelart/worn.mjs
// Equipment APPEARANCE art — one tintable silhouette per shape, with a pivot the
// runtime pins onto a hero socket. Weapons point up (-y), pivot at the grip.
import { canvas, disc, rect, capsule, lineP, outline, shade } from "../svgart/pixrig.mjs";

export const WORN_SHAPES = [
  "sword",
  "fist",
  "bow",
  "gun",
  "staff",
  "tome",
  "helmet",
  "body",
  "gloves",
  "boots",
  "wing",
];

// Each drawer receives (cv, c) where c={base,accent,lo}; returns pivot {x,y}.
const DRAW = {
  sword(cv, c) {
    const gx = 12,
      gy = 22;
    rect(cv, gx - 1, gy - 1, 2, 4, "#5a3a22"); // grip
    capsule(cv, { x: gx - 4, y: gy }, { x: gx + 4, y: gy }, 1, c.accent); // guard
    capsule(cv, { x: gx, y: gy - 2 }, { x: gx, y: 3 }, 1.6, c.base); // blade up
    lineP(cv, { x: gx, y: gy - 2 }, { x: gx, y: 4 }, c.lo);
    return { x: gx, y: gy };
  },
  fist(cv, c) {
    disc(cv, 12, 12, 4, c.base);
    disc(cv, 12, 12, 2, c.accent);
    return { x: 12, y: 12 };
  },
  bow(cv, c) {
    const gx = 12,
      gy = 12;
    capsule(cv, { x: gx, y: 2 }, { x: gx, y: gy * 2 - 2 }, 1.2, c.base);
    lineP(cv, { x: gx, y: 3 }, { x: gx, y: gy * 2 - 3 }, c.accent);
    return { x: gx, y: gy };
  },
  gun(cv, c) {
    const gx = 10,
      gy = 16;
    rect(cv, gx - 1, gy - 1, 2, 4, "#5a3a22"); // grip
    capsule(cv, { x: gx, y: gy }, { x: gx, y: 6 }, 2, c.base);
    return { x: gx, y: gy };
  },
  staff(cv, c) {
    const gx = 12,
      gy = 22;
    capsule(cv, { x: gx, y: gy }, { x: gx, y: 5 }, 1.2, "#8a6a3a");
    disc(cv, gx, 4, 3, c.accent);
    return { x: gx, y: gy };
  },
  tome(cv, c) {
    rect(cv, 6, 8, 12, 9, c.base);
    rect(cv, 6, 8, 2, 9, c.accent);
    return { x: 12, y: 16 };
  },
  helmet(cv, c) {
    disc(cv, 12, 12, 6, c.base);
    rect(cv, 6, 12, 12, 5, c.base);
    rect(cv, 11, 3, 2, 4, c.accent);
    return { x: 12, y: 13 };
  },
  body(cv, c) {
    rect(cv, 5, 6, 14, 16, c.base);
    rect(cv, 5, 6, 14, 3, c.accent);
    rect(cv, 11, 9, 2, 12, shade(c.base, 0.8));
    return { x: 12, y: 13 };
  },
  gloves(cv, c) {
    disc(cv, 8, 12, 3, c.base);
    rect(cv, 6, 12, 5, 4, c.base);
    return { x: 8, y: 13 };
  },
  boots(cv, c) {
    rect(cv, 7, 6, 5, 10, c.base);
    rect(cv, 7, 14, 9, 4, shade(c.base, 0.8));
    rect(cv, 7, 6, 5, 3, c.accent);
    return { x: 9, y: 8 };
  },
  wing(cv, c) {
    for (let i = 0; i < 4; i++) disc(cv, 12 - i, 8 + i * 3, 3, shade(c.base, 1 - i * 0.1));
    return { x: 13, y: 9 };
  },
};

export function composeWorn(shape, { tint = "#c0c0c0", accent = "#caa84a" } = {}, cell = 24) {
  const cv = canvas(cell, cell);
  const c = { base: tint, accent, lo: shade(tint, 0.75) };
  const draw = DRAW[shape] || DRAW.body;
  const pivot = draw(cv, c);
  outline(cv);
  return { cv, pivot };
}
```

NOTE: this imports `canvas/disc/rect/capsule/lineP/outline/shade` from `pixrig.mjs`, which already `export`s all of them (see `pixrig.mjs:7-42`). No changes to `pixrig.mjs` exports are needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worn.test.mjs`
Expected: PASS (2 assertions).

- [ ] **Step 5: Commit**

```bash
git add scripts/pixelart/worn.mjs tests/worn.test.mjs
git commit -m "feat(art): tintable equipment appearance templates with pivots"
```

---

### Task 5: Worn texture + pivot exporter, and item→shape/tint resolution

**Files:**

- Create: `scripts/svgart/genWorn.mjs`
- Create: `src/data/wornShape.ts` (pure resolver, runtime-importable)
- Test: `tests/wornShape.test.ts`

`wornShape.ts` decides, for an item def, which `shape` and `tint/accent` it wears. Weapons → shape from `weaponType` (`Sword→sword, Fist→fist, Bow→bow, Gun→gun, Staff→staff, Tome→tome, Any→sword`). Armor slots → shape from slot (`Helmet→helmet, BodyArmor→body, Gloves→gloves, Boots→boots, Wing→wing`). Tint derived from rarity color (DRY: reuse a rarity→color map), accent fixed gold. `genWorn.mjs` enumerates the distinct `(shape, tintKey)` combos actually used by the catalog and writes `worn/<key>.png` + `worn/index.json` (pivots, scaled).

- [ ] **Step 1: Write the failing test**

```ts
// tests/wornShape.test.ts
import { describe, it, expect } from "vitest";
import { wornShapeFor } from "../src/data/wornShape.ts";

describe("wornShapeFor", () => {
  it("maps weapon types to weapon shapes", () => {
    expect(wornShapeFor({ slot: "Weapon", weaponType: "Bow" }).shape).toBe("bow");
    expect(wornShapeFor({ slot: "Weapon", weaponType: "Staff" }).shape).toBe("staff");
    expect(wornShapeFor({ slot: "Weapon", weaponType: "Any" }).shape).toBe("sword");
  });
  it("maps armor slots to armor shapes", () => {
    expect(wornShapeFor({ slot: "Helmet" }).shape).toBe("helmet");
    expect(wornShapeFor({ slot: "BodyArmor" }).shape).toBe("body");
    expect(wornShapeFor({ slot: "Boots" }).shape).toBe("boots");
  });
  it("produces a stable texture key combining shape + tint", () => {
    const a = wornShapeFor({ slot: "Boots", rarity: "Rare" });
    const b = wornShapeFor({ slot: "Boots", rarity: "Rare" });
    expect(a.key).toBe(b.key);
    expect(a.key).toMatch(/^worn__boots__/);
  });
  it("returns null shape for slots with no worn art (e.g. Amulet/Ring/Pet)", () => {
    expect(wornShapeFor({ slot: "Amulet" })).toBeNull();
    expect(wornShapeFor({ slot: "Ring" })).toBeNull();
    expect(wornShapeFor({ slot: "Pet" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wornShape.test.ts`
Expected: FAIL — cannot find module `wornShape.ts`.

- [ ] **Step 3: Implement the resolver**

```ts
// src/data/wornShape.ts
// Pure mapping from an item def to the worn-appearance shape + tint it renders as.
// Used both offline (exporter enumerates the needed textures) and at runtime
// (HeroLayeredSprite picks the texture key + tint per equipped slot).
import type { ItemDefSlot, WeaponType, Rarity } from "./schema.ts";

export interface WornResolution {
  shape: string;
  tint: string;
  accent: string;
  key: string;
}

const RARITY_TINT: Record<string, string> = {
  Common: "#9aa3ad",
  Magic: "#5a7ad0",
  Rare: "#caa84a",
  Legendary: "#e8902a",
  Unique: "#c0392b",
};
const ACCENT = "#caa84a";

const WEAPON_SHAPE: Record<WeaponType, string> = {
  Sword: "sword",
  Fist: "fist",
  Bow: "bow",
  Gun: "gun",
  Staff: "staff",
  Tome: "tome",
  Any: "sword",
};
const SLOT_SHAPE: Partial<Record<ItemDefSlot, string>> = {
  Helmet: "helmet",
  BodyArmor: "body",
  Gloves: "gloves",
  Boots: "boots",
  Wing: "wing",
};

export function wornShapeFor(def: {
  slot: ItemDefSlot;
  weaponType?: WeaponType;
  rarity?: Rarity;
}): WornResolution | null {
  let shape: string | undefined;
  if (def.slot === "Weapon") shape = WEAPON_SHAPE[def.weaponType ?? "Any"];
  else shape = SLOT_SHAPE[def.slot];
  if (!shape) return null; // Amulet/Ring/Pet have no worn body art
  const tint = RARITY_TINT[def.rarity ?? "Common"] ?? RARITY_TINT.Common;
  const tintKey = tint.replace("#", "");
  return { shape, tint, accent: ACCENT, key: `worn__${shape}__${tintKey}` };
}
```

VERIFY before writing: confirm `Rarity` is exported from `src/data/schema.ts` and that `ItemDef.slot` is typed `ItemDefSlot` with `rarity`/`weaponType` fields. If `Rarity` has a different name, import the correct symbol. (Schema confirmed to export `ItemDefSlot`, `WeaponType`; `appearanceRef`, `weaponType` exist on item defs.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wornShape.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Implement the exporter**

```js
// scripts/svgart/genWorn.mjs
// Enumerate the distinct worn (shape,tint) textures the catalog needs and write
// them to public/assets/sprites/worn/<key>.png plus worn/index.json (pivots).
import { mkdirSync, writeFileSync } from "node:fs";
import { composeWorn } from "../pixelart/worn.mjs";
import { wornShapeFor } from "../../src/data/wornShape.ts";
import { ITEM_CATALOG } from "../../src/data/items.ts";
import { encodePng } from "../../src/art/pngEncoder.ts";

const SCALE = 4,
  OUT = "public/assets/sprites/worn";

function hexRGBA(cells, w, h, scale) {
  const W = w * scale,
    H = h * scale,
    rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = cells[y * w + x];
      if (!c) continue;
      const n = parseInt(c.slice(1), 16),
        r = (n >> 16) & 255,
        g = (n >> 8) & 255,
        b = n & 255;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const o = ((y * scale + dy) * W + (x * scale + dx)) * 4;
          rgba[o] = r;
          rgba[o + 1] = g;
          rgba[o + 2] = b;
          rgba[o + 3] = 255;
        }
    }
  return { rgba, W, H };
}

const seen = new Map(); // key -> resolution
for (const def of ITEM_CATALOG) {
  const r = wornShapeFor(def);
  if (r && !seen.has(r.key)) seen.set(r.key, r);
}

mkdirSync(OUT, { recursive: true });
const index = {};
for (const [key, r] of seen) {
  const { cv, pivot } = composeWorn(r.shape, { tint: r.tint, accent: r.accent });
  const { rgba, W, H } = hexRGBA(cv.d, cv.w, cv.h, SCALE);
  writeFileSync(`${OUT}/${key}.png`, encodePng(rgba, W, H));
  index[key] = {
    w: W,
    h: H,
    pivot: { x: +(pivot.x * SCALE).toFixed(2), y: +(pivot.y * SCALE).toFixed(2) },
    shape: r.shape,
  };
}
writeFileSync(`${OUT}/index.json`, JSON.stringify(index));
console.log("worn textures:", seen.size);
```

VERIFY before writing: confirm `src/data/items.ts` exports an array of item defs named `ITEM_CATALOG` (the runtime uses `ITEM_CATALOG_MAP`; the array may be `ITEM_CATALOG` or similar — grep and use the actual export). If only the map exists, iterate `ITEM_CATALOG_MAP.values()`.

- [ ] **Step 6: Generate the textures**

Run: `node scripts/svgart/genWorn.mjs`
Expected: `worn textures: <N>` (N = distinct shape×rarity combos, ~40-55). Confirm:
Run: `ls public/assets/sprites/worn/ | head` and `cat public/assets/sprites/worn/index.json | head -c 300`
Expected: PNG files + a JSON map with `pivot` entries.

- [ ] **Step 7: Commit**

```bash
git add scripts/svgart/genWorn.mjs src/data/wornShape.ts tests/wornShape.test.ts public/assets/sprites/worn/
git commit -m "feat(art): export tinted worn appearance textures + pivots; item->shape resolver"
```

---

## Phase 3 — Runtime: socket loading + placement

### Task 6: Archetype mapping + socket runtime module

**Files:**

- Create: `src/data/heroArchetype.ts`
- Create: `src/scenes/heroSockets.ts`
- Test: `tests/heroSockets.test.ts`

`heroArchetype.ts` maps `WeaponType → "melee"|"ranged"|"magic"`. `heroSockets.ts` ingests the loaded socket manifests (registered under `hero__<arch>.sockets`) and answers `socketsForFrame(arch, frameName, facingLeft, frameWidthPx)`, returning each socket transformed to **body-local** space (centered on the sprite origin, x-flipped when facing left). Origin handling: the body sprite uses origin `(0.5, 0.78)` (see `HeroLayeredSprite.ts:119`), so a socket at frame-local `(sx, sy)` maps to local `(sx - 0.5*W, sy - 0.78*H)`, then scaled by the runtime body scale (the manifest is at the native sheet resolution).

- [ ] **Step 1: Write the failing test**

```ts
// tests/heroSockets.test.ts
import { describe, it, expect } from "vitest";
import { archetypeForWeapon } from "../src/data/heroArchetype.ts";
import { SocketSet } from "../src/scenes/heroSockets.ts";

const MANIFEST = {
  cell: 192,
  scale: 4,
  frames: [
    {
      name: "idle1",
      sockets: {
        handR: { x: 120, y: 110, angle: 20 },
        head: { x: 96, y: 50, r: 24 },
        footL: { x: 84, y: 170, angle: 0 },
        footR: { x: 108, y: 170, angle: 0 },
        torso: { x: 96, y: 110, angle: 0 },
        handL: { x: 72, y: 110, angle: -20 },
        back: { x: 96, y: 78 },
        shadow: { x: 96, y: 190 },
      },
    },
    {
      name: "act2",
      sockets: {
        handR: { x: 150, y: 60, angle: 95 },
        head: { x: 96, y: 50, r: 24 },
        footL: { x: 84, y: 170, angle: 0 },
        footR: { x: 108, y: 170, angle: 0 },
        torso: { x: 96, y: 110, angle: 0 },
        handL: { x: 72, y: 110, angle: -20 },
        back: { x: 96, y: 78 },
        shadow: { x: 96, y: 190 },
      },
    },
  ],
};

describe("archetypeForWeapon", () => {
  it("groups families", () => {
    expect(archetypeForWeapon("Sword")).toBe("melee");
    expect(archetypeForWeapon("Fist")).toBe("melee");
    expect(archetypeForWeapon("Any")).toBe("melee");
    expect(archetypeForWeapon("Bow")).toBe("ranged");
    expect(archetypeForWeapon("Gun")).toBe("ranged");
    expect(archetypeForWeapon("Staff")).toBe("magic");
    expect(archetypeForWeapon("Tome")).toBe("magic");
    expect(archetypeForWeapon(null)).toBe("melee"); // bare-handed default
  });
});

describe("SocketSet", () => {
  const set = new SocketSet(MANIFEST);
  it("returns body-local coords (origin 0.5,0.78) for a known frame", () => {
    const s = set.forFrame("idle1", false);
    // handR local x = 120 - 0.5*192 = 24 ; local y = 110 - 0.78*192 = -39.76
    expect(s.handR.x).toBeCloseTo(24, 1);
    expect(s.handR.y).toBeCloseTo(110 - 0.78 * 192, 1);
    expect(s.handR.angle).toBe(20);
  });
  it("mirrors x and negates angle when facing left", () => {
    const s = set.forFrame("idle1", true);
    expect(s.handR.x).toBeCloseTo(-(120 - 0.5 * 192), 1);
    expect(s.handR.angle).toBe(-20);
  });
  it("falls back to the nearest known frame when name missing", () => {
    const s = set.forFrame("nonexistent", false);
    expect(s).toBeTruthy();
    expect(s.handR).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroSockets.test.ts`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Implement**

```ts
// src/data/heroArchetype.ts
import type { WeaponType } from "./schema.ts";
export type HeroArchetype = "melee" | "ranged" | "magic";
export function archetypeForWeapon(wt: WeaponType | null | undefined): HeroArchetype {
  switch (wt) {
    case "Bow":
    case "Gun":
      return "ranged";
    case "Staff":
    case "Tome":
      return "magic";
    default:
      return "melee"; // Sword / Fist / Any / null
  }
}
```

```ts
// src/scenes/heroSockets.ts
// Runtime accessor for the per-frame hero socket manifests produced by
// scripts/svgart/genHero.mjs. Converts frame-local manifest coords into
// body-local coords (origin 0.5,0.78) and mirrors for facing.
export interface Socket {
  x: number;
  y: number;
  angle: number;
  r?: number;
}
export type FrameSockets = Record<string, Socket>;

interface RawSocket {
  x: number;
  y: number;
  angle?: number;
  r?: number;
}
interface RawFrame {
  name: string;
  sockets: Record<string, RawSocket>;
}
export interface SocketManifest {
  cell: number;
  scale: number;
  frames: RawFrame[];
}

const ORIGIN_X = 0.5; // must match HeroLayeredSprite body sprite origin
const ORIGIN_Y = 0.78;

export class SocketSet {
  private readonly byName = new Map<string, FrameSockets>();
  private readonly order: string[] = [];
  constructor(private readonly manifest: SocketManifest) {
    const W = manifest.cell,
      H = manifest.cell;
    for (const f of manifest.frames) {
      const fs: FrameSockets = {};
      for (const [k, s] of Object.entries(f.sockets)) {
        fs[k] = { x: s.x - ORIGIN_X * W, y: s.y - ORIGIN_Y * H, angle: s.angle ?? 0, r: s.r };
      }
      this.byName.set(f.name, fs);
      this.order.push(f.name);
    }
  }
  /** Body-local sockets for a frame, mirrored when facing left. Scale by body scale at the call site. */
  forFrame(name: string, facingLeft: boolean): FrameSockets {
    const base = this.byName.get(name) ?? this.byName.get(this.order[0]);
    const out: FrameSockets = {};
    const side = facingLeft ? -1 : 1;
    for (const [k, s] of Object.entries(base!)) {
      out[k] = { x: s.x * side, y: s.y, angle: s.angle * side, r: s.r };
    }
    return out;
  }
}

/** Registry: archetype -> SocketSet, populated in PreloadScene after JSON loads. */
export class HeroSocketRegistry {
  private readonly sets = new Map<string, SocketSet>();
  register(arch: string, manifest: SocketManifest): void {
    this.sets.set(arch, new SocketSet(manifest));
  }
  get(arch: string): SocketSet | undefined {
    return this.sets.get(arch);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heroSockets.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/data/heroArchetype.ts src/scenes/heroSockets.ts tests/heroSockets.test.ts
git commit -m "feat(battle): hero archetype mapping + per-frame socket runtime"
```

---

### Task 7: Load hero sheets, sockets, and worn textures in PreloadScene

**Files:**

- Modify: `src/scenes/PreloadScene.ts`
- Test: manual (asset load) — verified by Task 9 playtest; add a guard test for the anim-range builder.

The manifest generator (`svgart/gen.mjs`) only scans `tower/hero/enemy/...` dirs for `*.json` and would pick up `hero__melee.json` automatically IF re-run with `--only=manifest`. But the new hero sheets and `.sockets.json` / `worn` textures must be **loaded** and the archetype anims **created**. PreloadScene already imports `SPRITE_MANIFEST`; we add explicit loads for the three hero sheets + sockets + worn index, and build anims per archetype.

- [ ] **Step 1: Add a unit test for the anim-range helper**

```ts
// tests/heroAnimRanges.test.ts
import { describe, it, expect } from "vitest";
import { heroAnimRanges } from "../src/scenes/heroAnimRanges.ts";

describe("heroAnimRanges", () => {
  const names = [
    "idle1",
    "idle2",
    "walk1",
    "walk2",
    "walk3",
    "walk4",
    "act1",
    "act2",
    "act3",
    "hurt",
  ];
  it("maps the 10-frame contract to idle/walk/attack/skill/hurt frame index ranges", () => {
    const r = heroAnimRanges(names);
    expect(r.idle).toEqual([0, 1]);
    expect(r.walk).toEqual([2, 3, 4, 5]);
    expect(r.attack).toEqual([6, 7, 8]);
    expect(r.skill).toEqual([6, 7, 8]);
    expect(r.hurt).toEqual([9]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroAnimRanges.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the helper**

```ts
// src/scenes/heroAnimRanges.ts
// Map the hero 10-frame contract (by name) to frame-index ranges per anim.
export interface HeroAnimRanges {
  idle: number[];
  walk: number[];
  attack: number[];
  skill: number[];
  hurt: number[];
}
export function heroAnimRanges(names: string[]): HeroAnimRanges {
  const idx = (n: string) => names.indexOf(n);
  return {
    idle: ["idle1", "idle2"].map(idx),
    walk: ["walk1", "walk2", "walk3", "walk4"].map(idx),
    attack: ["act1", "act2", "act3"].map(idx),
    skill: ["act1", "act2", "act3"].map(idx),
    hurt: ["hurt"].map(idx),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heroAnimRanges.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire loading + anim creation in PreloadScene**

First read `src/scenes/PreloadScene.ts` fully to match its existing load/anim-creation patterns. Then, in `preload()`, add (using the scene loader; paths are relative to the Vite `public` root):

```ts
const HERO_ARCHES = ["melee", "ranged", "magic"] as const;
for (const a of HERO_ARCHES) {
  this.load.spritesheet(`hero__${a}`, `assets/sprites/hero/hero__${a}.png`, {
    frameWidth: 192,
    frameHeight: 192,
  });
  this.load.json(`hero__${a}__sockets`, `assets/sprites/hero/hero__${a}.sockets.json`);
}
this.load.json("worn__index", "assets/sprites/worn/index.json");
// Load every worn texture listed by the catalog resolver:
import("../data/items.ts").then(() => {}); // ensure catalog import side-effects (no-op if already imported)
```

For the worn textures, load them from the generated `worn/index.json` keys. Since `preload` cannot await JSON, load them in two phases using a chained loader: register a one-time `filecomplete-json-worn__index` handler that queues the PNGs, or (simpler) generate a static `src/data/wornManifest.ts` in `genWorn.mjs` (list of keys) and import it to load synchronously. **Chosen approach:** extend `genWorn.mjs` to also emit `src/data/wornManifest.ts`:

```js
// add at the end of scripts/svgart/genWorn.mjs, after writing index.json:
const keys = [...seen.keys()];
const ts =
  `// AUTO-GENERATED by scripts/svgart/genWorn.mjs — do not edit.\n` +
  `export const WORN_KEYS: string[] = ${JSON.stringify(keys)};\n`;
writeFileSync("src/data/wornManifest.ts", ts);
```

Then in PreloadScene:

```ts
import { WORN_KEYS } from "../data/wornManifest.ts";
for (const key of WORN_KEYS) this.load.image(key, `assets/sprites/worn/${key}.png`);
```

In `create()` (where existing anims are built), create per-archetype anims from the ranges. Match the existing anim-creation idiom; the keys MUST be `hero__<arch>_idle|walk|attack|skill|hurt`:

```ts
import { heroAnimRanges } from "./heroAnimRanges.ts";
for (const a of HERO_ARCHES) {
  const json = this.cache.json.get(`hero__${a}__sockets`);
  const names: string[] = json.frames.map((f: { name: string }) => f.name);
  const r = heroAnimRanges(names);
  const mk = (suffix: string, frames: number[], frameRate: number, repeat: number) =>
    this.anims.create({
      key: `hero__${a}_${suffix}`,
      frames: frames.map((i) => ({ key: `hero__${a}`, frame: i })),
      frameRate,
      repeat,
    });
  mk("idle", r.idle, 3, -1);
  mk("walk", r.walk, 10, -1);
  mk("attack", r.attack, 14, 0);
  mk("skill", r.skill, 12, 0);
  mk("hurt", r.hurt, 8, 0);
}
```

- [ ] **Step 6: Re-run the sprite manifest so the new hero sheets are registered**

Run: `node scripts/svgart/genWorn.mjs && node scripts/svgart/gen.mjs --only=manifest`
Expected: `worn textures: N`, then `manifest: <count> entries`. (The manifest scan also picks up `hero__melee.json` etc., but the explicit loads above are what the runtime uses.)

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/scenes/PreloadScene.ts src/scenes/heroAnimRanges.ts src/data/wornManifest.ts scripts/svgart/genWorn.mjs tests/heroAnimRanges.test.ts public/assets/sprites/worn/index.json
git commit -m "feat(battle): preload hero archetype sheets, sockets, and worn textures"
```

---

### Task 8: Refactor HeroLayeredSprite to socket-driven placement

**Files:**

- Create: `src/scenes/heroLayout.ts` (socket→layer placement helpers, keeps the sprite file < 500 lines)
- Modify: `src/scenes/HeroLayeredSprite.ts`
- Modify: `src/scenes/heroEquipVisuals.ts`
- Test: `tests/heroLayout.test.ts`

`heroEquipVisuals.ts` now resolves each slot to a worn texture key + tint + pivot reference (via `wornShapeFor`) instead of `item__<id>`. `HeroLayeredSprite` swaps the body sprite per archetype, reads the current frame name each tick, looks up sockets, and positions/rotates each equipped layer onto its socket using the worn pivot. The static `GEAR_ANCHOR`, `REST_POSE`, `layoutGear`, `applyWeaponPose`, `restGeom` and the per-family weapon tween logic are removed (the frame's moving `handR` now produces the swing for free). `heroLayout.ts` owns the math so the sprite class stays focused.

- [ ] **Step 1: Write the failing test for the layout helper**

```ts
// tests/heroLayout.test.ts
import { describe, it, expect } from "vitest";
import { placeLayer } from "../src/scenes/heroLayout.ts";

describe("placeLayer", () => {
  it("positions a layer at the socket minus its pivot offset, scaled", () => {
    // socket local (24, -40) angle 30; pivot (12, 22) in a 24px-native art; body scale 1.5; worn render scale ditto
    const out = placeLayer(
      { x: 24, y: -40, angle: 30 },
      { pivot: { x: 12, y: 22 }, w: 24, h: 24 },
      { bodyScale: 1.5, wornScale: 1.5, facingLeft: false },
    );
    expect(out.x).toBeCloseTo(24 * 1.5, 2);
    expect(out.y).toBeCloseTo(-40 * 1.5, 2);
    expect(out.angle).toBe(30);
    // origin so the pivot lands on the socket:
    expect(out.originX).toBeCloseTo(12 / 24, 3);
    expect(out.originY).toBeCloseTo(22 / 24, 3);
    expect(out.scale).toBeCloseTo(1.5, 3);
  });
  it("does not double-mirror, but does adjust originX for flipX rendering", () => {
    const out = placeLayer(
      { x: -24, y: -40, angle: -30 },
      { pivot: { x: 6, y: 22 }, w: 24, h: 24 },
      { bodyScale: 1, wornScale: 1, facingLeft: true },
    );
    expect(out.x).toBeCloseTo(-24, 2);
    expect(out.flipX).toBe(true);
    // When flipped, originX must be 1 - (pivot.x / w) -> 1 - (6 / 24) = 0.75
    expect(out.originX).toBeCloseTo(0.75, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroLayout.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the layout helper**

```ts
// src/scenes/heroLayout.ts
// Pure math: given a body-local socket and a worn art's pivot, compute the
// transform to apply to the layer sprite so its pivot sits exactly on the socket.
import type { Socket } from "./heroSockets.ts";

export interface WornArt {
  pivot: { x: number; y: number };
  w: number;
  h: number;
}
export interface LayoutCtx {
  bodyScale: number;
  wornScale: number;
  facingLeft: boolean;
}
export interface Placement {
  x: number;
  y: number;
  angle: number;
  scale: number;
  originX: number;
  originY: number;
  flipX: boolean;
}

export function placeLayer(socket: Socket, art: WornArt, ctx: LayoutCtx): Placement {
  // Socket is already body-local and mirrored. Position the layer at the socket,
  // set its origin to the pivot so rotation happens about the grip/ankle/etc.
  // When facing left (flipX = true), Phaser 3 requires the originX to be inverted
  // to 1 - originX so that the pivot remains physically aligned.
  return {
    x: socket.x * ctx.bodyScale,
    y: socket.y * ctx.bodyScale,
    angle: socket.angle,
    scale: ctx.wornScale,
    originX: ctx.facingLeft ? 1 - art.pivot.x / art.w : art.pivot.x / art.w,
    originY: art.pivot.y / art.h,
    flipX: ctx.facingLeft,
  };
}

/** Which socket each worn shape pins to. */
export function socketKeyForShape(shape: string): string {
  switch (shape) {
    case "helmet":
      return "head";
    case "body":
      return "torso";
    case "boots":
      return "footR"; // primary; the back boot uses footL (see HeroLayeredSprite)
    case "gloves":
      return "handR";
    case "wing":
      return "back";
    default:
      return "handR"; // all weapons
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heroLayout.test.ts`
Expected: PASS (2 assertions).

- [ ] **Step 5: Update `heroEquipVisuals.ts` to resolve worn keys + tints**

Read the current file (58 lines), then replace the resolver so each slot yields `{ key, tint, shape }` via `wornShapeFor`, falling back to the raw icon only when no worn art exists. Keep `weaponType` (drives archetype) and `wingKey`/`petKey` (wings keep `appearanceRef` art when present). New shape of `HeroLayerConfig`:

```ts
export interface WornLayer {
  key: string;
  shape: string;
}
export interface HeroLayerConfig {
  weaponType: WeaponType | null;
  archetype: HeroArchetype;
  weapon: WornLayer | null;
  helmet: WornLayer | null;
  body: WornLayer | null;
  gloves: WornLayer | null;
  boots: WornLayer | null;
  wingKey: string | null;
  petKey: string | null;
}
```

Implementation resolves each equip slot's def via the existing `_instanceDef`, then `wornShapeFor(def)` → `{ shape, key }`. Weapon family → `archetypeForWeapon`. Provide the full rewritten file; keep `_instanceDef`, `_resolveWing`, `_resolvePet` helpers. (Tests for this resolver are covered transitively by Task 9's playtest; the math-heavy pieces are unit-tested in Tasks 5–8.)

- [ ] **Step 6: Refactor `HeroLayeredSprite.ts`**

Read the current file, then apply these structural changes:

1. Remove `GEAR_ANCHOR`, `REST_POSE`, `DEFAULT_POSE`, `layoutGear`, `applyWeaponPose`, `restGeom`, and the per-family weapon tween bodies in `playAttack`/`playCast`. Keep `playHurt`, the pet wander, wings flap, `scaleToHeight`, depth/visibility/position overrides.
2. Replace the single `bodySprite` texture with archetype-aware playback: store `archetype`, and on `syncEquipment` swap to `hero__<arch>` and re-bind anim keys `hero__<arch>_idle|walk|attack|skill|hurt`.
3. Replace the four `gear` sprites + `weaponSprite` with a uniform set of worn-layer sprites keyed by slot: `weapon, helmet, body, gloves, bootsR, bootsL` (two boots), each a `Phaser.GameObjects.Sprite`. Layer order back→front: `wings · body(armor) · bootsL · bootsR · torso-body · helmet · gloves · weapon` over the body sprite. (Tune order during playtest.)
4. In `tick`, after choosing the locomotion/oneshot anim, read `const frameName = this.bodySprite.anims.currentFrame?.textureFrame` (the frame name) — or map the current frame index back to a name via the loaded names array. Then `const sockets = registry.get(this.archetype).forFrame(frameName, this.facingLeft)`. For each visible worn layer, look up its socket via `socketKeyForShape(shape)`, fetch the worn art's pivot from the loaded `worn__index`, compute `placeLayer(...)`, and apply `setPosition/setAngle/setScale/setOrigin/setFlipX`. Boots use `footR`/`footL`.
5. Pass the `HeroSocketRegistry` and `worn__index` JSON into the sprite — either via constructor args or by reading from `scene.cache.json` / a scene-level singleton. Prefer constructor injection for testability.
6. `playAttack`/`playCast` simplify to `beginOneShot(ATK/CAST, prio)` only — the weapon now swings because `handR` moves across `act1..act3`. Keep an OPTIONAL tiny scale-pulse on the weapon for cast emphasis.
7. **Ground Projection Shadow:** Add a shadow ellipse sprite. In `tick`, position it on the `shadow` socket, and scale its size/opacity dynamically depending on the vertical bounce height of the `torso` socket.
8. **Dynamic Weapon Attack Sweep Trails:** Track the position of `handR` in the previous frame. During attack frames (`act1..act3`), draw a brief swipe trail using `Phaser.GameObjects.Graphics` connecting the current and previous weapon position, fading it out over 150ms.
9. **Rarity Glint/Sparkle Particles:** Add a particle emitter helper. If the equipped weapon or armor is Legendary or Unique, emit slow-falling spark particles from their socket coordinates (`handR`, `head`, or `torso`).

Because this is a large edit, split helpers into `heroLayout.ts` (done) and keep `HeroLayeredSprite.ts` under 500 lines (it is ~300 after removing the static-anchor machinery). VERIFY the file length after editing:

Run: `wc -l src/scenes/HeroLayeredSprite.ts`
Expected: < 500.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Fix any type drift (e.g. `HeroLayerConfig` consumers in `BattleScene.ts` / `squadInfoPanel.ts` — grep for `resolveHeroLayers` and `weaponKey`/`bootsKey` and update call sites).

Run: `npx vitest run`
Expected: all unit tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/HeroLayeredSprite.ts src/scenes/heroLayout.ts src/scenes/heroEquipVisuals.ts tests/heroLayout.test.ts
git commit -m "feat(battle): socket-driven equipment placement; weapon swings with the rig hand"
```

---

## Phase 4 — Integration, tuning, verification

### Task 9: In-battle playtest + socket tuning

**Files:**

- Tuning only: `scripts/svgart/poses.mjs` (joint angles), `scripts/pixelart/worn.mjs` (pivots), regenerate.

- [ ] **Step 1: Build + launch**

Run: `npm run build` (expect typecheck + vite build clean), then start the dev server and the CDP self-playtest harness per the project convention (`window.__game`). Enter a battle with the hero.

- [ ] **Step 2: Observe each archetype**

Equip a Sword (melee), then a Bow (ranged), then a Staff (magic). For each, confirm:

- Body sheet swaps to the right archetype (stance changes).
- Weapon sits in the hand at idle and **sweeps/draws/charges** with the attack — no floating.
- Helmet stays on the head through walk bob; boots track each foot through the walk cycle; body armor stays on the torso; wings sit at the back and flap.
- Facing left mirrors everything correctly (no reversed weapons or detached gear).

- [ ] **Step 3: Tune**

Adjust joint angles in the pose sets and/or pivots in `worn.mjs` where a layer reads slightly off, then regenerate and reload:

Run: `node scripts/svgart/genHero.mjs && node scripts/svgart/genWorn.mjs && node scripts/svgart/gen.mjs --only=manifest`

Repeat observe→tune until placement reads correctly at battle scale. Capture before/after screenshots via the CDP harness and attach to the chat.

- [ ] **Step 4: Commit tuning**

```bash
git add scripts/svgart/poses.mjs scripts/pixelart/worn.mjs public/assets/sprites/hero/ public/assets/sprites/worn/
git commit -m "tune(art): hero socket + worn-pivot alignment from battle playtest"
```

---

### Task 10: Cleanup + regression sweep

**Files:**

- Modify: dead-code removal across `HeroLayeredSprite.ts` consumers.

- [ ] **Step 1: Grep for stale references**

Run: `rg -n "weaponKey|bootsKey|glovesKey|helmetKey|bodyKey|GEAR_ANCHOR|REST_POSE" src/`
Expected: only intended references remain (none of the removed ones). Fix stragglers.

- [ ] **Step 2: Full verification**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 3: Scene re-entry check (Phaser instance reuse)**

Confirm any newly-added pushed-array/instance fields on scenes are reset in `create()` (per project rule — re-entry on real WebGL crashes otherwise). The sprite holds no scene-lifetime arrays beyond what it constructs per-instance, but verify `PreloadScene` anim creation guards against duplicate `anims.create` on re-entry (use `if (!this.anims.exists(key))`).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(battle): remove static gear-anchor machinery; socket pipeline is the source of truth"
```

---

## Phase 5 — OPTIONAL later: painterly (SDXL) body on the same sockets (B2)

Not part of the initial build; documented so the socket runtime is forward-compatible.

The runtime keys off `hero__<arch>` spritesheets + `hero__<arch>.sockets.json`. To upgrade the body to painterly SDXL without touching runtime code:

1. Generate SDXL **limb parts** (torso, upper/forearm ×2, hands, thighs/shins ×2, head) for each archetype on transparent backgrounds, plus a neutral idle reference.
2. Author a `genHeroSDXL.mjs` that assembles those parts on the SAME rig joint math (reuse `frameSockets`) to bake a painterly strip — OR render the parts on the rig at runtime via a lightweight bone-assembly container.
3. Emit the identical `hero__<arch>.png` (painterly) + `hero__<arch>.sockets.json` (joints unchanged — the rig math is the same). The worn art may be re-skinned to painterly too, reusing the same pivots.

Because sockets are computed from rig math, the manifest is identical whether the body is pixel or painterly — the runtime, equipment placement, and tuning all carry over unchanged. This is the path to the painterly look the original request favored, deferred until the pixel-rig socket system is proven in battle.

---

## Self-Review Notes

- **Spec coverage:** weaponless archetype bodies (Tasks 1–3) ✓; drawn item appearance art not icons (Tasks 4–5) ✓; per-pose placement / boots-track-feet / weapon-tracks-hand (Tasks 2, 6, 8) ✓; "complete set of art via the rig per archetype" (Task 3) ✓; subtle detail / facing mirror / tuning (Task 9) ✓; painterly SDXL path preserved (Phase 5) ✓.
- **Type consistency:** `HeroArchetype` ("melee"|"ranged"|"magic") used in `heroArchetype.ts`, `heroEquipVisuals.ts`, `HeroLayeredSprite.ts`; `Socket`/`FrameSockets`/`SocketManifest` in `heroSockets.ts` consumed by `heroLayout.ts` and the sprite; worn texture key format `worn__<shape>__<tintHex>` is produced by `wornShapeFor` and consumed by `genWorn.mjs` + PreloadScene + the sprite.
- **Pre-flight VERIFY items (do before coding the noted tasks):** exact export name of the item catalog array in `src/data/items.ts` (Task 5); `Rarity` symbol name in `schema.ts` (Task 5); existing anim-creation idiom + frame-name access API in `PreloadScene.ts` (Task 7); `resolveHeroLayers` call sites in `BattleScene.ts`/`squadInfoPanel.ts` (Task 8 Step 7).
- **Known tuning risk:** socket coordinates assume body origin `(0.5, 0.78)`. If `HeroLayeredSprite` origin changes, update `ORIGIN_X/ORIGIN_Y` in `heroSockets.ts` to match — they are the single source of that constant.
