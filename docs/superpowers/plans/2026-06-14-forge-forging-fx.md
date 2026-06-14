# Forge Forging Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Forge function its own unique, procedural "forging" effect that plays when a craft succeeds, anchored on the output of the `INPUT → ⚒ → OUTPUT` lane.

**Architecture:** A Phaser-free `forgeFx.ts` maps `(stationId, success)` → a `ForgeFxSpec` (kind + colors + glyph + motion + timing) — the uniqueness lives in tested pure data. A thin presenter `forgeFxPlayer.ts` switches on `spec.kind` and renders each signature with Graphics + scene tweens, self-cleaning when done. `ForgeScene` fires the effect on a successful craft using the dialog's new `outputAnchor()` (Wings at the machine center). Mirrors the existing `bossSkillTheme`→`BossFxKit` pure-meta→presenter split.

**Tech Stack:** TypeScript, Phaser 3, vitest. No new textures (procedural), no ASSET_VERSION bump.

---

### Task 1: Pure `forgeFx.ts` spec mapper (TDD)

**Files:**
- Create: `src/core/forgeFx.ts`
- Test: `tests/forgeFx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { forgeFxSpec, type ForgeFxKind } from "../src/core/forgeFx.ts";
import type { StationId } from "../src/core/forgeStations.ts";

const STATIONS: StationId[] = ["awaken", "alchemy", "copies", "wings", "spark"];

describe("forgeFxSpec", () => {
  test("each station maps to its documented signature kind", () => {
    const kinds: Record<string, ForgeFxKind> = {
      awaken: "ascension",
      alchemy: "transmute",
      copies: "fusion",
      spark: "starfall",
    };
    for (const [station, kind] of Object.entries(kinds)) {
      expect(forgeFxSpec(station as StationId, true).kind).toBe(kind);
    }
  });

  test("wings success vs fail picks featherstorm vs ashfall", () => {
    expect(forgeFxSpec("wings", true).kind).toBe("featherstorm");
    expect(forgeFxSpec("wings", false).kind).toBe("ashfall");
  });

  test("every spec is well-formed (positive duration, >=1 particle, valid colors)", () => {
    for (const s of STATIONS) {
      for (const success of [true, false]) {
        const spec = forgeFxSpec(s, success);
        expect(spec.durationMs).toBeGreaterThan(0);
        expect(spec.particles).toBeGreaterThanOrEqual(1);
        expect(spec.primary).toBeGreaterThanOrEqual(0);
        expect(spec.primary).toBeLessThanOrEqual(0xffffff);
        expect(spec.accent).toBeGreaterThanOrEqual(0);
        expect(spec.accent).toBeLessThanOrEqual(0xffffff);
        expect(typeof spec.glyph).toBe("string");
        expect(spec.glyph.length).toBeGreaterThan(0);
      }
    }
  });

  test("rise flag matches the motion table", () => {
    expect(forgeFxSpec("awaken", true).rise).toBe(true);
    expect(forgeFxSpec("wings", true).rise).toBe(true);
    expect(forgeFxSpec("alchemy", true).rise).toBe(false);
    expect(forgeFxSpec("copies", true).rise).toBe(false);
    expect(forgeFxSpec("spark", true).rise).toBe(false);
  });

  test("primary colors are distinct across the success signatures", () => {
    const cols = STATIONS.map((s) => forgeFxSpec(s, true).primary);
    expect(new Set(cols).size).toBe(cols.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/forgeFx.test.ts`
Expected: FAIL — cannot find module `../src/core/forgeFx.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * forgeFx — pure (Phaser-free) signature spec for the Forge's per-function forging
 * effects. Maps a station (+ success) to a fully-described one-shot VFX so each
 * craft reads distinctly: Awakening erupts a soul-fire pillar, Alchemy swirls a
 * transmute vortex, Copy Exchange fuses ghost copies, Craft Wings flutters feathers
 * (or scatters ash on a failed gamble), Spark drops a guaranteed star. The presenter
 * (forgeFxPlayer.ts) only interprets this — the uniqueness is tested data here.
 * Mirrors the bossSkillTheme → BossFxKit split.
 */
import type { StationId } from "./forgeStations.ts";

export type ForgeFxKind =
  | "ascension"
  | "transmute"
  | "fusion"
  | "featherstorm"
  | "ashfall"
  | "starfall";

export interface ForgeFxSpec {
  kind: ForgeFxKind;
  primary: number; // signature color (hex int)
  accent: number; // secondary color
  glyph: string; // particle glyph
  particles: number; // count of orbiting/converging/spiral motes
  durationMs: number; // total play time
  rise: boolean; // dominant motion is upward vs inward/downward
}

export function forgeFxSpec(station: StationId, success: boolean): ForgeFxSpec {
  switch (station) {
    case "awaken":
      return {
        kind: "ascension",
        primary: 0x9a5cff,
        accent: 0xffe07a,
        glyph: "✦",
        particles: 4,
        durationMs: 900,
        rise: true,
      };
    case "alchemy":
      return {
        kind: "transmute",
        primary: 0x35c7c0,
        accent: 0x9a7bff,
        glyph: "⚗",
        particles: 6,
        durationMs: 850,
        rise: false,
      };
    case "copies":
      return {
        kind: "fusion",
        primary: 0x5fd98a,
        accent: 0xeafff0,
        glyph: "◈",
        particles: 5,
        durationMs: 800,
        rise: false,
      };
    case "wings":
      return success
        ? {
            kind: "featherstorm",
            primary: 0xc77bff,
            accent: 0xfff0ff,
            glyph: "🪶",
            particles: 8,
            durationMs: 1000,
            rise: true,
          }
        : {
            kind: "ashfall",
            primary: 0x6b6b78,
            accent: 0x9a9aa6,
            glyph: "·",
            particles: 7,
            durationMs: 900,
            rise: false,
          };
    case "spark":
      return {
        kind: "starfall",
        primary: 0xffc94d,
        accent: 0xfff6c0,
        glyph: "★",
        particles: 5,
        durationMs: 950,
        rise: false,
      };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/forgeFx.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/forgeFx.ts tests/forgeFx.test.ts
git commit -m "feat(forge): pure per-function forging-fx signature spec

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `forgeFxPlayer.ts` presenter

**Files:**
- Create: `src/scenes/forgeFxPlayer.ts`

No unit test (Phaser presenter — smoke-covered by the Task 4 live playtest). The presenter
must compile under tsc and be a pure visual layer (no game-state mutation).

- [ ] **Step 1: Write the presenter**

```ts
/**
 * forgeFxPlayer — renders the Forge's per-function forging effects. Reads a pure
 * ForgeFxSpec (forgeFx.ts) and plays the matching signature at a point with Graphics
 * + scene tweens, then destroys itself. Menu-scene tweens (not the battle fixed-step
 * sim), so no FxPool/pendingFx plumbing. One container per call; nothing persists.
 */
import type Phaser from "phaser";
import type { ForgeFxSpec } from "../core/forgeFx.ts";

const DEPTH = 360; // above the forge dialog (320) + its content

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

/** A glyph mote tweened from (sx,sy) to (ex,ey); auto-destroyed at the end. */
function mote(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  glyph: string,
  color: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  size: number,
  delay: number,
  duration: number,
): void {
  const t = scene.add
    .text(sx, sy, glyph, { fontFamily: "sans-serif", fontSize: `${size}px`, color: hex(color) })
    .setOrigin(0.5)
    .setAlpha(0);
  parent.add(t);
  scene.tweens.add({
    targets: t,
    x: ex,
    y: ey,
    alpha: { from: 0.95, to: 0 },
    scale: { from: 1, to: 0.4 },
    delay,
    duration,
    ease: "Cubic.easeOut",
  });
}

/** Expanding stroked ring that fades out. */
function ring(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
  r0: number,
  r1: number,
  duration: number,
  delay = 0,
): void {
  const g = scene.add.graphics().setPosition(x, y);
  parent.add(g);
  const state = { r: r0, a: 0.9 };
  scene.tweens.add({
    targets: state,
    r: r1,
    a: 0,
    delay,
    duration,
    ease: "Quad.easeOut",
    onUpdate: () => {
      g.clear();
      g.lineStyle(3, color, state.a).strokeCircle(0, 0, state.r);
    },
  });
}

/** Vertical beam/pillar that grows then fades. */
function pillar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
  height: number,
  duration: number,
): void {
  const g = scene.add.graphics().setPosition(x, y);
  parent.add(g);
  const state = { h: 0, a: 0.85 };
  scene.tweens.add({
    targets: state,
    h: height,
    duration: duration * 0.45,
    ease: "Quad.easeOut",
    yoyo: false,
    onUpdate: () => {
      g.clear();
      g.fillStyle(color, state.a).fillRect(-7, -state.h, 14, state.h);
      g.fillStyle(0xffffff, state.a * 0.5).fillRect(-2, -state.h, 4, state.h);
    },
    onComplete: () => {
      scene.tweens.add({
        targets: state,
        a: 0,
        duration: duration * 0.55,
        onUpdate: () => {
          g.clear();
          g.fillStyle(color, state.a).fillRect(-7, -state.h, 14, state.h);
        },
      });
    },
  });
}

export function playForgeFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  spec: ForgeFxSpec,
  onDone?: () => void,
): void {
  const c = scene.add.container(0, 0).setDepth(DEPTH);
  const D = spec.durationMs;
  const N = spec.particles;
  const TAU = Math.PI * 2;

  // A central flash common to every signature (the "strike").
  const flash = scene.add
    .circle(x, y, 26, spec.accent, 0.9)
    .setBlendMode(Phaser.BlendModes.ADD);
  c.add(flash);
  scene.tweens.add({ targets: flash, scale: { from: 0.3, to: 1.6 }, alpha: 0, duration: D * 0.4 });

  switch (spec.kind) {
    case "ascension": {
      pillar(scene, c, x, y, spec.primary, 120, D);
      ring(scene, c, x, y, spec.accent, 16, 60, D * 0.7);
      // Star sigils orbit then spiral inward.
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU;
        const r = 52;
        mote(scene, c, spec.glyph, spec.accent, x + Math.cos(ang) * r, y + Math.sin(ang) * r - 10, x, y - 70, 20, i * 50, D - 100);
      }
      break;
    }
    case "transmute": {
      ring(scene, c, x, y, spec.primary, 50, 8, D * 0.8); // ring spins inward
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU;
        const r = 60;
        mote(scene, c, spec.glyph, i % 2 ? spec.primary : spec.accent, x + Math.cos(ang) * r, y + Math.sin(ang) * r, x, y, 16, i * 40, D * 0.7);
      }
      ring(scene, c, x, y, spec.accent, 6, 54, D * 0.5, D * 0.5); // color-flip pulse out
      break;
    }
    case "fusion": {
      // Ghost copies converge from the sides, then a crystal flash + shockwave.
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        const sx = x + side * (70 + (i % 3) * 18);
        const sy = y + ((i % 2) - 0.5) * 30;
        mote(scene, c, spec.glyph, spec.primary, sx, sy, x, y, 18, i * 30, D * 0.55);
      }
      ring(scene, c, x, y, spec.accent, 10, 70, D * 0.5, D * 0.5);
      break;
    }
    case "featherstorm": {
      // Feathers spiral upward; a wing-arc of light unfurls.
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        const ang = (i / N) * TAU;
        mote(scene, c, spec.glyph, i % 3 ? spec.primary : spec.accent, x + Math.cos(ang) * 24, y + 14, x + side * (40 + i * 6), y - 70 - i * 4, 18, i * 45, D - 120);
      }
      ring(scene, c, x, y - 10, spec.accent, 14, 64, D * 0.6);
      break;
    }
    case "ashfall": {
      // Feathers scatter and drift down into grey ash.
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        mote(scene, c, spec.glyph, spec.primary, x, y - 10, x + side * (30 + i * 10), y + 50 + i * 6, 16, i * 40, D - 60);
      }
      ring(scene, c, x, y, spec.accent, 30, 4, D * 0.5); // collapse inward (dud)
      break;
    }
    case "starfall": {
      // A single guaranteed star descends a beam, lands, bursts.
      const beam = scene.add.graphics();
      c.add(beam);
      const bs = { a: 0.0 };
      scene.tweens.add({
        targets: bs,
        a: 0.7,
        duration: D * 0.35,
        yoyo: true,
        onUpdate: () => {
          beam.clear();
          beam.fillStyle(spec.accent, bs.a * 0.5).fillRect(x - 4, y - 150, 8, 150);
        },
      });
      mote(scene, c, spec.glyph, spec.primary, x, y - 150, x, y, 28, 0, D * 0.45);
      ring(scene, c, x, y, spec.accent, 8, 70, D * 0.5, D * 0.45);
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU;
        mote(scene, c, "✦", spec.accent, x, y, x + Math.cos(ang) * 60, y + Math.sin(ang) * 60, 14, D * 0.45 + i * 20, D * 0.4);
      }
      break;
    }
  }

  scene.time.delayedCall(D + 120, () => {
    c.destroy();
    onDone?.();
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/forgeFxPlayer.ts
git commit -m "feat(forge): forgeFxPlayer presenter (6 signature renderers)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Expose `outputAnchor()` on the forge dialog handle

**Files:**
- Modify: `src/scenes/forgeRecipeDialog.ts`

The dialog already computes the output lane position from `laneY` and `outStartX`. We hoist
those into closure scope (they're currently locals inside `render()`) and expose them via the
handle so the scene can anchor the effect on the result tile.

- [ ] **Step 1: Add `outputAnchor` to the handle interface**

In the `ForgeDialogHandle` interface (top of file), add a third member:

```ts
export interface ForgeDialogHandle {
  refresh(station: StationVM): void;
  close(): void;
  /** Center of the output lane (the result tile) — anchor for forging VFX. */
  outputAnchor(): { x: number; y: number };
}
```

- [ ] **Step 2: Track the last-rendered output anchor in closure scope**

Just below `let sel = 0;` (before `function render()`), add:

```ts
  // Last-rendered output lane center, for the scene to anchor forging VFX on.
  let lastAnchor = { x: px + PANEL_W - 70, y: py + 150 };
```

Inside `render()`, right after the line that computes `const outStartX = ...`, add:

```ts
    lastAnchor = {
      x: outStartX + ((outputs.length - 1) * 70) / 2,
      y: laneY,
    };
```

- [ ] **Step 3: Return `outputAnchor` from the handle**

Change the returned object at the end of `openForgeDialog` from:

```ts
  return {
    refresh(next: StationVM): void {
      station = next;
      sel = Math.min(sel, Math.max(0, next.recipes.length - 1));
      render();
    },
    close,
  };
```

to:

```ts
  return {
    refresh(next: StationVM): void {
      station = next;
      sel = Math.min(sel, Math.max(0, next.recipes.length - 1));
      render();
    },
    close,
    outputAnchor: () => ({ ...lastAnchor }),
  };
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/forgeRecipeDialog.ts
git commit -m "feat(forge): expose output-lane anchor on the dialog handle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Fire the effect on a successful craft in `ForgeScene`

**Files:**
- Modify: `src/scenes/ForgeScene.ts`

- [ ] **Step 1: Import the player + spec**

Add near the other scene imports (after the `forgeRecipeDialog` import):

```ts
import { playForgeFx } from "./forgeFxPlayer.ts";
import { forgeFxSpec } from "../core/forgeFx.ts";
```

- [ ] **Step 2: Play the effect in `craft()` before the rebuild**

In `craft(stationId, recipeId)`, the success path currently is:

```ts
    if (!msg) {
      this.showToast("Cannot forge — check materials.");
      return;
    }
    this.showToast(msg);
    this.rebuild();
```

Capture the anchor from the open dialog BEFORE rebuild (rebuild does not touch the dialog,
but capture first for clarity), and play the effect. Replace the block above with:

```ts
    if (!msg) {
      this.showToast("Cannot forge — check materials.");
      return;
    }
    const anchor = this.dialog?.outputAnchor() ?? { x: W / 2, y: 270 };
    playForgeFx(this, anchor.x, anchor.y, forgeFxSpec(stationId, true));
    this.showToast(msg);
    this.rebuild();
```

- [ ] **Step 3: Play the wings effect on its craft outcome**

In `openWingCraft()`, the confirm callback currently is:

```ts
      confirm: (selectedIds, j) => {
        const r = this.mgr.craftWings(selectedIds, j);
        if (!r.ok) {
          this.showToast("Craft failed — check materials.");
          return;
        }
        if (r.success && r.item) {
          this.showToast(`✦ Forged ${ITEM_CATALOG_MAP.get(r.item.defId)?.name ?? "Wings"}!`);
        } else {
          this.showToast("The wings dissolved into chaos…");
        }
        dialog.destroy();
        this.rebuild();
      },
```

Replace it with (plays featherstorm on success, ashfall on fail, at the machine center):

```ts
      confirm: (selectedIds, j) => {
        const r = this.mgr.craftWings(selectedIds, j);
        if (!r.ok) {
          this.showToast("Craft failed — check materials.");
          return;
        }
        playForgeFx(this, W / 2, this.scale.height / 2, forgeFxSpec("wings", r.success));
        if (r.success && r.item) {
          this.showToast(`✦ Forged ${ITEM_CATALOG_MAP.get(r.item.defId)?.name ?? "Wings"}!`);
        } else {
          this.showToast("The wings dissolved into chaos…");
        }
        dialog.destroy();
        this.rebuild();
      },
```

- [ ] **Step 4: Typecheck + full suite + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all tests pass (forgeFx adds 5), build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ForgeScene.ts
git commit -m "feat(forge): play per-function forging effect on successful craft

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Lint, live playtest, memory

**Files:**
- Modify: `memory/project_forge_station_grid.md` (append the fx layer) + `memory/MEMORY.md` if a new line is warranted

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: 0 errors (pre-existing `any` warnings only). If `forgeFxPlayer.ts` trips `max-lines`,
split a renderer helper out into the same file's helpers (it is well under 500 lines as written).

- [ ] **Step 2: Live CDP playtest**

Start vite + headless Chrome (background), open `/?debug`, jump to `ForgeScene`, and for each
station open the dialog and invoke a craft (granting materials where needed via the SaveManager
on `window.__game.registry.get("saveManager")`), capturing a screenshot mid-effect and asserting
zero `Runtime.exceptionThrown`. Confirm a `forgeFxPlayer` container is created and is gone after
`durationMs + 120ms`. Reuse the `/tmp/cap_forge.mjs` harness pattern.

Expected: each craft plays its signature effect; 0 runtime exceptions.

- [ ] **Step 3: Record memory**

Append a short paragraph to `memory/project_forge_station_grid.md` noting the forging-fx layer:
pure `forgeFx.ts` (`forgeFxSpec(station,success)` → `ForgeFxSpec`, 6 kinds, wings is the only
fail effect) + presenter `forgeFxPlayer.ts` (`playForgeFx`, self-cleaning), fired from
`ForgeScene.craft`/`openWingCraft` on success, anchored via the dialog's new `outputAnchor()`.
No art/ASSET_VERSION change. Link `[[project_boss_skill_vfx]]`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "docs(forge): record forging-fx layer in memory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** Task 1 covers the 5 signatures + the kind/color/glyph/motion data and the wings success/fail split (`forgeFxSpec`). Task 2 renders all 6 kinds. Task 3+4 wire the trigger on successful craft (recipe stations) + wings outcome — the spec's "play on success, anchored on output" + "wings is the only fail effect." Testing section → Task 1 unit tests + Task 5 playtest. No-art/no-bump honored (procedural only). All spec sections map to a task.
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** `ForgeFxKind`/`ForgeFxSpec`/`forgeFxSpec` identical across Tasks 1, 2, 4. `StationId` imported from `forgeStations.ts` (existing export). `ForgeDialogHandle.outputAnchor` defined in Task 3 and consumed in Task 4. `playForgeFx(scene,x,y,spec,onDone?)` signature consistent between Task 2 and Task 4.
