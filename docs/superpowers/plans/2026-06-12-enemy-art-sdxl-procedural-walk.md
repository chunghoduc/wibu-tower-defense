# Enemy Art → SDXL + Procedural Walk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate all enemies as single z-image-turbo (SDXL) base sprites driven by an enhanced, unit-tested procedural walk, and delete the SVG/pixel-art and Ollama art generators so SDXL is the sole art pipeline.

**Architecture:** Two-layer enemy rendering — one static SDXL sprite + a pure `enemyWalkTransform(phase, opts)` function whose output (`yOff/xOff/angle/scaleMulX/scaleMulY/liftNorm`) drives the sprite transform and ground shadow in `animateEnemy`. Removing authored `walk/atk/hurt` frames is safe because the runtime already guards every sheet animation with `anims.exists()`.

**Tech Stack:** TypeScript, Phaser 3.80, Vite, vitest; `scripts/sdart/` (POSTs to local z-image-turbo at `http://127.0.0.1:8765/generate`) + `cutout.py`.

---

### Task 1: Pure procedural-walk module (TDD)

**Files:**

- Create: `src/scenes/enemyWalkTransform.ts`
- Test: `tests/enemy-walk-transform.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/enemy-walk-transform.test.ts
import { describe, expect, it } from "vitest";
import { enemyWalkTransform } from "../src/scenes/enemyWalkTransform.ts";

describe("enemyWalkTransform", () => {
  it("bobs the body up mid-stride and plants at phase 0", () => {
    const plant = enemyWalkTransform(0); // sin(0)=0 → foot-plant
    const mid = enemyWalkTransform(Math.PI / 2); // sin=1   → mid-swing
    expect(plant.yOff).toBeCloseTo(0, 5);
    expect(mid.yOff).toBeLessThan(plant.yOff); // up = more negative
  });

  it("keeps the bob within [-amp*BOB, 0] (never dips below ground)", () => {
    for (let p = 0; p < Math.PI * 4; p += 0.31) {
      const t = enemyWalkTransform(p);
      expect(t.yOff).toBeLessThanOrEqual(0.0001);
      expect(t.yOff).toBeGreaterThanOrEqual(-5.0001);
    }
  });

  it("squashes (scaleY<1) and stretches (scaleX>1) at foot-plant, neutral mid-swing", () => {
    const plant = enemyWalkTransform(0);
    expect(plant.scaleMulY).toBeLessThan(1);
    expect(plant.scaleMulX).toBeGreaterThan(1);
    const mid = enemyWalkTransform(Math.PI / 2);
    expect(mid.scaleMulY).toBeCloseTo(1, 5);
    expect(mid.scaleMulX).toBeCloseTo(1, 5);
  });

  it("scales every amplitude by the amp option", () => {
    const a1 = enemyWalkTransform(0.4, { amp: 1 });
    const a2 = enemyWalkTransform(0.4, { amp: 2 });
    expect(a2.yOff).toBeCloseTo(a1.yOff * 2, 5);
    expect(a2.xOff).toBeCloseTo(a1.xOff * 2, 5);
  });

  it("exposes liftNorm in [0,1] equal to |sin(phase)| (decoupled shadow cue)", () => {
    expect(enemyWalkTransform(0).liftNorm).toBeCloseTo(0, 5);
    expect(enemyWalkTransform(Math.PI / 2).liftNorm).toBeCloseTo(1, 5);
    expect(enemyWalkTransform(2.0).liftNorm).toBeCloseTo(Math.abs(Math.sin(2.0)), 5);
  });

  it("adds the lean option to angle and stays finite everywhere", () => {
    const noLean = enemyWalkTransform(0.7, { amp: 1 });
    const leaned = enemyWalkTransform(0.7, { amp: 1, lean: 2 });
    expect(leaned.angle).toBeCloseTo(noLean.angle + 2, 5);
    for (let p = -10; p < 10; p += 0.13) {
      const t = enemyWalkTransform(p, { amp: 0.6, lean: -2 });
      for (const v of [t.yOff, t.xOff, t.angle, t.scaleMulX, t.scaleMulY, t.liftNorm])
        expect(Number.isFinite(v)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/enemy-walk-transform.test.ts`
Expected: FAIL — `Cannot find module '../src/scenes/enemyWalkTransform.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scenes/enemyWalkTransform.ts
// Pure (Phaser-free) procedural walk math for a single-frame enemy sprite.
// One source of truth for the gait amplitudes so the sprite transform and the
// ground-contact shadow can never drift out of sync.

/** Per-frame transform deltas for a walking enemy, derived from a gait phase. */
export interface WalkTransform {
  /** Vertical body bob in px (<=0; negative = lifted off the ground). */
  yOff: number;
  /** Lateral weight-shift waddle in px. */
  xOff: number;
  /** Body rock in degrees (+ caller lean). */
  angle: number;
  /** Multiply the sprite's base scale on X (stretch on foot-plant). */
  scaleMulX: number;
  /** Multiply the sprite's base scale on Y (squash on foot-plant). */
  scaleMulY: number;
  /** 0 (foot planted) .. 1 (peak of the bob); drives the shadow, amp-independent. */
  liftNorm: number;
}

export interface WalkOpts {
  /** Amplitude factor (bosses heavier → smaller, ~0.6); default 1. */
  amp?: number;
  /** Extra degrees added to angle for "lean into travel"; default 0. */
  lean?: number;
}

const BOB = 5; // body-bob amplitude (px) — legs are no longer authored
const WADDLE = 1.5; // lateral sway (px)
const ROCK = 4; // body rock (deg)
const SQUASH = 0.12; // scaleY drop at full foot-plant
const STRETCH = 0.08; // scaleX rise at full foot-plant

export function enemyWalkTransform(phase: number, opts: WalkOpts = {}): WalkTransform {
  const amp = opts.amp ?? 1;
  const lean = opts.lean ?? 0;
  const s = Math.sin(phase);
  const swing = Math.abs(s); // 0 at foot-plant, 1 mid-swing
  const plant = 1 - swing; // weight settling on the planted foot
  return {
    yOff: -swing * BOB * amp,
    xOff: s * WADDLE * amp,
    angle: -Math.cos(phase) * ROCK * amp + lean,
    scaleMulX: 1 + STRETCH * plant * amp,
    scaleMulY: 1 - SQUASH * plant * amp,
    liftNorm: swing,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/enemy-walk-transform.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/enemyWalkTransform.ts tests/enemy-walk-transform.test.ts
git commit -m "feat: pure enemyWalkTransform gait module (TDD)"
```

---

### Task 2: Wire the gait module into animateEnemy

**Files:**

- Modify: `src/scenes/battleSceneSprites.ts` (the GROUND branch of `animateEnemy`, ~lines 237-249; the shadow `lift`, ~line 277; the doc comment ~177-192; `playSpriteOneShot` enemy base fallback)

- [ ] **Step 1: Import the module**

At the top of `src/scenes/battleSceneSprites.ts`, add alongside the other local imports:

```ts
import { enemyWalkTransform } from "./enemyWalkTransform.ts";
```

- [ ] **Step 2: Replace the GROUND gait math**

Replace the `else { ... }` GROUND block (currently lines ~237-250, from `const A = boss ? 0.6 : 1;` through the `if (moved > 0.2 ...) angle += ...` line and its closing `}`) with:

```ts
    } else {
      const A = boss ? 0.6 : 1;                          // bosses bob/rock less (heavy)
      let c = (s.getData("gaitPhase") as number) ?? e.uid * 1.3;
      c += moved * 0.16 * (boss ? 0.7 : 1);              // ~one step per ~20px; longer boss stride
      s.setData("gaitPhase", c);
      const lean = moved > 0.2 && lx !== undefined ? Math.sign(px - lx) * 2 : 0;
      const t = enemyWalkTransform(c, { amp: A, lean });
      yOff = t.yOff; xOff = t.xOff; angle = t.angle;
      scaleX = base * t.scaleMulX; scaleY = base * t.scaleMulY;
      s.setData("liftNorm", t.liftNorm);
    }
```

- [ ] **Step 3: Decouple the shadow lift from the bob amplitude**

Replace the non-flyer shadow branch (currently ~lines 276-280, the `} else {` with `const lift = Math.max(0, -yOff) / (3 * (boss ? 0.6 : 1));`) with:

```ts
      } else {
        const lift = (s.getData("liftNorm") as number) ?? 0; // 0 planted → 1 airborne
        shadow.setScale(1 - 0.42 * lift);
        shadow.setAlpha((0.34 - 0.16 * lift) * s.alpha);
      }
```

- [ ] **Step 4: Update the now-stale doc comment**

In the `animateEnemy` doc block (~177-192) replace the sentence referencing the authored sheet — `The 4-frame articulated \`\_walk\` sheet (alternating legs, see creatures.mjs) now carries the stride; the _transform_ adds weight and ground contact:` — with:

```ts
   * Enemies are a SINGLE z-image (SDXL) sprite; ALL ground locomotion is the
   * transform (see enemyWalkTransform.ts) — there are no authored walk frames:
```

- [ ] **Step 5: Make the enemy one-shot base fall back to idle**

Find the `playSpriteOneShot` enemy call that uses `"walk"` as the base (the hurt handler, ~line 36): `this.playSpriteOneShot(e ?? null, ["hurt"], "walk");` and change the base to `"idle"`:

```ts
this.playSpriteOneShot(e ?? null, ["hurt"], "idle");
```

(The helper already guards both the requested anim and the base with `anims.exists()`, so a missing `hurt`/`idle` anim is a safe no-op.)

- [ ] **Step 6: Typecheck + run the gait test + full suite**

Run: `npm run typecheck && npx vitest run tests/enemy-walk-transform.test.ts`
Expected: tsc clean; gait test PASS. (Full suite runs in Task 5 after deletions.)

- [ ] **Step 7: Commit**

```bash
git add src/scenes/battleSceneSprites.ts
git commit -m "feat: drive enemy walk from enemyWalkTransform; shadow lift decoupled"
```

---

### Task 3: Remove SVG-genart + Ollama generators (no runtime consumers)

Verified gen-only (grep): no `src/` runtime file imports any of these; only scripts and their own tests do. `passiveGrid.test.ts` is UNRELATED (passive skill grid) — keep it.

**Files:**

- Delete: `scripts/svgart/` (gen.mjs, rig.mjs, pixrig.mjs, poses.mjs, genAwakenIcon.mjs, genChaosIcon.mjs)
- Delete: `scripts/pixelart/` (gen.mjs, creatures.mjs, canvas.mjs, parts.mjs, specs.mjs, items.mjs)
- Delete: `scripts/genSprites.ts`, `scripts/genArtPrompts.ts`
- Delete: `src/art/` (gridPrompt.ts, ollamaClient.ts, palette.ts, pngEncoder.ts, spriteGrid.ts)
- Delete: `src/data/artSpec.ts`, `src/data/artPrompts.ts`
- Delete tests: `tests/enemy-walk.test.ts`, `tests/artPrompts.test.ts`, `tests/spriteGrid.test.ts`, `tests/pngEncoder.test.ts`, `tests/palette.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Delete the generator trees and dead tests**

```bash
cd /home/shyaken/Workplace/wibu-tower-defense
git rm -r scripts/svgart scripts/pixelart src/art
git rm scripts/genSprites.ts scripts/genArtPrompts.ts src/data/artSpec.ts src/data/artPrompts.ts
git rm tests/enemy-walk.test.ts tests/artPrompts.test.ts tests/spriteGrid.test.ts tests/pngEncoder.test.ts tests/palette.test.ts
```

- [ ] **Step 2: Repoint the npm art scripts to the SDXL flow**

In `package.json` `scripts`, replace the line `"gen:sprites": "vite-node scripts/genSprites.ts",` with the SDXL base-sprite generator and drop the Ollama prompt dump:

```jsonc
    "gen:sprites": "vite-node scripts/sdart/sdgen.mjs",
    "gen:sprites:anim": "vite-node scripts/sdart/animgen.mjs",
```

Delete the `"gen:art-prompts": "vite-node scripts/genArtPrompts.ts",` line entirely. Keep `gen:item-visual` and `gen:skill-visual` (they feed SDXL).

- [ ] **Step 3: Confirm nothing dangling references the deleted modules**

Run:

```bash
grep -rnE "art/spriteGrid|art/ollamaClient|art/gridPrompt|art/pngEncoder|art/palette|data/artSpec|data/artPrompts|pixelart/|svgart/|genSprites|genArtPrompts" src scripts tests package.json | grep -v "spriteManifest.ts:1:"
```

Expected: NO output (the only allowed hit is the `spriteManifest.ts` header comment, fixed in Task 4).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean (no missing-module errors).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove SVG/pixel-art + Ollama art generators (SDXL is the sole flow)"
```

---

### Task 4: Regenerate enemy sprites via SDXL + update manifest

The SD server (`z-image-turbo` @ :8765) must be up — verified ready this session.

**Files:**

- Regenerate: `public/assets/sprites/enemy/*.png` (20 single-frame 300×300 cutouts)
- Delete: `public/assets/sprites/enemy/*.json` (stale 8-frame sidecars; unused at runtime)
- Modify: `src/data/spriteManifest.ts` (enemy entries → `frames:1`)

- [ ] **Step 1: Generate the 20 enemy base sprites (background)**

Run (≈26s/sprite, ~9 min total):

```bash
cd /home/shyaken/Workplace/wibu-tower-defense
npx vite-node scripts/sdart/sdgen.mjs --only=enemy --force
```

Expected: `SD generating 20 sprites`, each `[n/20] enemy/<id>.png` with no `SKIP (gen failed)`.

- [ ] **Step 2: Verify every enemy PNG is a 300×300 RGBA cutout**

Run:

```bash
python3 - <<'PY'
from PIL import Image; import glob, os
bad=[]
for p in sorted(glob.glob("public/assets/sprites/enemy/*.png")):
    im=Image.open(p)
    if im.size!=(300,300) or im.mode!="RGBA": bad.append((os.path.basename(p),im.size,im.mode))
print("count", len(glob.glob("public/assets/sprites/enemy/*.png")))
print("BAD", bad if bad else "none")
PY
```

Expected: `count 20`, `BAD none`.

- [ ] **Step 3: Rewrite the enemy entries in the manifest**

Run (rewrites only `kind:"enemy"` lines; leaves tower/hero/boss/item untouched; also fixes the header comment):

```bash
node - <<'JS'
const fs=require("fs"); const f="src/data/spriteManifest.ts";
let src=fs.readFileSync(f,"utf8");
src=src.replace(/^\/\/ AUTO-GENERATED by scripts\/svgart\/gen\.mjs.*$/m,
  "// Enemy entries are single SDXL frames (scripts/sdart/sdgen.mjs); other kinds maintained here.");
src=src.split("\n").map(line=>{
  if(!line.includes('kind:"enemy"')) return line;
  return line.replace(/frameWidth:\d+,frameHeight:\d+,frames:\d+,names:\[[^\]]*\]/,
    'frameWidth:300,frameHeight:300,frames:1,names:["idle"]');
}).join("\n");
fs.writeFileSync(f,src);
console.log("rewrote enemy manifest entries");
JS
grep -c 'kind:"enemy".*frames:1,names:\["idle"\]' src/data/spriteManifest.ts
```

Expected: `rewrote enemy manifest entries` then `20`.

- [ ] **Step 4: Delete stale enemy JSON sidecars (unused at runtime)**

```bash
git rm public/assets/sprites/enemy/*.json
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: regenerate all enemies as SDXL base sprites; manifest -> single idle frame"
```

---

### Task 5: Verify whole + playtest + memory + ship

**Files:**

- Modify: memory under `~/.claude/.../memory/` (rules + index)

- [ ] **Step 1: Full verification**

Run:

```bash
npm run typecheck && npx vitest run && npm run build
```

Expected: tsc clean; **all tests pass** (deleted suites gone, gait suite present); `vite build` succeeds.

- [ ] **Step 2: Playtest the enemy walk (CDP)**

Start the app and drive a battle via `window.__game` (per the playtest memory). Confirm in a battle: enemies render in the new SDXL anime style (matching towers/hero), bob + squash/stretch while walking, shadow contracts on each lift, take hits and die with **no console errors**; leave and re-enter BattleScene (scene re-entry reset rule) without a crash. Capture one screenshot to `/tmp/enemy-sdxl.png` and attach it.

- [ ] **Step 3: Update memory to SDXL-only**

- Rewrite `reference_playtest_and_art.md`: regenerate art via `npm run gen:sprites` → `scripts/sdart/sdgen.mjs` (SDXL/z-image-turbo @ :8765), **not** `scripts/svgart/gen.mjs`.
- Rewrite `project_procedural_sprite_animation.md`: drop the 2026-06-12 articulated-SVG EXCEPTION; enemies are single SDXL frames + procedural `enemyWalkTransform` — the procedural-carries-motion rule is reinforced.
- Add `project_art_pipeline_sdxl.md`: `scripts/sdart/` (z-image-turbo) is the SOLE art generator; SVG/pixel-art (`svgart`,`pixelart`) and Ollama (`src/art`,`genSprites`) are removed; `gen:sprites` → `sdgen.mjs`.
- Update `MEMORY.md` index lines accordingly.

- [ ] **Step 4: Commit memory + final**

```bash
git add -A && git commit -m "docs: memory — SDXL is the sole art pipeline; enemies SDXL+procedural"
```

- [ ] **Step 5: Deploy**

```bash
git push origin main
npm run build
npx firebase-tools deploy --only hosting
```

Expected: push OK; build green; `✔ Deploy complete!` → https://wibu-tower-defense-d8b1c.web.app

```

---

## Self-Review

**Spec coverage:** A (SDXL enemy art) → Task 4. B (enhanced procedural walk) → Tasks 1-2. C (single-frame safety) → Task 2 steps 2-5 (guards already exist; base→idle). D (remove SVG+Ollama generators, repoint scripts) → Task 3. E (memory/docs) → Task 5 step 3. Testing → Task 1 (unit), Task 4 step 2 + step 3 grep (manifest), Task 5 (suite/build/playtest). All covered.

**Placeholder scan:** None — every code/command step is concrete.

**Type consistency:** `enemyWalkTransform(phase, opts)` returns `{yOff,xOff,angle,scaleMulX,scaleMulY,liftNorm}`; Task 2 consumes exactly those names (`t.yOff … t.liftNorm`) and stashes `liftNorm` on sprite data read back in the shadow branch. `WalkOpts {amp?,lean?}` matches both call sites. Names consistent across tasks.
```
