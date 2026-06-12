# Enemy Walk Articulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give enemies a real articulated walk cycle (alternating legs + body bob + 4 walk frames) so they step instead of slide.

**Architecture:** Replace the whole-body translate/shear fake in `composeEnemyFrames` with a gait-aware `reposeFrame()` that re-poses the sprite's **leg band** (bottom ~28%) per leg — lifting the forward leg while the other plants. An 8-pose table (`idle, walk1..walk4, atk1, atk2, hurt`) drives it. Regenerate enemy sprite sheets + manifest. Trim the runtime `animateEnemy` body-bob so the moving legs read instead of double-bobbing.

**Tech Stack:** Node ESM art scripts (`scripts/pixelart/creatures.mjs`, `canvas.mjs`), vite-node generator, Phaser runtime (`battleSceneSprites.ts`), vitest.

---

### Task 1: Articulated walk frames in the creature composer

**Files:**

- Modify: `scripts/pixelart/creatures.mjs` (replace `pose()` + `ENEMY_POSES`, add `reposeFrame()`)
- Test: `tests/enemy-walk.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/enemy-walk.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { composeEnemyFrames, ENEMY_SPECS } from "../scripts/pixelart/creatures.mjs";

// Lowest (max) filled y on a canvas half. left=true → x < S/2, else x >= S/2.
function footY(cv: { w: number; d: (string | null)[] }, left: boolean): number {
  const S = cv.w;
  let maxY = -1;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const inHalf = left ? x < S / 2 : x >= S / 2;
      if (inHalf && cv.d[y * S + x]) maxY = y;
    }
  return maxY;
}

function key(cv: { d: (string | null)[] }): string {
  return cv.d.map((c) => (c ? "1" : "0")).join("");
}

describe("composeEnemyFrames", () => {
  it("emits an 8-frame sheet with a 4-frame walk cycle", () => {
    const { names, frames } = composeEnemyFrames(ENEMY_SPECS.grunt);
    expect(names).toEqual(["idle", "walk1", "walk2", "walk3", "walk4", "atk1", "atk2", "hurt"]);
    expect(frames).toHaveLength(8);
    const S = frames[0].w;
    for (const f of frames) expect(f.w).toBe(S);
  });

  it("walk frames are pairwise distinct (not a uniform shear)", () => {
    const { frames } = composeEnemyFrames(ENEMY_SPECS.grunt);
    const walk = frames.slice(1, 5).map(key);
    expect(new Set(walk).size).toBe(4);
  });

  it("a biped strides: left/right foot asymmetry flips between contact frames", () => {
    const { names, frames } = composeEnemyFrames(ENEMY_SPECS.grunt);
    const f = (n: string) => frames[names.indexOf(n)];
    const d1 = footY(f("walk1"), true) - footY(f("walk1"), false); // <0: left foot lifted
    const d3 = footY(f("walk3"), true) - footY(f("walk3"), false); // >0: right foot lifted
    expect(d1).toBeLessThan(0);
    expect(d3).toBeGreaterThan(0);
  });

  it("legless bodies (slime/ghost/winged) compose 8 distinct frames without error", () => {
    for (const id of ["slime", "phantom", "gargoyle"] as const) {
      const { frames } = composeEnemyFrames(ENEMY_SPECS[id]);
      expect(frames).toHaveLength(8);
      expect(new Set(frames.map(key)).size).toBeGreaterThan(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/enemy-walk.test.ts`
Expected: FAIL — current `ENEMY_POSES` yields names `["idle","walk1","walk2","atk1","atk2","hurt"]` (6 frames), so the 8-frame / 4-walk / sign-flip assertions fail.

- [ ] **Step 3: Replace `pose()` + `ENEMY_POSES` with `reposeFrame()` + 8-pose table**

In `scripts/pixelart/creatures.mjs`, replace the `pose()` function (the block starting `// Re-pose a finished creature canvas:` through its closing `}`) and the `ENEMY_POSES` array + `composeEnemyFrames` with:

```js
// Re-pose a finished creature canvas into one gait frame. Articulates the LEG
// BAND (bottom ~28%) per leg so the forward leg lifts/steps while the other
// plants — real alternating locomotion, not a whole-body nudge. `dx`/`bob`
// translate the whole body; `lean` shears the upper rows (feet planted);
// `legL`/`legR` = {dx,dy} offsets applied only to that half's leg-band pixels;
// `tint` reddens for the hurt flash.
function reposeFrame(base, g = {}) {
  const S = base.w,
    out = canvas(S, S),
    hurt = "#ff5a5a";
  const dx = g.dx || 0,
    bob = g.bob || 0,
    lean = g.lean || 0,
    tint = g.tint || 0;
  const legL = g.legL || { dx: 0, dy: 0 },
    legR = g.legR || { dx: 0, dy: 0 };
  const legTop = S - Math.max(7, Math.round(S * 0.28));
  for (let y = 0; y < S; y++) {
    const sh = Math.round((lean * (S - 1 - y)) / (S - 1)); // more shear up top
    for (let x = 0; x < S; x++) {
      const c = base.d[y * S + x];
      if (!c) continue;
      let nx = x + dx + sh,
        ny = y + bob;
      if (y >= legTop) {
        // leg band: each leg moves on its own
        const leg = x < S / 2 ? legL : legR;
        nx += leg.dx;
        ny += leg.dy;
      }
      set(out, nx, ny, tint ? mix(c, hurt, tint) : c);
    }
  }
  return out;
}

// Eight-frame enemy loop: idle, a 4-key WALK cycle with alternating legs
// (contact-left -> passing -> contact-right -> passing), a wind-up + strike,
// and a hurt recoil. `/walk/` (PreloadScene) spans walk1..walk4 at 7fps.
const ENEMY_POSES = [
  { name: "idle", g: {} },
  { name: "walk1", g: { lean: 1, legL: { dx: 1, dy: -2 }, legR: { dx: -1, dy: 0 } } },
  { name: "walk2", g: { bob: -1, lean: 1, legL: { dx: 0, dy: -1 }, legR: { dx: 0, dy: -1 } } },
  { name: "walk3", g: { lean: -1, legL: { dx: -1, dy: 0 }, legR: { dx: 1, dy: -2 } } },
  { name: "walk4", g: { bob: -1, lean: -1, legL: { dx: 0, dy: -1 }, legR: { dx: 0, dy: -1 } } },
  { name: "atk1", g: { bob: -1, lean: -2 } },
  { name: "atk2", g: { dx: 2, lean: 3 } },
  { name: "hurt", g: { dx: -2, bob: 1, tint: 0.5 } },
];

export function composeEnemyFrames(spec) {
  const base = composeEnemy(spec);
  return {
    names: ENEMY_POSES.map((p) => p.name),
    frames: ENEMY_POSES.map((p) => reposeFrame(base, p.g)),
  };
}
```

Note: `mix()` and `canvas`/`set` are already imported/defined above this block — no new imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/enemy-walk.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/pixelart/creatures.mjs tests/enemy-walk.test.ts
git commit -m "feat: articulated 4-frame enemy walk cycle (real alternating legs)"
```

---

### Task 2: Regenerate enemy sprite sheets + manifest

**Files:**

- Modify (generated): `public/assets/sprites/enemy/*.png`, `public/assets/sprites/enemy/*.json`
- Modify (generated): `src/data/spriteManifest.ts`

- [ ] **Step 1: Regenerate enemy art**

Run: `npx vite-node scripts/svgart/gen.mjs --only=enemy`
Expected: console lines like `enemy grunt 8 frames` for every non-boss enemy (8, not 6).

- [ ] **Step 2: Rebuild the sprite manifest**

Run: `npx vite-node scripts/svgart/gen.mjs --only=manifest`
Expected: `manifest: <N> entries`. Enemy entries now report `"frames":8` with `names` ending `...walk4...`.

- [ ] **Step 3: Verify a manifest enemy entry**

Run: `npx vitest run tests/enemy-walk.test.ts` (still green) and confirm the change is only data:
`git status --short` → modified `src/data/spriteManifest.ts` + `public/assets/sprites/enemy/*`.

- [ ] **Step 4: Commit**

```bash
git add public/assets/sprites/enemy src/data/spriteManifest.ts
git commit -m "feat: regen enemy sprite sheets with 4-frame walk cycle"
```

---

### Task 3: Trim runtime body-bob so the legs read

**Files:**

- Modify: `src/scenes/battleSceneSprites.ts` (`animateEnemy` GROUND branch + shadow lift normalization)

- [ ] **Step 1: Reduce the procedural bob + waddle amplitude**

In `animateEnemy`, the GROUND `else` branch currently reads:

```ts
yOff = -swing * 5 * A; // body lifts clear off the ground between footfalls
xOff = Math.sin(c) * 1.6 * A; // lateral weight-shift waddle as it strides
angle = -Math.cos(c) * 4.5 * A; // waddle rock toward the planted foot
```

Change the three magnitudes (the legs now carry the step, so the body moves less):

```ts
yOff = -swing * 3 * A; // gentle body bob; the stride legs carry the step now
xOff = Math.sin(c) * 1.2 * A; // lateral weight-shift waddle as it strides
angle = -Math.cos(c) * 3.5 * A; // waddle rock toward the planted foot
```

- [ ] **Step 2: Keep the ground-shadow lift normalization consistent with the new bob**

The shadow block computes `lift` by dividing `-yOff` by the old peak `5`. Update the divisor to `3` so a planted foot still maps to `lift≈0` and full lift to `≈1`:

```ts
const lift = Math.max(0, -yOff) / (3 * (boss ? 0.6 : 1)); // 0 planted → 1 airborne
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/battleSceneSprites.ts
git commit -m "feat: soften procedural enemy bob so the new stride legs read"
```

---

### Task 4: Verify whole + playtest

- [ ] **Step 1: Full test suite + build**

Run: `npx vitest run && npx tsc --noEmit && npx vite build`
Expected: all tests pass (incl. new file), tsc clean, build succeeds.

- [ ] **Step 2: Headless playtest screenshot of a battle with enemies walking**

Per `reference_playtest_and_art`: launch `vite preview`, drive `window.__game.scene.start('BattleScene')`, spawn a wave, capture a screenshot to confirm enemies render with the 8-frame sheet (no placeholder shapes, legs visibly mid-stride). Confirm `window.__game.renderer.type` and that enemy sprites are present.

- [ ] **Step 3: Final commit if any playtest tweak needed (else none)**

```bash
git status --short   # expect clean
```

---

## Self-Review

- **Spec coverage:** gait-parameterized composer (Task 1) ✓; 8-pose / 4-walk table (Task 1) ✓; per-body-type non-crash incl. slime/ghost/winged (Task 1 test) ✓; regen art + manifest (Task 2) ✓; runtime bob trim + shadow consistency (Task 3) ✓; verify + playtest (Task 4) ✓.
- **Placeholders:** none — every code step shows complete code.
- **Type consistency:** `reposeFrame(base, g)`, `composeEnemyFrames(spec)`, gait fields (`dx/bob/lean/tint/legL/legR`) used identically across the table and the function. `footY`/`key` test helpers self-contained.
- **Boundary check:** for `grunt` (S=32, cx=16) leg columns stay within their half after ±1px `dx` (left legs `cx-4..cx-2`→`cx-3..cx-1`<16; right legs `cx+1..cx+3`→`cx..cx+2`≥16), so the half-based `footY` asymmetry test is stable.
