# Design Spec — Lively Walking via a Render-Time Leg Puppet

**Date:** 2026-06-20
**Status:** Approved (full-auto self-approval)
**Topic:** Make enemy and boss walking motion smooth and realistic — feet that visibly lift and step — without the regressions that killed the two prior multi-frame attempts.

## Problem

Players report locomotion looks wrong: enemies "slide" toward the castle and only the body bobs — **the feet never move**. The request was literally "generate more frames per enemy (4–5) so walking looks like walking."

Today every regular enemy is a **single static SDXL sprite** moved by the pure `enemyWalkTransform.ts`, which applies only whole-body **bob / waddle / rock / squash**. There is **no leg articulation** — the silhouette is rigid, so it reads as floating. Bosses get a preload-baked 4-frame "stomp" (`bossWalkBake.ts` + `enemyWalkWarp.ts`), a 24-band horizontal shear of frame 0.

## Why not "just generate frames"

This repo has already tried the literal request **twice** and reverted both:

1. **SDXL multi-frame walk sheets** (`bc8b916`, `159dc45`, `95c3c5d`) — abandoned. Independently generated poses of the same creature look like *different creatures* frame-to-frame → flicker.
2. **Canvas band-warp baking** (`be717c4`) — **killed** in `b627ba8` for two reasons that are now load-bearing constraints:
   - **Floating-strip regression:** the baked 4-wide strip *replaced* `enemy__<id>` in place; whenever the walk anim's per-frame re-assertion lapsed, the full sheet flashed, sliding down the lane.
   - **Imperceptible motion:** "the 24-band shear-warp produced near-identical frames, so even when it played the walk was imperceptible (the slide/float)." A uniform horizontal shear averages out to no visible stepping.

A guard test (`8c61536`, `tests/...`) locks every enemy manifest entry to `frames === 1` specifically to stop a future regen from reintroducing the strip. **Any design here must keep that test green.**

So the unmet need is **visible foot articulation**, and the failures teach two hard rules: (a) never bake a multi-frame strip over the base key, and (b) feet must *translate*, not merely shear.

## Approach (chosen): render-time segmented leg puppet

Keep each enemy a single static SDXL sprite (art, manifest, `ASSET_VERSION` all unchanged — the single-frame guard stays green). At **render time**, split the on-screen rig into three crops of the *same* texture:

- **body** — the sprite with `setCrop` to its top ~60%, hiding the baked-in feet so they can't double up.
- **legL** — crop of the bottom-left quadrant (`x∈[0,0.5]`, `y∈[waist,1]`).
- **legR** — crop of the bottom-right quadrant (`x∈[0.5,1]`, `y∈[waist,1]`).

The two leg pieces are layered just under the body and driven by a gait-phase puppet: each leg alternately **lifts** (translate up) and **swings** (translate forward/back relative to the body) plus a small **hip pivot**, with `legR` exactly **π out of phase** from `legL`. One foot plants while the other steps — real, alternating, visible foot movement.

### Why this satisfies the intent better than discrete frames

- **Smoother than 4–5 frames:** motion is continuous from the gait phase → effectively unlimited in-between poses, no stepping between discrete art.
- **No flicker:** it is one texture deformed, not N independent SDXL poses.
- **Beats failure (a):** there is **no strip texture** — only live crops of the single frame; the floating-strip is structurally impossible and the single-frame guard test still passes.
- **Beats failure (b):** feet **translate** (lift + swing) in opposite phase, so the step is plainly visible — not a uniform shear that cancels out.
- **No art churn / no `ASSET_VERSION` bump** — sidesteps the recent sprite-churn risk entirely.

### Trade-off accepted

Crops use a **fixed waist line** (`yNorm ≈ 0.6`) and a **center split**, so the rig assumes a roughly upright, bipedal-ish silhouette. For blob/quadruped shapes it degrades to a "lower-body shuffle" — still strictly more lively than today's rigid bob, and tunable. **Flying / floating enemies opt out** entirely (no legs) and keep the existing wing-beat. The waist line and amplitudes are single constants, easy to retune.

### Rejected alternatives

- **Phaser Mesh/Rope live vertex warp** — solves the strip problem but reintroduces failure (b) unless the warp is large and localized; heavier per-frame cost and finicky vertex bookkeeping across many enemies. The 3-crop puppet gets the same visible result more simply.
- **SDXL img2img / ControlNet consistent frames** — no ControlNet in the local z-image-turbo flow; consistency unproven; reintroduces flicker + `ASSET_VERSION` churn. Rejected.

## Components

1. **`src/scenes/legPuppet.ts` (pure, Phaser-free, TDD).**
   `legPuppet(phase: number, opts?: LegPuppetOpts): LegRigPose`
   Returns `{ left: LegPose; right: LegPose }` where `LegPose = { liftY: number; swingX: number; pivotDeg: number; planted: boolean }`.
   - `right` is computed at `phase + π`.
   - `liftY ≤ 0`, peaks mid-swing (foot off the ground); `≈ 0` while planted.
   - `swingX` carries the foot forward on lift and back (relative to the body) on plant.
   - `pivotDeg` is a small hip rotation in sympathy with the swing.
   - Continuous and periodic at `phase = 0` and `2π` (no seam).
   - `opts`: `lift` (default ~6px), `swing` (default ~5px), `pivot` (default ~6°), `amp` (global scale, bosses heavier/slower).

2. **`src/scenes/enemyLegRig.ts` (presenter, Phaser).**
   - `LegRig` type = `{ body; legL; legR }` (all `Phaser.GameObjects.Image`/sprite of the same texture key).
   - `createLegRig(scene, key, frame, x, y, depth): LegRig` — builds the three crops with the waist/center split; sets crops, origins (hip pivot near each leg's top), and relative depths (legs just under body).
   - `updateLegRig(rig, pose, base)` — given a `LegRigPose` and the body's resolved transform (position, scale, angle, bob from `enemyWalkTransform`), positions/rotates all three pieces seamlessly, applying the per-leg lift/swing/pivot on top of the shared body motion.
   - `destroyLegRig(rig)` — tears down all three.
   - Constants: `WAIST_NORM`, `BODY_OVERLAP` (legs crop a few px above the body-crop bottom to hide the seam, mirroring the baker's "+1px overlap").

3. **`src/scenes/battleSceneSprites.ts` wiring (kept < 500 code lines via the extractions above).**
   - On sprite creation for a **ground** (non-flying) enemy: build a `LegRig` instead of (or wrapping) the single Image; store it on the sprite's data.
   - In `animateEnemy`: keep distance-coupled gait phase, `enemyWalkTransform` (now driving the **body+group** bob/waddle), and the ground-contact shadow. Additionally call `legPuppet(phase)` and `updateLegRig`. The body's own foot region is cropped away, so the only feet shown are the animated pieces.
   - Flying enemies: unchanged single-sprite wing-beat path.
   - Hurt squash overlay still applies to the whole group.

4. **Bosses (Milestone 2).**
   - Apply the same leg puppet to the boss's idle/locomotion pose (crop the base frame), driving locomotion with `amp` tuned heavier + slower.
   - Retire `bossWalkBake.ts` + the `boss__<id>__walk` baked texture and its anim (the documented imperceptible-shear path). The base sheet's **atk/skill/hurt one-shot frames stay** and continue to drive cast poses; only locomotion changes to the puppet.
   - Keep `enemyWalkWarp.ts`'s pure `bandWarp` only if still referenced by tests; otherwise delete with its tests. (Decide during planning by grep.)

## Data flow (per frame, ground enemy)

```
enemyRenderPos(e)  ──► base position (lerped)
distance moved     ──► gaitPhase (accumulated, per-enemy)
gaitPhase ─► enemyWalkTransform ─► body bob/waddle/rock/squash + liftNorm(shadow)
gaitPhase ─► legPuppet ───────────► { left, right } leg poses
            updateLegRig(rig, poses, bodyTransform)
                ├─ body  : pos+bob, crop=top, angle
                ├─ legL  : hip-anchored, +left.liftY/swingX/pivot
                └─ legR  : hip-anchored, +right.liftY/swingX/pivot
shadow: ground-contact, scaled/faded by liftNorm (unchanged)
```

## Testing

- **`tests/legPuppet.test.ts` (pure, primary TDD target):**
  - feet alternate: at any phase, `left.planted !== right.planted` across the cycle; right pose equals left pose shifted by π.
  - each foot lifts: `min over cycle of left.liftY < -2px`; planted frames have `liftY ≈ 0`.
  - swing direction: forward during lift, back during plant.
  - continuity/periodicity: pose at `0` ≈ pose at `2π`; no discontinuity.
  - `amp` scales lift/swing monotonically.
- **Keep green:** the existing single-frame manifest guard (`8c61536`) and `enemyWalkTransform` liveliness test — this design changes neither the manifest nor the transform's contract.
- **Presenter:** a light jsdom/Phaser-shim test that `createLegRig` sets three pieces with the expected crop rects and that `updateLegRig` moves the lifted leg's `y` above the planted leg's `y`. (If Phaser is impractical to instantiate in the test env, assert the geometry via a thin pure helper that `enemyLegRig` consumes, mirroring the repo's pure-core pattern.)
- **Live verification:** CDP self-playtest via `window.__game` — screenshot a wave mid-walk; confirm enemy `texW` is still 300 (no strip), no walk-anim on enemies, and the leg pieces occupy distinct y positions across frames (one lifted). Boss verification in Milestone 2.

## Milestones

1. **M1 — Pure puppet + ground-enemy rig.** `legPuppet.ts` (TDD), `enemyLegRig.ts`, wire `battleSceneSprites` for non-flying enemies; keep files < 500 lines; verify (tsc + tests + build + CDP). Commit.
2. **M2 — Bosses.** Apply puppet to boss locomotion, retire `bossWalkBake`/`enemyWalkWarp` (and dead tests); verify + CDP boss screenshot. Commit.
3. **M3 — Polish + memory.** Tune `WAIST_NORM`/amplitudes per a quick visual pass across archetypes (biped/blob/flyer-skip); update `project_procedural_sprite_animation.md`. Commit.

## Out of scope / non-goals

- No SDXL regeneration, no manifest changes, no `ASSET_VERSION` bump.
- No new enemy art, no per-enemy anatomy authoring (fixed waist/center split is intentional).
- Towers and the hero are untouched (hero already uses real layered frame anims).
- Projectiles, pathing, combat math, difficulty — all untouched.
