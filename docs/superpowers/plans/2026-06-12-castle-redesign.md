# Castle Visual Redesign (SDXL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat blue-rectangle castle with an SDXL-generated fortress sprite that swaps to a battle-damaged variant at low HP.

**Architecture:** A new `structure` SDXL sprite kind (one id `castle`, two state files) feeds two static images. A pure `castleArt.ts` maps castle HP fraction → state → texture key; `BattleScene` renders a persistent castle `Image`, swaps its texture on state change, and falls back to the legacy rectangle when the texture is absent.

**Tech Stack:** TypeScript (strict ESM, explicit `.ts` specifiers), Phaser 3, Vitest, Node SDXL pipeline (`scripts/sdart/`).

---

### Task 1: Asset-key registry — `structureTex` + castle constants

**Files:**
- Modify: `src/data/assetKeys.ts`
- Test: `tests/assetKeys.test.ts`

- [ ] **Step 1: Add the failing test**

In `tests/assetKeys.test.ts`, add (place near the other `*Tex` shape tests; import the new names into the existing import from `../src/data/assetKeys.ts`):

```ts
import { structureTex, CASTLE_TEX, CASTLE_DAMAGED_TEX } from "../src/data/assetKeys.ts";

describe("structureTex", () => {
  it("derives the structure namespace key", () => {
    expect(structureTex("castle")).toBe("structure__castle");
  });
  it("exposes castle state constants", () => {
    expect(CASTLE_TEX).toBe("structure__castle");
    expect(CASTLE_DAMAGED_TEX).toBe("structure__castle__damaged");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/assetKeys.test.ts -t structureTex`
Expected: FAIL — `structureTex` is not exported.

- [ ] **Step 3: Implement**

Append to `src/data/assetKeys.ts` (after `fxTex`, before the fixed-singleton block):

```ts
/** Battle-world structure sprite (castle, …). */
export const structureTex = (id: string): string => `structure__${id}`;
```

And in the fixed-singleton block at the bottom:

```ts
export const CASTLE_TEX = structureTex("castle");
export const CASTLE_DAMAGED_TEX = structureTex("castle__damaged");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/assetKeys.test.ts -t structureTex`
Expected: PASS.

- [ ] **Step 5: Extend the discipline guard**

In `tests/assetKeyDiscipline.test.ts` find the regex listing the namespaces (currently `/(item|tower|jewel|material|box|skill|menu|fx)__\$\{/`) and add `structure`:

```ts
/(item|tower|jewel|material|box|skill|menu|fx|structure)__\$\{/
```

- [ ] **Step 6: Run the discipline test**

Run: `npx vitest run tests/assetKeyDiscipline.test.ts`
Expected: PASS (only `assetKeys.ts` inlines `structure__${`, which the test exempts).

- [ ] **Step 7: Commit**

```bash
git add src/data/assetKeys.ts tests/assetKeys.test.ts tests/assetKeyDiscipline.test.ts
git commit -m "feat(assets): structureTex registry key + castle constants"
```

---

### Task 2: Pure HP→state module `castleArt.ts`

**Files:**
- Create: `src/scenes/castleArt.ts`
- Test: `tests/castleArt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/castleArt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { castleArtState, castleTexForState } from "../src/scenes/castleArt.ts";
import { CASTLE_TEX, CASTLE_DAMAGED_TEX } from "../src/data/assetKeys.ts";

describe("castleArtState", () => {
  it("is intact above half health", () => {
    expect(castleArtState(15, 15)).toBe("intact");
    expect(castleArtState(8, 15)).toBe("intact"); // 53%
  });
  it("is damaged at or below half health", () => {
    expect(castleArtState(7.5, 15)).toBe("damaged"); // exactly 50%
    expect(castleArtState(7, 15)).toBe("damaged");
    expect(castleArtState(0, 15)).toBe("damaged");
  });
  it("treats negative (rubble) HP as damaged", () => {
    expect(castleArtState(-3, 15)).toBe("damaged");
  });
  it("guards against a zero/negative max (no divide-by-zero)", () => {
    expect(castleArtState(0, 0)).toBe("intact");
    expect(castleArtState(5, -1)).toBe("intact");
  });
});

describe("castleTexForState", () => {
  it("maps states to texture keys", () => {
    expect(castleTexForState("intact")).toBe(CASTLE_TEX);
    expect(castleTexForState("damaged")).toBe(CASTLE_DAMAGED_TEX);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/castleArt.test.ts`
Expected: FAIL — cannot find module `castleArt.ts`.

- [ ] **Step 3: Implement**

Create `src/scenes/castleArt.ts`:

```ts
// Pure, Phaser-free castle HP → art-state mapping. The render layer consumes
// this to decide which structure texture to show; unit-tested in isolation.
import { CASTLE_TEX, CASTLE_DAMAGED_TEX } from "../data/assetKeys.ts";

export type CastleState = "intact" | "damaged";

/** Castle shows its battle-damaged art once it drops to half health or below. */
export function castleArtState(hp: number, maxHp: number): CastleState {
  if (maxHp <= 0) return "intact"; // degenerate guard — no fraction to read
  return hp / maxHp <= 0.5 ? "damaged" : "intact";
}

/** The structure texture key for a given castle state. */
export function castleTexForState(state: CastleState): string {
  return state === "damaged" ? CASTLE_DAMAGED_TEX : CASTLE_TEX;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/castleArt.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/castleArt.ts tests/castleArt.test.ts
git commit -m "feat(castle): pure HP->art-state module (TDD)"
```

---

### Task 3: Battle state — `castleMax`

**Files:**
- Modify: `src/core/battle.ts:76-79` (field decl), `src/core/battle.ts:163-164` (init)
- Test: `tests/castleMax.test.ts` (or fold into an existing battle test if one exists)

- [ ] **Step 1: Write the failing test**

Create `tests/castleMax.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeStage } from "../src/data/stage.ts";
import { BattleState } from "../src/core/battle.ts";

describe("BattleState.castleMax", () => {
  it("captures the stage's starting castle HP and never mutates", () => {
    const stage = makeStage("ch1-s1");
    const b = new BattleState(stage, "Normal");
    expect(b.castleMax).toBe(stage.castleHp);
    b.castleHp = 1;
    expect(b.castleMax).toBe(stage.castleHp);
  });
});
```

> Before running: open `src/core/battle.ts` and `src/data/stage.ts` to confirm the
> exact `BattleState` constructor signature and the stage-factory name. Adjust the
> `new BattleState(...)` args and `makeStage(...)` call to match the real API (the
> constructor takes the stage def and a difficulty; the factory may be named
> `makeStage`/`buildStage`/`stageFor` — use whatever the codebase exports). The
> assertion on `castleMax` is the point of the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/castleMax.test.ts`
Expected: FAIL — `castleMax` is `undefined`.

- [ ] **Step 3: Implement**

In `src/core/battle.ts`, beside `readonly castlePos: Vec2;` (line ~76) add:

```ts
  readonly castleMax: number;
```

In the constructor, immediately after `this.castleHp = stage.castleHp;` (line ~164) add:

```ts
    this.castleMax = stage.castleHp;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/castleMax.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/battle.ts tests/castleMax.test.ts
git commit -m "feat(castle): track castleMax for HP-fraction art swap"
```

---

### Task 4: SDXL generation — `structure` kind

**Files:**
- Modify: `scripts/sdart/prompts.mjs`
- Modify: `scripts/sdart/sdgen.mjs:6-10` (import), `scripts/sdart/sdgen.mjs:56-85` (buildJobs)

No unit test (build-pipeline script). Verified by a dry inspection of the job list.

- [ ] **Step 1: Add the prompt descriptors**

Append to `scripts/sdart/prompts.mjs` (after `BOSS_VISUAL`, before the ITEM section):

```js
// ---- STRUCTURES (battle-world buildings: the player's castle) ----
export const STRUCTURE_VISUAL = {
  castle: "a heroic fantasy stronghold keep, a tall central tower flanked by two smaller turrets, crenellated stone battlements, a grand arched gate, blue conical rooftops, proud blue-and-gold banners, a glowing magical core orb above the gate, three-quarter front view, grounded at the base",
};
// state suffix appended to the base look so both share silhouette/identity
export const STRUCTURE_STATE = {
  intact: "pristine and proud, banners flying high, warm glowing windows, the magical core shining bright",
  damaged: "battle-damaged and besieged, cracked crumbling walls, fallen rubble, torn and burning banners, rising smoke and embers, the magical core dim and flickering",
};
```

- [ ] **Step 2: Wire the import in `sdgen.mjs`**

Modify the import block (lines 6-10) to add the two new exports:

```js
import {
  style, itemStyleFor, skillStyleFor, NEGATIVE, POSE,
  TOWER_VISUAL, ENEMY_VISUAL, BOSS_VISUAL,
  HERO_BASE, HERO_WEAPON,
  STRUCTURE_VISUAL, STRUCTURE_STATE,
} from "./prompts.mjs";
```

- [ ] **Step 3: Emit the jobs in `buildJobs()`**

In `scripts/sdart/sdgen.mjs`, immediately after the `BOSS_VISUAL` loop (line ~72) add:

```js
  for (const [id, v] of Object.entries(STRUCTURE_VISUAL)) {
    const sd = seedOf(id);
    jobs.push({ kind: "structure", id, file: `${id}.png`, prompt: style(`${v}, ${STRUCTURE_STATE.intact}`), seed: sd, w: 768, h: 768, size: 256 });
    jobs.push({ kind: "structure", id, file: `${id}__damaged.png`, prompt: style(`${v}, ${STRUCTURE_STATE.damaged}`), seed: sd, w: 768, h: 768, size: 256 });
  }
```

- [ ] **Step 4: Verify the job list (no network)**

Run a node one-liner that imports `buildJobs` is not exported, so instead grep the diff is correct by dry-printing jobs is unnecessary — instead confirm the script parses:

Run: `node --check scripts/sdart/sdgen.mjs && node --check scripts/sdart/prompts.mjs`
Expected: no output (both parse clean).

- [ ] **Step 5: Commit**

```bash
git add scripts/sdart/prompts.mjs scripts/sdart/sdgen.mjs
git commit -m "feat(art): SDXL structure kind — castle intact + damaged jobs"
```

---

### Task 5: Preload the castle images

**Files:**
- Modify: `src/scenes/PreloadScene.ts:19` (import), `src/scenes/PreloadScene.ts:60-63` (load)

- [ ] **Step 1: Extend the assetKeys import**

On line 19, add `CASTLE_TEX, CASTLE_DAMAGED_TEX` to the existing import from `../data/assetKeys.ts`.

- [ ] **Step 2: Load the two images**

After the hero-doll load (line ~61, `this.load.image(HERODOLL_BASE_TEX, ...)`) add:

```ts
    // Battle-world castle sprite — intact + battle-damaged states (SDXL).
    this.load.image(CASTLE_TEX, "assets/sprites/structure/castle.png");
    this.load.image(CASTLE_DAMAGED_TEX, "assets/sprites/structure/castle__damaged.png");
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (A missing PNG at runtime does not break the build; Phaser degrades to the render fallback.)

- [ ] **Step 4: Commit**

```bash
git add src/scenes/PreloadScene.ts
git commit -m "feat(castle): preload structure castle images"
```

---

### Task 6: Render the castle sprite in `BattleScene`

**Files:**
- Modify: `src/scenes/BattleScene.ts` — import (top), terrain draw (lines 345-348), scene setup (where world objects are added), per-frame update (the render tick that already calls HUD/refresh).

Read `BattleScene.ts` first to locate: (a) the method holding lines 345-348 (the static terrain/castle draw), (b) the `create()`/setup method where persistent game objects are added, and (c) the per-frame method (the one that sets HUD text in `battleSceneRender.ts` is `BattleScene`'s render path). Wire the three edits below into those exact sites.

- [ ] **Step 1: Import the helpers**

Add to the top-of-file imports:

```ts
import { castleArtState, castleTexForState } from "./castleArt.ts";
import { CASTLE_TEX } from "../data/assetKeys.ts";
```

Add a field on the class (near other GameObject fields):

```ts
  private castleSprite?: Phaser.GameObjects.Image;
  private castleState: "intact" | "damaged" = "intact";
```

- [ ] **Step 2: Make the rectangle a fallback only**

Replace the castle block at lines 345-348 with a guard so the rectangle draws ONLY when the SDXL texture is missing:

```ts
    // castle — drawn as a sprite when art exists (see setupCastle); the legacy
    // rectangle is the fallback for a missing texture (pre-art / GPU-less env).
    const c = this.battle.castlePos;
    if (!this.textures.exists(CASTLE_TEX)) {
      g.fillStyle(0x6d8ad0, 1).fillRect(c.x - 24, c.y - 24, 48, 48);
      g.lineStyle(3, 0x9ab0e0, 1).strokeRect(c.x - 24, c.y - 24, 48, 48);
    }
```

- [ ] **Step 3: Add the castle sprite in setup**

In `create()` (after the terrain draw call, so depth ordering is correct), add a setup call and method:

```ts
  /** Persistent castle image (when art exists); sized to read as a fortress. */
  private setupCastle(): void {
    if (!this.textures.exists(CASTLE_TEX)) return;
    const c = this.battle.castlePos;
    this.castleState = castleArtState(this.battle.castleHp, this.battle.castleMax);
    const img = this.add
      .image(c.x, c.y, castleTexForState(this.castleState))
      .setDepth(4);
    const targetW = 110;
    img.setScale(targetW / img.width);
    this.castleSprite = img;
  }
```

Call `this.setupCastle();` from `create()` after the terrain is drawn. (Depth 4 sits above terrain/roads and below units/projectiles — confirm against neighbouring `setDepth` values and nudge if a unit hides behind it.)

- [ ] **Step 4: Swap texture on HP-state change each tick**

In the per-frame render method (the same one that updates the HUD), add:

```ts
    if (this.castleSprite) {
      const state = castleArtState(this.battle.castleHp, this.battle.castleMax);
      if (state !== this.castleState) {
        this.castleState = state;
        this.castleSprite.setTexture(castleTexForState(state));
        const targetW = 110;
        this.castleSprite.setScale(targetW / this.castleSprite.width);
      }
    }
```

- [ ] **Step 5: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass (903+ existing plus the new castle tests).

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(castle): render SDXL castle sprite with damaged-state swap + rect fallback"
```

---

### Task 7: Generate the art (SDXL flow)

**Files:**
- Create (generated): `public/assets/sprites/structure/castle.png`, `…/castle__damaged.png`

- [ ] **Step 1: Run the generator (structure only)**

Run: `npm run gen:sprites -- --only=structure`
Expected: two lines `[1/2] structure/castle.png`, `[2/2] structure/castle__damaged.png`, then `done`.

> If the SD server (`127.0.0.1:8765`) is unreachable, the script logs `gen attempt
> failed` / `SKIP`. That is non-fatal: the wiring is complete and the game renders
> the rectangle fallback. Re-run this one command once the GPU server is up. Do NOT
> hand-fake the PNGs.

- [ ] **Step 2: Confirm the files exist and are PNGs**

Run: `file public/assets/sprites/structure/castle.png public/assets/sprites/structure/castle__damaged.png`
Expected: both report `PNG image data` (skip/return to Step 1 if generation was skipped).

- [ ] **Step 3: Commit the art (only if generated)**

```bash
git add public/assets/sprites/structure/
git commit -m "art(castle): generated SDXL fortress sprite — intact + damaged"
```

---

### Task 8: Verify whole + playtest

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean typecheck, all tests green, successful build.

- [ ] **Step 2: CDP self-playtest**

Launch the dev server, drive into a Chapter 1 battle via `window.__game`, and confirm:
- the castle renders as the fortress sprite (not a blue square) at the lane end;
- after enough leaks drop `castleHp` to ≤50% of `castleMax`, the sprite swaps to the
  damaged art. (Force it if needed by setting `window.__game` battle `castleHp` low.)
Capture a before/after screenshot for the chat.

- [ ] **Step 3: Final state**

Confirm the working tree is clean (`git status`) and summarise what shipped.

---

## Self-Review Notes

- **Spec coverage:** §1 art→Task 4+7; §2 keys→Task 1; §3 pure seam→Task 2; §4
  castleMax→Task 3; §5 render→Task 6; §6 preload→Task 5; §7 generate→Task 7;
  testing→Tasks 1,2,3,8. All covered.
- **Type consistency:** `CastleState` union, `castleArtState`/`castleTexForState`,
  `CASTLE_TEX`/`CASTLE_DAMAGED_TEX`, `castleMax`, `castleSprite`/`castleState` field
  names are used identically across Tasks 1, 2, 3, 6.
- **Fallback invariant:** every code task keeps the game buildable and tests green
  even if Task 7's art never generates (texture-existence guards in Tasks 5 & 6).
