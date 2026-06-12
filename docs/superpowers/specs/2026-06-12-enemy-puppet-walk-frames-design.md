# Lively Enemies — Procedural Puppet-Walk Frames (warp the SDXL sprite)

**Date:** 2026-06-12
**Status:** Approved (full-auto session — author is the approver)
**Builds on / refines:** `2026-06-12-enemy-art-sdxl-procedural-walk-design.md`
(keeps its single clean SDXL base sprite; replaces "whole-body bob only" with
real silhouette-changing motion).

## Problem

The owner reports enemies "are still floating on screen" and asks to "generate
more art and frames to make the enemies look more lively (walking / flying /
running) — even 4 or 5 frames for a walk cycle."

Ground truth from the codebase + two prior reverted attempts:

1. **Diffusion-authored frames don't work.** A z-image animation sheet yields
   recognizable poses but at variable scale, with overlap, and **no controlled
   walk order**; the slicer never produces a clean `walk1..walkN` loop
   (`sliceanim.py` even names frames `idle/atk/skill` — boss `walk` names were
   hand-assigned). Reverted in commit `95c3c5d`.
2. **SVG/pixel articulation worked mechanically but clashed** with the polished
   z-image art style. Also reverted.
3. The **current** state — one clean SDXL frame + `enemyWalkTransform` whole-body
   bob/squash/rock — still "floats" because **the silhouette never changes**:
   bob/squash/rock only translate, scale and rotate the center of mass. A picture
   that keeps its exact outline while sliding along a lane reads as floating no
   matter how much it bobs.

**The real fix for floating is silhouette change** — feet/legs (or wings) that
visibly move _relative to the body_. Phaser `Sprite` supports only
position/rotation/scale, so silhouette change requires either a mesh or **multiple
texture frames**. The user explicitly wants frames.

## Key insight — real frames without diffusion

We already have one **clean, on-style** SDXL sprite per enemy. We can synthesize a
short walk cycle from it by **warping** that sprite, instead of asking diffusion to
paint new poses. This is deterministic, keeps the exact art style (it _is_ the same
art), and produces genuine silhouette change.

The trick that turns one static frame into a believable **alternating-leg** step:
**counter-shear the left and right halves of the leg band in opposite directions.**
For a roughly centered biped, pixels left of center and pixels right of center in
the lower body are swung oppositely each beat → one foot goes forward while the
other goes back. No segmentation, no bones, no diffusion.

## Goal

1. Each enemy gets a **4-frame walk cycle** (contact-L → passing → contact-R →
   passing) baked from its existing SDXL sprite — real frames, same art style.
2. The motion **changes the silhouette** (legs alternate; flyers' wings beat), so
   enemies read as walking/flying, not floating.
3. **Zero new art generation, no new dependencies, no diffusion drift.** Frames are
   produced by a pure, unit-tested warp + an in-engine canvas bake at preload.
4. Faster enemies "run" = the same cycle played faster (the gait phase is already
   distance-coupled; walk-frame playback couples to it too).
5. No regressions: typecheck, full test suite, and build stay green; enemies spawn,
   move, attack, die, and survive scene re-entry without errors.

## Non-goals

- Not regenerating any sprite via SDXL/diffusion (proven unreliable for walk loops).
- Not per-enemy hand-rigging or true skeletal animation.
- Not touching enemy stats, spawn, or combat rules.
- Not animating towers/hero/bosses (bosses already have authored frames).

## Design

### A. Pure warp module — `src/scenes/enemyWalkWarp.ts` (Phaser-free, TDD)

One source of truth for "how a given row of the sprite is displaced at a given
phase," shared by the test and the baker.

```ts
export type MotionProfile = "walk" | "flap";
export interface BandWarp {
  dx: number;
  dy: number;
} // px offset for a band
export interface WarpOpts {
  legSwing?: number;
  flap?: number;
  bob?: number;
}

/**
 * Displacement for a horizontal band of the sprite.
 * @param yNorm  0 = top of sprite, 1 = bottom (feet)
 * @param side   -1 = left half (x<center), +1 = right half  (used by "walk")
 * @param phase  0..2π around the cycle
 */
export function bandWarp(
  profile: MotionProfile,
  yNorm: number,
  side: -1 | 1,
  phase: number,
  opts?: WarpOpts,
): BandWarp;
```

- **walk:** a leg weight ramps `0` above the waist (`yNorm < 0.5`) to `1` at the
  feet (`yNorm = 1`). `dx = side * legSwing * legWeight * sin(phase)` → left/right
  feet swing oppositely (alternating step). A small **counter-sway** on the torso
  (`yNorm < 0.5`): `dx = -0.25 * legSwing * sin(phase)` (whole upper body, no side
  split) so the body leads the legs. A shared **contact bob** `dy = -bob *
|sin(phase)|` lifts the body between footfalls (peaks at passing poses).
- **flap:** wing weight ramps from the vertical mid-line outward/upward; `dy =
-flap * wingWeight * sin(phase)` (wings rise/fall on the beat), `dx = 0`. Used for
  flyers (`gargoyle`, `stormflyer`).
- All outputs finite for every input; `phase = 0` ⇒ zero `dx` (neutral contact).

### B. Canvas baker — `src/scenes/enemyWalkBake.ts` (thin Phaser wrapper)

At `PreloadScene.create()` (runs once, before MainMenu; textures already loaded):

For each enemy id:

1. Read the loaded single-frame texture `enemy__<id>` source image (300×300).
2. Choose profile: `flap` for known flyers, else `walk`. (Flyer set derived from
   the `ENEMIES` catalog `flying` flag — no hard-coded list duplication.)
3. Create a **CanvasTexture** keyed `enemy__<id>` (overwriting the static one) sized
   `300*FRAMES × 300`. `FRAMES = 4`.
4. For each frame `f` (phase = `f/FRAMES * 2π`): draw the source in ~24 horizontal
   **bands**; each band split at the horizontal center into a left and right slice,
   each drawn into the frame cell offset by `bandWarp(profile, yNorm, side, phase)`.
   Band count is a perf/quality knob; 24 is smooth at the 44 px display size.
5. Register frames `walk1..walk4` on the texture and create the `enemy__<id>_walk`
   anim directly (`frameRate` per-kind, `repeat: -1`) — mirroring what
   `PreloadScene` already does for multi-frame manifest entries.

Banded slice-draw uses only `ctx.drawImage` (source-rect → dest-rect); no per-pixel
loops. ~24 bands × 2 sides × 4 frames × 20 enemies ≈ 4k draws total at load — a few
ms. Idempotent: skip if the `_walk` anim already exists (re-entry safe).

### C. Runtime — `animateEnemy` (battleSceneSprites.ts)

- The existing `if (this.anims.exists(\`${key}\_walk\`))`branch already plays the
walk loop and pauses it while frozen — **it just starts firing now** that the anim
exists. Couple playback rate to travel so a slowed enemy steps slower: set`s.anims.timeScale`from recent`moved` (clamped), so "running" = faster cycle.
- **Damp the procedural whole-body bob when authored walk frames exist** (the frames
  now carry the step). Keep: ground-coupled gait _phase_ (drives `timeScale` +
  shadow), the contact **shadow** lift, and a small lean. Reduce `BOB`/`ROCK`
  amplitude (or gate it) so we don't double up bob-on-bob. The shadow stays pinned
  to the ground and still shrinks/fades on lift — the weight anchor.
- Flyers: keep the existing procedural wing-beat transform **and** play the baked
  `flap` frames — both reinforce altitude/beat; no conflict (frames change outline,
  transform adds bank/rise).

### D. Manifest / preload

- `spriteManifest.ts` enemy entries stay `frames:1, names:["idle"]` on disk — the
  PNGs are unchanged single frames; the extra frames live only in the baked
  CanvasTexture at runtime. (No 96×96-style on-disk sheet to maintain by hand.)
- `PreloadScene.create()` calls the baker for every enemy after its existing
  manifest anim-build loop.

## Testing

- **Unit (TDD, RED first)** — `tests/enemyWalkWarp.test.ts` for `bandWarp`:
  - `walk`: at the feet (`yNorm=1`) left and right sides have **opposite-sign** `dx`
    at `phase=π/2`; magnitude grows from waist (≈0) to feet (max); `phase=0` ⇒
    `dx≈0`; bob `dy ≤ 0` and is most negative at the passing phase.
  - `flap`: `dx=0` always; `dy` oscillates with phase; outputs finite for a sweep of
    `yNorm`/`phase`.
  - All profiles: every output finite; symmetric over a full `2π`.
- **Regression:** `vitest run` green; `tsc --noEmit` clean; `vite build` succeeds.
- **Playtest (CDP, `window.__game`):** start a battle, confirm enemies cycle a
  visible alternating-leg step (silhouette changes), slower when slowed, flyers beat
  wings, take hits and die with no console errors; re-enter the battle scene without
  crashing or double-baking.

## Files touched

- **Add:** `src/scenes/enemyWalkWarp.ts`, `src/scenes/enemyWalkBake.ts`,
  `tests/enemyWalkWarp.test.ts`, this spec, the plan.
- **Edit:** `src/scenes/PreloadScene.ts` (invoke baker in `create`),
  `src/scenes/battleSceneSprites.ts` (`animateEnemy`: play/timeScale walk, damp
  procedural bob), `src/scenes/enemyWalkTransform.ts` (expose a reduced-amplitude
  path when frames are present, or gate `BOB`/`ROCK`).
- **No art regen, no manifest PNG changes, no new dependencies.**

## Risks & mitigations

- **Band stair-stepping / seams.** Mitigate with enough bands (24) and 1px band
  overlap on the draw; invisible at 44 px. If a profile looks torn, lower
  `legSwing`.
- **Non-biped enemies (slime, monolith, golem).** Counter-shear still produces a
  plausible squash/lean wobble rather than legs; acceptable and still non-floating.
  `flap` is reserved for the two real flyers.
- **Looks weaker than hoped.** Amplitudes (`legSwing`, `bob`, band count, frame
  count 4→5) are single constants, trivially tunable after the first playtest.
