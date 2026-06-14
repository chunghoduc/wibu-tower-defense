# Skill VFX Under Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hero/tower/boss skill-cast VFX render *beneath* the enemy/boss/hero sprites so casts no longer obscure the action.

**Architecture:** Introduce a single `battleDepths.ts` registry of battle world-layer depths with a dedicated `SKILL_FX_UNDER = -6` band that sits below the unit sprites but above the tilemap. Give `FxLayer` a separate `skillDepth` for its two skill-cast subsystems (`SkillVfx`, `BossSkillFx`) while every other effect keeps the normal FX band. A pure ordering invariant is TDD-locked.

**Tech Stack:** TypeScript, Phaser 3, Vitest.

---

### Task 1: Depth registry + ordering invariant (TDD)

**Files:**
- Create: `src/scenes/battleDepths.ts`
- Test: `tests/battleDepths.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/battleDepths.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEPTH, SKILL_FX_MAX_OFFSET } from "../src/scenes/battleDepths.ts";

describe("battle depth registry ordering", () => {
  it("paints skill VFX above the map but below the units", () => {
    // Skill casts must be visible on the battlefield...
    expect(DEPTH.GROUND).toBeLessThan(DEPTH.ROAD);
    expect(DEPTH.ROAD).toBeLessThan(DEPTH.SKILL_FX_UNDER);
    // ...and the ENTIRE skill-VFX band must sit below the enemy/boss sprite.
    expect(DEPTH.SKILL_FX_UNDER + SKILL_FX_MAX_OFFSET).toBeLessThan(DEPTH.ENEMY);
  });

  it("keeps units and normal combat feedback on top of skill VFX", () => {
    expect(DEPTH.ENEMY).toBeLessThan(DEPTH.HERO);
    // Damage numbers / projectiles / loot live at the FX band — must stay readable
    // (at or above the units), unlike the skill-cast band.
    expect(DEPTH.FX).toBeGreaterThanOrEqual(DEPTH.ENEMY);
    expect(DEPTH.SKILL_FX_UNDER).toBeLessThan(DEPTH.FX);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battleDepths.test.ts`
Expected: FAIL — cannot resolve `../src/scenes/battleDepths.ts`.

- [ ] **Step 3: Write minimal implementation**

`src/scenes/battleDepths.ts`:

```ts
// src/scenes/battleDepths.ts
//
// Single source of truth for BATTLE world-layer render depths. Phaser draws
// higher depth on top. Skill-cast VFX (SkillVfx + BossSkillFx) get their own
// SKILL_FX_UNDER band, strictly BELOW the unit sprites, so a cast never hides
// the enemy/boss it lands on — while still painting above the tilemap. All other
// FX (projectiles, melee, impacts, loot, damage numbers) stay at FX, on top of
// the units, where the player can read them.

/** Largest `depth + K` offset any skill-cast subsystem (SkillVfx / SkillElementFx /
 *  skillSignatures / BossSkillFx) adds on top of its base depth. The whole band
 *  [SKILL_FX_UNDER, SKILL_FX_UNDER + SKILL_FX_MAX_OFFSET] must stay below ENEMY. */
export const SKILL_FX_MAX_OFFSET = 6;

export const DEPTH = {
  GROUND: -12, // tilemap ground tiles
  ROAD: -11, // tilemap road tiles
  SKILL_FX_UNDER: -6, // SkillVfx + BossSkillFx base — beneath the units
  ENEMY_SHADOW: 1, // ground-contact shadow
  TERRAIN: 1, // SVG obstacles / decor
  ENEMY: 2, // enemy + boss + tower sprites
  HERO: 3, // hero layered sprite
  CASTLE: 4, // castle sprite
  DYN_GFX: 5, // HP/mana bars, aura rings, upgrade glow
  FX: 6, // projectiles, melee, impacts, loot, damage numbers
  ROLE_BADGE: 6, // tower role emblem
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battleDepths.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleDepths.ts tests/battleDepths.test.ts
git commit -m "feat(battle): depth registry with under-unit skill-VFX band (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Give FxLayer a separate skill-cast depth

**Files:**
- Modify: `src/scenes/fx.ts` (constructor + the two skill subsystem constructions)
- Modify: `src/scenes/BattleScene.ts` (the `new FxLayer(...)` call)

- [ ] **Step 1: Add `skillDepth` to the FxLayer constructor**

In `src/scenes/fx.ts`, import the registry near the other imports:

```ts
import { DEPTH } from "./battleDepths.ts";
```

Change the constructor signature (currently `private readonly depth = 6,` then `layer?`) to add a fourth param **after** `layer`:

```ts
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth = DEPTH.FX,
    layer?: Phaser.GameObjects.Layer,
    /** Base depth for skill-cast VFX (SkillVfx + BossSkillFx) — kept BELOW the unit
     *  sprites so a cast never hides the enemy/boss it lands on. */
    private readonly skillDepth = DEPTH.SKILL_FX_UNDER,
  ) {
```

- [ ] **Step 2: Route the two skill subsystems to `skillDepth`**

Still in `src/scenes/fx.ts`, in the constructor body, change ONLY the `skillVfx` and
`bossFx` constructions to pass `this.skillDepth` (leave `melee`, `impact`, `proj`,
`lootFly` on `this.depth`):

```ts
    this.skillVfx = new SkillVfx(scene, this.fac, this.skillDepth, this.pool);
    this.melee = new MeleeFx(scene, this.fac, this.depth);
    this.impact = new ImpactFx(scene, this.fac, this.depth);
    this.proj = new ProjectileFx(scene, this.fac, this.depth, this.impact, this.pool);
    this.lootFly = new LootFlyFx(scene, this.fac, this.depth);
    this.bossFx = new BossSkillFx(scene, this.fac, this.skillDepth);
```

- [ ] **Step 3: Pass the depths from BattleScene**

In `src/scenes/BattleScene.ts`, find the FX construction (currently
`this.fx = new FxLayer(this, 6, this.world);` around line 237). Import the registry
if not already imported (check the existing import block at the top of the file):

```ts
import { DEPTH } from "./battleDepths.ts";
```

Replace the construction with the explicit depths:

```ts
    this.fx = new FxLayer(this, DEPTH.FX, this.world, DEPTH.SKILL_FX_UNDER);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/fx.ts src/scenes/BattleScene.ts
git commit -m "feat(battle): render skill-cast VFX beneath unit sprites

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Replace the world-layer magic numbers with DEPTH constants

Make the ordering legible in one place by swapping the literals in the files that own
the world-layer sprites for the registry constants. Behaviour-preserving (same numeric
values), so no test should change.

**Files:**
- Modify: `src/scenes/battleTilemap.ts` (GROUND_DEPTH / ROAD_DEPTH consts ~line 24-25)
- Modify: `src/scenes/battleSceneSprites.ts` (enemy shadow `:269` → 1, enemy sprite `:243` → 2, hero `:522` → 3, role badge `:468` → 6)
- Modify: `src/scenes/battleSceneRender.ts` (castle fallback `:483` → 1, castle sprite `:527` → 4)

- [ ] **Step 1: battleTilemap.ts**

At the top of `src/scenes/battleTilemap.ts` add the import:

```ts
import { DEPTH } from "./battleDepths.ts";
```

Change the two local constants (currently `const GROUND_DEPTH = -12;` /
`const ROAD_DEPTH = -11;`) to derive from the registry:

```ts
const GROUND_DEPTH = DEPTH.GROUND;
const ROAD_DEPTH = DEPTH.ROAD;
```

- [ ] **Step 2: battleSceneSprites.ts**

Add the import at the top of `src/scenes/battleSceneSprites.ts`:

```ts
import { DEPTH } from "./battleDepths.ts";
```

Replace the four literals (use the unique surrounding call so each edit is exact):
- enemy shadow ellipse: `.setDepth(1)` → `.setDepth(DEPTH.ENEMY_SHADOW)`
- enemy/tower sprite: `.setDepth(2)` → `.setDepth(DEPTH.ENEMY)`
- role badge image: `.setDepth(6)` → `.setDepth(DEPTH.ROLE_BADGE)`
- hero layered sprite: `.setDepth(3)` → `.setDepth(DEPTH.HERO)`

(If any of these literals is not unique in the file, scope the edit by including the
adjacent code from the inventory line numbers above.)

- [ ] **Step 3: battleSceneRender.ts**

Add the import at the top of `src/scenes/battleSceneRender.ts`:

```ts
import { DEPTH } from "./battleDepths.ts";
```

Replace:
- castle fallback art: `.setDepth(1)` → `.setDepth(DEPTH.TERRAIN)`
- castle sprite: `.setDepth(4)` → `.setDepth(DEPTH.CASTLE)`

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (incl. `tests/battleDepths.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleTilemap.ts src/scenes/battleSceneSprites.ts src/scenes/battleSceneRender.ts
git commit -m "refactor(battle): source world-layer depths from the registry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify whole + live CDP playtest

**Files:**
- Create: `scripts/playtest/repro_skill_under_units.mjs`

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npm run build && npm run lint:cycles`
Expected: tsc clean, all tests pass, build succeeds, 0 runtime cycles. (The
pre-existing unrelated lint error in `repro_achievement_icons.mjs` may remain.)

- [ ] **Step 2: CDP repro proving the depth split**

Create `scripts/playtest/repro_skill_under_units.mjs` that:
1. boots the game (`?debug`), starts a quick battle via `window.__game`,
2. fires a tower/hero `cast` and a `bossCast` FxEvent through the live `FxLayer`
   (or triggers a real cast), then walks the world layer collecting game objects,
3. asserts every object created by `SkillVfx`/`BossSkillFx` has `.depth < DEPTH.ENEMY`
   (i.e. `< 2`) while at least one damage-number/projectile object has `.depth >= 2`,
4. screenshots `/tmp/skill_under_units.png` and prints the min/max skill-VFX depth.

Reuse the CDP harness pattern from `scripts/playtest/repro_wing_icons.mjs` (same
`rpc`/`evalJs`/`shot` scaffolding).

- [ ] **Step 3: Run the repro**

```bash
npm run build && (npx vite preview --port 4188 >/tmp/vite.log 2>&1 &) \
  && (chromium --headless --remote-debugging-port=9222 about:blank >/tmp/chrome.log 2>&1 &) \
  && sleep 3 && node scripts/playtest/repro_skill_under_units.mjs --port=4188
```

Expected: prints skill-VFX depths all `< 2`; non-skill FX `>= 2`; no client errors.
Clean up the vite/chrome processes and `/tmp` artifacts afterward.

- [ ] **Step 4: Commit**

```bash
git add scripts/playtest/repro_skill_under_units.mjs
git commit -m "test(battle): CDP repro for skill VFX under units

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Record memory**

Add a `project_*` memory note (skill-cast VFX render under units via the new
`battleDepths.ts` `SKILL_FX_UNDER` band; FxLayer threads a separate `skillDepth` to
`SkillVfx`+`BossSkillFx` only) and a MEMORY.md pointer line.
```
