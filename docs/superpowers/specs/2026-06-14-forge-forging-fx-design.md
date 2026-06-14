# Forge — per-function signature "forging" effects

**Date:** 2026-06-14
**Status:** Approved (full-auto, self-approved)

## Problem

The redesigned Forge station grid (see `2026-06-14-forge-station-grid-design.md`) lays
every function out as a visual `INPUT → ⚒ → OUTPUT` lane, but a successful craft is
flat: it just toasts text, rebuilds the grid and refreshes the dialog. There is no
moment of payoff — no *forging* happens on screen. The request: **every Forge function
must have its own unique, cool forging effect** so each craft feels distinct and
satisfying.

## Goal

When a craft **succeeds**, play a short, station-specific VFX anchored on the output of
the transformation. Each of the five functions has a visually distinct signature
(different shape, motion, color, glyph), so a player can tell which station fired with
the sound off. No mechanic, balance, schema, economy, or art-asset change; no
ASSET_VERSION bump (effects are procedural Graphics + tweens, no new textures).

## The five signatures

| Station | Kind | Look |
|---|---|---|
| Awakening | `ascension` | A purple→gold pillar of soul-fire erupts upward from the output star; 3–4 star sigils orbit and spiral inward; the output flares brighter (the rank-up). |
| Alchemy | `transmute` | A teal alchemical ring spins in; liquid droplets spiral inward to the center, collapse, then a ring-pulse flips the tint from the input color to the output color. |
| Copy Exchange | `fusion` | Several green "ghost copies" converge from the sides and collapse into the center; a bright crystal flash + an expanding shockwave ring marks the mint. |
| Craft Wings | `featherstorm` (success) / `ashfall` (fail) | Success: violet feathers spiral upward and an arc of light unfurls like a wing-beat. Fail: the feathers scatter and dissolve into drifting grey ash (chaos claimed them). **Wings is the only station with a fail effect**, because its craft is a gamble. |
| Spark Guarantee | `starfall` | A single gold star descends from the top of the lane down a thin beam and lands with a radial burst + a sparkle ring — the guaranteed pull. |

## Architecture (pure-meta → presenter, matches `bossSkillTheme`→`BossFxKit`)

Two new files plus three small wiring seams; no existing crafting logic touched.

### 1. Pure `src/core/forgeFx.ts` (Phaser-free, fully unit-tested)

```ts
export type ForgeFxKind =
  | "ascension" | "transmute" | "fusion" | "featherstorm" | "ashfall" | "starfall";

export interface ForgeFxSpec {
  kind: ForgeFxKind;
  primary: number;   // signature color (hex int)
  accent: number;    // secondary color
  glyph: string;     // particle glyph (✦ ⚗ ◈ 🪶 ★ …)
  particles: number; // count of orbiting/converging/spiral motes
  durationMs: number;// total play time (presenter clamps tweens to this)
  rise: boolean;     // dominant motion is upward (pillar/feathers) vs inward (vortex/fusion)
}

// forgeFxSpec(stationId, success) → ForgeFxSpec
//   "awaken"  → ascension
//   "alchemy" → transmute
//   "copies"  → fusion
//   "wings"   → success ? featherstorm : ashfall
//   "spark"   → starfall
export function forgeFxSpec(station: StationId, success: boolean): ForgeFxSpec;
```

The spec fully determines the look (color/glyph/motion/count/timing); the presenter only
interprets it. This keeps the *uniqueness* in tested pure data, and makes the presenter a
thin, smoke-tested renderer — the same split already used across the codebase.

### 2. Presenter `src/scenes/forgeFxPlayer.ts` (Phaser)

```ts
export function playForgeFx(
  scene: Phaser.Scene, x: number, y: number, spec: ForgeFxSpec, onDone?: () => void,
): void;
```

A single self-cleaning container at depth above the dialog content. A `switch (spec.kind)`
draws each signature with `scene.add.graphics()` + `scene.tweens` + a tiny shared
mote helper (a glyph `Text`/dot tweened along a path). Everything is destroyed when the
longest tween completes, then `onDone?.()` fires. Uses scene tweens (this is a menu
scene, not the fixed-timestep battle sim), so no FxPool/pendingFx plumbing is needed.

### 3. Wiring (in `ForgeScene.ts` + a tiny addition to `forgeRecipeDialog.ts`)

- `forgeRecipeDialog`'s handle gains `outputAnchor(): { x: number; y: number }` — the
  center of the output lane (where the result tile sits). The dialog already computes that
  position; it just exposes it.
- `ForgeScene.craft(stationId, recipeId)`: on a **successful** craft (current `msg`
  branch), before/with the rebuild, call
  `playForgeFx(this, anchor.x, anchor.y, forgeFxSpec(stationId, true))` using the open
  dialog's `outputAnchor()`. The existing toast + rebuild + dialog-refresh stay.
- `ForgeScene.openWingCraft()` confirm: on `r.ok`, play `forgeFxSpec("wings", r.success)`
  (featherstorm on success, ashfall on fail) at the scene center where the machine sits,
  then the existing toast + rebuild.

## Testing

- **Pure unit tests** (`tests/forgeFx.test.ts`): every `StationId` maps to its documented
  kind; `wings` returns `featherstorm` vs `ashfall` by `success`; all specs have a
  positive `durationMs`, `particles ≥ 1` (except `ashfall` may differ), distinct
  `primary` colors across stations, and the `rise` flag matches the table
  (ascension/featherstorm rise, transmute/fusion/starfall do not). Deterministic — no RNG.
- **Presenter**: smoke-covered by a live CDP playtest that fires each station's craft and
  confirms zero runtime exceptions + the effect container is created and self-destroys.

## Out of scope (YAGNI)

- No sound (audio is a separate system; can be added later keyed off `spec.kind`).
- No new textures/sprites — purely procedural, so no art regen and no ASSET_VERSION bump.
- No change to *what* a craft produces or its costs/odds.
- No effect on a *failed* recipe-dialog craft (those are gated to "Cannot forge" before
  the button fires); only Wings, which is a true gamble, gets a fail effect.

## Files

- `src/core/forgeFx.ts` (new, pure)
- `tests/forgeFx.test.ts` (new)
- `src/scenes/forgeFxPlayer.ts` (new, presenter)
- `src/scenes/forgeRecipeDialog.ts` (add `outputAnchor()` to the handle)
- `src/scenes/ForgeScene.ts` (play fx on successful craft / wings outcome)

Related: [[project_forge_station_grid]], [[project_boss_skill_vfx]], [[project_skill_vfx_signatures]].
