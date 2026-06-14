# Stat tooltip always on top — design

**Date:** 2026-06-14
**Status:** Approved (full-auto, self-approved)

## Problem

The item/stat tooltip (`renderItemTooltip`) and the generic info tooltip
(`renderInfoTooltip`) are rendered into persistent scene containers whose depth
is `200` (HeroScene `src/scenes/HeroScene.ts:208`, ShopScene
`src/scenes/ShopScene.ts:117`). Several dialogs and overlays render **above** that
band:

| Surface | Depth |
|---|---|
| Stat tooltip (current) | 200 |
| HeroScene action dialog | 240 |
| autoRecycleDialog / Shop smelt-reforge dialog | 300 |
| wingCraftDialog | 320 |

So when a dialog or a late-added button sits over the tooltip's screen region,
the stat card is occluded — the player can't read the stats they hovered to see.
The reward-panel tooltip already side-steps this with
`tooltip.parentContainer?.bringToTop(tooltip)` (`src/scenes/rewardPanel.ts:277`),
but the two persistent tooltip containers do not, and relying on each call site
to remember the trick is fragile.

## Goal

Every stat/info tooltip is **always drawn above all other UI** (buttons,
dialogs, overlays), regardless of which scene or container shows it, with a
single source of truth so the guarantee can't drift.

## Approach (chosen)

Make "always on top" intrinsic to the render functions instead of a per-call-site
responsibility.

1. **New tiny module `src/scenes/tooltipLayer.ts`** (pure-ish, no Phaser import
   needed beyond a structural type):
   - `export const TOOLTIP_DEPTH = 10_000;` — a fixed ceiling far above every
     dialog/overlay depth in the codebase (max today is 320). Documented as the
     reserved always-on-top layer; nothing else may use it.
   - `export function floatTooltip(c): void` — sets `c.setDepth(TOOLTIP_DEPTH)`
     and, if the container is nested (`c.parentContainer`), calls
     `parentContainer.bringToTop(c)` so it also rises within its parent's local
     z-order (covers the reward-panel nested case). Typed against a minimal
     structural interface so it's unit-testable with a plain stub.

2. **`renderItemTooltip` and `renderInfoTooltip` call `floatTooltip(c)`** right
   before `c.setVisible(true)`. This makes the top-layer guarantee a property of
   *showing a stat tooltip*, not of each caller. Existing call sites (HeroScene,
   ShopScene, rewardPanel) need no change to benefit.

3. **HeroScene + ShopScene** initialise their tooltip container at
   `TOOLTIP_DEPTH` instead of the literal `200`, for consistency and to drop the
   magic number. (rewardPanel keeps its explicit `bringToTop`; now redundant but
   harmless — left as-is to avoid unrelated churn.)

### Alternatives considered

- **Just bump 200 → 999 at the two call sites.** Fixes the symptom but keeps the
  magic numbers, doesn't cover the nested reward-panel case from one place, and
  the next new tooltip surface would have to remember the value. Rejected:
  no single source of truth.
- **Per-call `bringToTop` everywhere.** What rewardPanel does; brittle to
  replicate at every site. Rejected for the same reason.

## Testing

Pure unit test (`tests/tooltipLayer.test.ts`), no Phaser runtime:

- `TOOLTIP_DEPTH` is strictly greater than every dialog/overlay depth currently
  in use (assert `> 320`, with margin) — a regression guard so a future high-depth
  dialog can't silently climb over the tooltip without this test failing.
- `floatTooltip(stub)` calls `setDepth(TOOLTIP_DEPTH)`.
- `floatTooltip` on a **nested** stub (has `parentContainer`) also calls
  `parentContainer.bringToTop(self)`.
- `floatTooltip` on a **top-level** stub (no `parentContainer`) does not throw.

Render-function wiring is covered indirectly: the functions import and call
`floatTooltip`; a light stub-scene test asserting `renderInfoTooltip` bumps the
container depth is added if cheap, otherwise the unit test above plus typecheck
guards the contract.

## Out of scope

- No visual/art change; no `ASSET_VERSION` bump; no deploy.
- No change to tooltip content, positioning, or clamping.
- Not touching FX/sprite depth bands (those are a separate, lower z-space).
