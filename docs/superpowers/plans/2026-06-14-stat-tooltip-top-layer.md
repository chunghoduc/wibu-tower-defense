# Stat Tooltip Always-On-Top Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee every stat/info tooltip renders above all other UI (buttons, dialogs, overlays) via one shared depth source.

**Architecture:** A new tiny module `src/scenes/tooltipLayer.ts` exports `TOOLTIP_DEPTH` (a fixed ceiling above all dialog/overlay depths) and `floatTooltip(c)` which bumps a container to that depth and brings it to the top of any parent. `renderItemTooltip`/`renderInfoTooltip` call it on show, so the guarantee is intrinsic to displaying a tooltip rather than per-call-site. HeroScene/ShopScene tooltip containers adopt the constant.

**Tech Stack:** TypeScript, Phaser 3, vitest. Verify: `npm run typecheck`, `npx vitest run`, `npx eslint <files>`, `npm run build`.

---

## File Structure

- **Create** `src/scenes/tooltipLayer.ts` — `TOOLTIP_DEPTH` constant + `floatTooltip()` helper (single source of truth for the always-on-top tooltip layer).
- **Create** `tests/tooltipLayer.test.ts` — pure unit tests for the constant ordering and helper behaviour.
- **Modify** `src/scenes/itemTooltip.ts` — call `floatTooltip(c)` before `c.setVisible(true)`.
- **Modify** `src/scenes/infoTooltip.ts` — call `floatTooltip(c)` before `c.setVisible(true)`.
- **Modify** `src/scenes/HeroScene.ts:208` — init tooltip container at `TOOLTIP_DEPTH`.
- **Modify** `src/scenes/ShopScene.ts:117` — init tooltip container at `TOOLTIP_DEPTH`.

---

### Task 1: tooltipLayer module (TDD)

**Files:**
- Create: `src/scenes/tooltipLayer.ts`
- Test: `tests/tooltipLayer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tooltipLayer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { TOOLTIP_DEPTH, floatTooltip } from "../src/scenes/tooltipLayer.ts";

// Highest dialog/overlay depth currently in the codebase is 320 (wingCraftDialog).
const HIGHEST_OTHER_UI_DEPTH = 320;

describe("tooltipLayer", () => {
  it("reserves a depth strictly above every dialog/overlay layer", () => {
    expect(TOOLTIP_DEPTH).toBeGreaterThan(HIGHEST_OTHER_UI_DEPTH);
    expect(TOOLTIP_DEPTH).toBeGreaterThanOrEqual(1000); // comfortable headroom for future UI
  });

  it("floatTooltip bumps the container to the top layer", () => {
    const c = { setDepth: vi.fn(), parentContainer: null };
    floatTooltip(c);
    expect(c.setDepth).toHaveBeenCalledWith(TOOLTIP_DEPTH);
  });

  it("floatTooltip raises a nested tooltip within its parent too", () => {
    const bringToTop = vi.fn();
    const c = { setDepth: vi.fn(), parentContainer: { bringToTop } };
    floatTooltip(c);
    expect(c.setDepth).toHaveBeenCalledWith(TOOLTIP_DEPTH);
    expect(bringToTop).toHaveBeenCalledWith(c);
  });

  it("floatTooltip is safe on a top-level container (no parent)", () => {
    const c = { setDepth: vi.fn(), parentContainer: null };
    expect(() => floatTooltip(c)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tooltipLayer.test.ts`
Expected: FAIL — cannot resolve `../src/scenes/tooltipLayer.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scenes/tooltipLayer.ts`:

```ts
// src/scenes/tooltipLayer.ts
//
// Single source of truth for the "always on top" tooltip layer. Stat/info
// tooltips (renderItemTooltip / renderInfoTooltip) must draw above every other
// UI element — buttons, dialogs, overlays — so the player can always read the
// stats they hovered to see. The highest dialog/overlay depth in the codebase
// is 320 (wingCraftDialog); TOOLTIP_DEPTH sits far above that with headroom.
// Nothing else may use this depth.

/** Reserved render depth for stat/info tooltips — above all other UI. */
export const TOOLTIP_DEPTH = 10_000;

/** Minimal structural view of a Phaser container, for testability. */
interface FloatableContainer {
  setDepth(value: number): unknown;
  parentContainer?: { bringToTop(child: unknown): unknown } | null;
}

/**
 * Raise a tooltip container to the always-on-top layer. Sets its scene depth to
 * TOOLTIP_DEPTH and, if it is nested inside another container, also brings it to
 * the top of that parent's local z-order (depth only sorts within a parent).
 */
export function floatTooltip(c: FloatableContainer): void {
  c.setDepth(TOOLTIP_DEPTH);
  c.parentContainer?.bringToTop(c);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tooltipLayer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/tooltipLayer.ts tests/tooltipLayer.test.ts
git commit -m "feat(ui): add always-on-top tooltip layer helper"
```

---

### Task 2: Wire render functions + scene containers to the layer

**Files:**
- Modify: `src/scenes/itemTooltip.ts`
- Modify: `src/scenes/infoTooltip.ts`
- Modify: `src/scenes/HeroScene.ts:208`
- Modify: `src/scenes/ShopScene.ts:117`

- [ ] **Step 1: itemTooltip — import and call floatTooltip**

In `src/scenes/itemTooltip.ts`, add to the imports near the top:

```ts
import { floatTooltip } from "./tooltipLayer.ts";
```

Then change the final reveal line (currently `c.setVisible(true);` at end of `renderItemTooltip`):

```ts
  floatTooltip(c); // stat tooltip always renders above other UI
  c.setVisible(true);
```

- [ ] **Step 2: infoTooltip — import and call floatTooltip**

In `src/scenes/infoTooltip.ts`, add to the imports:

```ts
import { floatTooltip } from "./tooltipLayer.ts";
```

Change the final `c.setVisible(true);` in `renderInfoTooltip` to:

```ts
  floatTooltip(c); // info tooltip always renders above other UI
  c.setVisible(true);
```

- [ ] **Step 3: HeroScene — use the constant for the tooltip container**

In `src/scenes/HeroScene.ts`, add the import alongside the other `./` scene imports (near line 10, after `renderItemTooltip`):

```ts
import { TOOLTIP_DEPTH } from "./tooltipLayer.ts";
```

Change line 208 from:

```ts
    this.tooltip = this.add.container(0, 0).setDepth(200).setVisible(false);
```

to:

```ts
    this.tooltip = this.add.container(0, 0).setDepth(TOOLTIP_DEPTH).setVisible(false);
```

- [ ] **Step 4: ShopScene — use the constant for the tooltip container**

In `src/scenes/ShopScene.ts`, add the import alongside the `renderItemTooltip` import (line 27 area):

```ts
import { TOOLTIP_DEPTH } from "./tooltipLayer.ts";
```

Change line 117 from:

```ts
    this.tooltip = this.add.container(0, 0).setDepth(200).setVisible(false);
```

to:

```ts
    this.tooltip = this.add.container(0, 0).setDepth(TOOLTIP_DEPTH).setVisible(false);
```

- [ ] **Step 5: Typecheck + lint + full test suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npx eslint src/scenes/tooltipLayer.ts src/scenes/itemTooltip.ts src/scenes/infoTooltip.ts src/scenes/HeroScene.ts src/scenes/ShopScene.ts`
Expected: clean.

Run: `npx vitest run`
Expected: all pass (existing count + 4 new).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: Vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/itemTooltip.ts src/scenes/infoTooltip.ts src/scenes/HeroScene.ts src/scenes/ShopScene.ts
git commit -m "feat(ui): render stat/info tooltips on the always-on-top layer"
```

---

## Self-Review

- **Spec coverage:** New module + constant (Task 1) ✓; render functions call it (Task 2 steps 1-2) ✓; HeroScene/ShopScene adopt constant (Task 2 steps 3-4) ✓; nested reward-panel case handled by `floatTooltip`'s `bringToTop` (Task 1) ✓; tests for ordering + helper (Task 1) ✓; no art/deploy/ASSET_VERSION (out of scope, untouched) ✓.
- **Placeholder scan:** none — all code shown in full.
- **Type consistency:** `floatTooltip` / `TOOLTIP_DEPTH` names identical across module, tests, and call sites. `FloatableContainer` structural type matches Phaser's `Container` (`setDepth`, `parentContainer.bringToTop`).
- **No deploy:** code-behaviour change only; no asset regen, so no ASSET_VERSION bump and no hosting deploy required.
