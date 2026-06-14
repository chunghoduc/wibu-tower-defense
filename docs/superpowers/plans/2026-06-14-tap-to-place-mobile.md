# Tap-to-place mobile select feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "select a build-bar card → tap the map to place" a clear, discoverable mobile gesture by adding selected-card highlight, an on-field ghost preview, and an instruction/cancel hint — without changing placement math or the drag path.

**Architecture:** A new pure, Phaser-free module `core/placementHud.ts` decides per-frame tile visuals (alpha/scale/selected), the ghost anchor world-point, and the hint string. The presenter lives in the existing `scenes/battleScenePlacement.ts` (a new `refreshArmedBar()` method + `ghostAnchor` use in `toggleArm`). `BattleScene.refreshBuildBar()` (run every frame from `draw()`) delegates the armed pass with one added line.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure logic in `src/core`, thin presenter merged onto the BattleScene prototype via declaration merging.

---

## File Structure

- **Create** `src/core/placementHud.ts` — pure: `armedTileVisual`, `ghostAnchor`, `armHintText`, `BUILD_BAR_TOP`.
- **Create** `tests/placementHud.test.ts` — unit tests for the above.
- **Modify** `src/scenes/battleScenePlacement.ts` — add `refreshArmedBar()` + hint banner lifecycle; use `ghostAnchor` in `toggleArm`.
- **Modify** `src/scenes/BattleScene.ts:496` (`refreshBuildBar`) — delegate the armed pass (≈1 line).
- **Modify** `src/scenes/battleSceneInput.ts` (only if needed) — none planned; cancel-via-hint is wired in the presenter.

---

### Task 1: Pure placementHud module (TDD)

**Files:**
- Create: `src/core/placementHud.ts`
- Test: `tests/placementHud.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/placementHud.test.ts
import { describe, it, expect } from "vitest";
import {
  armedTileVisual,
  ghostAnchor,
  armHintText,
  BUILD_BAR_TOP,
} from "../src/core/placementHud.ts";

describe("armedTileVisual", () => {
  it("the armed tile lifts, brightens, and is selected", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: true, affordable: true })).toEqual({
      alpha: 1,
      scale: 1.12,
      selected: true,
    });
  });

  it("an unaffordable armed tile still highlights (you may earn gold)", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: true, affordable: false })).toEqual({
      alpha: 1,
      scale: 1.12,
      selected: true,
    });
  });

  it("other affordable cards dim while one is armed", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: false, affordable: true })).toEqual({
      alpha: 0.6,
      scale: 1,
      selected: false,
    });
  });

  it("other unaffordable cards stay at the unaffordable dim", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: false, affordable: false })).toEqual({
      alpha: 0.45,
      scale: 1,
      selected: false,
    });
  });

  it("nothing armed: affordable full, unaffordable dim, never selected", () => {
    expect(armedTileVisual({ anyArmed: false, isArmedTile: false, affordable: true })).toEqual({
      alpha: 1,
      scale: 1,
      selected: false,
    });
    expect(armedTileVisual({ anyArmed: false, isArmedTile: false, affordable: false })).toEqual({
      alpha: 0.45,
      scale: 1,
      selected: false,
    });
  });
});

describe("ghostAnchor", () => {
  const camCenter = { x: 640, y: 360 };
  it("a pointer inside the build-bar strip anchors the ghost at camera center", () => {
    expect(
      ghostAnchor({ pointerScreenY: BUILD_BAR_TOP, pointerWorld: { x: 10, y: 999 }, camCenter }),
    ).toEqual(camCenter);
    expect(
      ghostAnchor({ pointerScreenY: 520, pointerWorld: { x: 10, y: 999 }, camCenter }),
    ).toEqual(camCenter);
  });
  it("a pointer over the field follows the real pointer world-point", () => {
    expect(
      ghostAnchor({ pointerScreenY: 300, pointerWorld: { x: 123, y: 200 }, camCenter }),
    ).toEqual({ x: 123, y: 200 });
  });
});

describe("armHintText", () => {
  it("is empty when nothing is armed", () => {
    expect(armHintText(null)).toBe("");
  });
  it("names the armed tower and tells the player to tap the map", () => {
    const t = armHintText("Vance the Drifter");
    expect(t).toContain("Vance the Drifter");
    expect(t.toLowerCase()).toContain("tap the map");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/placementHud.test.ts`
Expected: FAIL — cannot resolve `../src/core/placementHud.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/placementHud.ts
//
// Pure presentation logic for the "tap-to-place" mobile flow: how a build-bar
// card looks when a tower is armed, where the placement ghost should preview,
// and the instruction text. No Phaser, no DOM — the BattleScene presenter reads
// these and applies them. Keeps the select/hint rules unit-testable.

import type { Vec2 } from "../data/schema.ts";

/** Screen-y where the bottom build-bar strip begins (mirrors bindInput's y>=500). */
export const BUILD_BAR_TOP = 500;

export interface TileVisual {
  alpha: number;
  scale: number;
  selected: boolean;
}

/** Per-frame visual for one build-bar card given the armed/affordable state. */
export function armedTileVisual(o: {
  anyArmed: boolean;
  isArmedTile: boolean;
  affordable: boolean;
}): TileVisual {
  if (o.isArmedTile) return { alpha: 1, scale: 1.12, selected: true };
  if (!o.affordable) return { alpha: 0.45, scale: 1, selected: false };
  return { alpha: o.anyArmed ? 0.6 : 1, scale: 1, selected: false };
}

/**
 * World-point to anchor the placement ghost when arming. On touch the active
 * pointer is still on the just-tapped card (inside the build-bar strip), which
 * would park a red "blocked" ghost on the bar; in that case preview at the
 * camera-view center instead. On a desktop hover the pointer is over the field,
 * so follow it.
 */
export function ghostAnchor(o: {
  pointerScreenY: number;
  pointerWorld: Vec2;
  camCenter: Vec2;
}): Vec2 {
  return o.pointerScreenY >= BUILD_BAR_TOP ? o.camCenter : o.pointerWorld;
}

/** Instruction shown while a card is armed (empty string when nothing is armed). */
export function armHintText(name: string | null): string {
  return name ? `Tap the map to place ${name}  ·  tap card to cancel` : "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/placementHud.test.ts`
Expected: PASS (12 assertions across 3 describes).

- [ ] **Step 5: Commit**

```bash
git add src/core/placementHud.ts tests/placementHud.test.ts
git commit -m "feat(placement): pure placementHud (tile visual, ghost anchor, hint) (TDD)"
```

---

### Task 2: Wire selection highlight + hint + ghost park into the presenter

**Files:**
- Modify: `src/scenes/battleScenePlacement.ts`
- Modify: `src/scenes/BattleScene.ts:496` (`refreshBuildBar`)

- [ ] **Step 1: Park the ghost on the field when arming (touch fix)**

In `battleScenePlacement.ts`, add the import:

```ts
import { armedTileVisual, ghostAnchor, armHintText } from "../core/placementHud.ts";
```

Replace the body of `toggleArm` so the initial preview uses `ghostAnchor` instead of
the raw active pointer:

```ts
  /** Toggle a build-bar card armed for tap-to-place; shows/clears its ghost. */
  toggleArm(this: BattleScene, id: string): void {
    if (this.battle.outcome !== "ongoing") return;
    this.placement = armPlacement(this.placement, id);
    if (isArmed(this.placement)) {
      this.makeGhost(id);
      const p = this.input.activePointer;
      const cam = this.cameras.main;
      const c = cam.worldView;
      const anchor = ghostAnchor({
        pointerScreenY: p ? p.y : this.scale.height,
        pointerWorld: p ? cam.getWorldPoint(p.x, p.y) : { x: c.centerX, y: c.centerY },
        camCenter: { x: c.centerX, y: c.centerY },
      });
      this.ghostAt(id, anchor);
    } else {
      this.clearGhost();
    }
  },
```

- [ ] **Step 2: Add a `ghostAt(id, world)` helper and route `updateGhost` through it**

Still in `battleScenePlacement.ts`, replace `updateGhost` with a thin wrapper over a
new world-point variant so both pointer-tracking and parking share one code path:

```ts
  updateGhost(this: BattleScene, towerId: string, pointer: Phaser.Input.Pointer): void {
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.ghostAt(towerId, { x: wp.x, y: wp.y }, pointer.y);
  },

  /** Draw the ghost at a world-point. `screenY` (default on-field) gates the bar. */
  ghostAt(this: BattleScene, towerId: string, world: Vec2, screenY = 0): void {
    if (!this.placeGhost) return;
    this.placeGhost.setPosition(world.x, world.y);
    const def = this.buildOrder.find((d) => d.id === towerId);
    const ok =
      screenY < 500 &&
      this.battle.canPlaceAt(world) &&
      !!def &&
      this.battle.gold >= def.cost;
    const range = def ? this.battle.previewPlaceRange(def.id) : 130;
    const ring = this.placeGhost.getData("ring") as Phaser.GameObjects.Graphics;
    ring.clear();
    ring.lineStyle(1.5, ok ? 0x66ff88 : 0xff5a5a, 0.4).strokeCircle(0, 0, range);
    ring.fillStyle(ok ? 0x66ff88 : 0xff5a5a, 0.06).fillCircle(0, 0, range);
    ring.lineStyle(2, ok ? 0x66ff88 : 0xff5a5a, 0.95).strokeCircle(0, 0, 16);
  },
```

Add `Vec2` to the imports at the top of `battleScenePlacement.ts`:

```ts
import type { Vec2 } from "../data/schema.ts";
```

- [ ] **Step 3: Add `refreshArmedBar()` (per-frame highlight + hint)**

Append to the `placementMethods` object in `battleScenePlacement.ts`:

```ts
  /**
   * Per-frame: reflect the armed/affordable state on every build-bar card
   * (lift + accent the armed one, dim the rest) and show/hide the arm hint.
   * Called from refreshBuildBar so the highlight always matches placement state.
   */
  refreshArmedBar(this: BattleScene): void {
    const armedId = this.placement.armedId;
    for (const c of this.avatarTiles) {
      const id = c.getData("towerId") as string;
      const def = this.buildOrder.find((d) => d.id === id);
      const v = armedTileVisual({
        anyArmed: armedId !== null,
        isArmedTile: id === armedId,
        affordable: !!def && this.battle.gold >= def.cost,
      });
      c.setAlpha(v.alpha);
      c.setScale(v.scale);
      let hl = c.getData("selGlow") as Phaser.GameObjects.Graphics | undefined;
      if (v.selected && !hl) {
        hl = this.add.graphics();
        hl.lineStyle(2.5, 0xffe27a, 1).strokeRoundedRect(-35, -22, 70, 56, 8);
        c.addAt(hl, 0);
        c.setData("selGlow", hl);
      } else if (!v.selected && hl) {
        hl.destroy();
        c.setData("selGlow", undefined);
      }
    }
    const name = armedId ? (this.buildOrder.find((d) => d.id === armedId)?.name ?? null) : null;
    this.updateArmHint(armHintText(name));
  },

  /** Lazily build / show / hide the single reused arm-hint banner. */
  updateArmHint(this: BattleScene, text: string): void {
    if (!text) {
      this.armHint?.setVisible(false);
      return;
    }
    if (!this.armHint) {
      this.armHint = crispText(this, this.scale.width / 2, 478, "", {
        fontSize: "13px",
        color: "#ffe27a",
        backgroundColor: "#1a2230cc",
        fontStyle: "bold",
        align: "center",
      })
        .setOrigin(0.5, 1)
        .setPadding(8, 4, 8, 4)
        .setDepth(46)
        .setInteractive({ useHandCursor: true });
      this.armHint.on("pointerup", () => this.cancelPlacement());
      this.ui.add(this.armHint);
    }
    this.armHint.setText(text).setVisible(true);
  },
```

Add the `crispText` import to `battleScenePlacement.ts`:

```ts
import { crispText } from "./ui.ts";
```

- [ ] **Step 4: Declare the new fields/methods on BattleScene**

In `BattleScene.ts`, find the `placeGhost` field declaration and add next to it:

```ts
  armHint?: Phaser.GameObjects.Text;
```

The merged-method interface for `PlacementMethods` already picks up `refreshArmedBar`,
`updateArmHint`, and `ghostAt` automatically (they're added to `placementMethods`,
whose `typeof` is the merged interface). No extra interface lines needed.

- [ ] **Step 5: Delegate from `refreshBuildBar`**

In `BattleScene.ts`, replace the `refreshBuildBar` body (currently the affordability
loop) with a single delegation so all build-bar visuals live in one place:

```ts
  refreshBuildBar(): void {
    this.refreshArmedBar();
  }
```

- [ ] **Step 6: Typecheck + run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no TS errors; all tests pass (including `placementHud`).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/battleScenePlacement.ts src/scenes/BattleScene.ts
git commit -m "feat(placement): mobile select highlight + arm hint + on-field ghost park"
```

---

### Task 3: Verify whole + playtest + docs

**Files:** none (verification only)

- [ ] **Step 1: Lint + line-count guard**

Run: `npx eslint src/core/placementHud.ts src/scenes/battleScenePlacement.ts src/scenes/BattleScene.ts`
Expected: no `max-lines` error; clean.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Live playtest (CDP via `window.__game`)**

Start the dev server, open the battle, and confirm: tapping a card lifts + accents it
and dims the others; the hint banner appears above the build bar; the ghost previews on
the field (green ring on a valid spot); tapping a valid spot places the tower and clears
the highlight/hint; re-tapping the card and tapping the hint both cancel.

- [ ] **Step 4: Final commit (docs/plan checkboxes if updated)**

```bash
git add -A
git commit -m "docs(placement): mark tap-to-place mobile plan complete" || true
```

---

## Self-Review

- **Spec coverage:** §1 selected-card highlight → Task 2 Step 3 (`refreshArmedBar` +
  `armedTileVisual`). §2 on-field ghost preview → Task 2 Steps 1–2 (`ghostAnchor` +
  `ghostAt`). §3 hint banner + tap-to-cancel → Task 2 Step 3 (`updateArmHint`, hint
  `pointerup` → `cancelPlacement`). Pure tests → Task 1. All spec sections mapped.
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** `armedTileVisual`/`ghostAnchor`/`armHintText`/`BUILD_BAR_TOP`
  signatures match between Task 1 definition and Task 2 use; `ghostAt(id, world, screenY?)`
  defined and called consistently; `armHint` field declared in Task 2 Step 4.
