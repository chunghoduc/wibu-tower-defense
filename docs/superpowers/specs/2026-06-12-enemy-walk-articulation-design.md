# Enemy Walk Articulation — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session)
**Topic:** Redesign enemy walking art with real articulated limbs and a longer walk cycle so enemies move with life instead of sliding.

## Problem

Enemies read as stiff bodies sliding down the lane. The root cause is in the art pipeline, not the runtime:

- `composeEnemy(spec)` in `scripts/pixelart/creatures.mjs` draws every body — legs included — into **one static canvas**.
- `composeEnemyFrames(spec)` then fakes a walk cycle via `pose()`: a **whole-body translate + shear** (`walk1: dy:-1, lean:1` / `walk2: dy:1, lean:-1`). **No limb ever moves** — the legs are baked, so the two "walk" frames are the same silhouette nudged 1px.
- The runtime driver `BattleScene.animateEnemy` therefore carries *all* the locomotion (a procedural waddle/bob/squash coupled to distance travelled). The body rocks, but the legs never stride — the giveaway that reads as "floating / sliding".

By contrast, player towers and the hero use `scripts/svgart/pixrig.mjs`, which poses legs and arms **by joint angle per frame** (`poses.mjs` MELEE/CAST sets) — they look alive because their limbs actually move.

A prior project note ("don't regen art to fix animation") was about the **near-identical SDXL frames**, which genuinely could not carry motion. That premise does **not** apply here: enemy creatures are deterministic SVG pixel art we author end-to-end, so we can draw true stride frames.

## Goal

Give enemies a real, lively walk: **articulated alternating legs + counter-swinging arms + body bob**, and **expand the walk cycle from 2 → 4 frames** for smoother locomotion. Keep each enemy's bespoke silhouette (slime, ghost, winged, ogre tusks, caster staff, etc.).

Non-goals: changing enemy stats/behaviour, replacing the creature art style with the tower pixrig, or touching boss-specific rig sheets (bosses route through `pixrig.mjs` via `saveAnim`, not `creatures.mjs`).

## Approach

**Approach A — Articulated walk cycle in the creature composer (chosen).**

Parameterize limb drawing in `creatures.mjs` by a `gait` descriptor and build an expanded, per-body-type walk cycle of real poses.

Rejected alternatives:
- **Pure procedural** (push `animateEnemy` harder): cannot move legs that are baked into a single sprite — caps at body waddle. This is the current ceiling, and it is the problem.
- **Adopt full pixrig for enemies**: highest fidelity but discards the bespoke creature silhouettes (slime/ghost/winged/ogre) that give enemies their identity. Too disruptive.

## Design

### 1. Gait-parameterized composer (`scripts/pixelart/creatures.mjs`)

Introduce a `gait` object describing one frame's pose:

```
gait = {
  legSwing: -1..1,   // +1 = left leg forward / right leg back; -1 = mirror; 0 = together
  armSwing: -1..1,   // arms counter-swing to legs (opposite sign)
  bob:      px,       // whole-body vertical offset (up = negative)
  lean:     px,       // top-row horizontal shear (feet planted)
  squash:   0..1,     // vertical squash for foot-plant / slime land
  tint:     0..1,     // hurt-flash red blend
}
```

Body-type rendering consumes `gait`:

- **Bipeds** (`humanoid`, `ogre`, `boss`, `skeleton`, `caster`): the two legs are drawn at an x/y offset derived from `legSwing` (one leg steps forward + lifts, the other plants back); visible arms swing by `armSwing` (opposite sign). Body bobs by `bob`; `squash` flattens on foot-plant. Existing weapons/shields/staffs/horns stay attached to the body.
- **Slime**: ignores legSwing; uses `squash`/`bob` for a squash→launch→stretch→land hop.
- **Ghost**: ignores legs; `bob` drives float, hem wave shifts by frame phase.
- **Winged** (`gargoyle`, `stormflyer`): wings raise/lower by `legSwing` magnitude (repurposed as wing phase); body bobs. Runtime flyer transform complements.

`pose()`'s whole-body translate/shear/tint is folded in as the outer transform for parts that don't articulate (and for `lean`/`tint`), so nothing regresses.

### 2. Expanded pose table

Replace the 6-pose `ENEMY_POSES` with an 8-pose set:

| name  | role           | gait sketch                                  |
|-------|----------------|----------------------------------------------|
| idle  | rest           | legs together, slight arm rest               |
| walk1 | contact-left   | legSwing +1, armSwing -1, bob 0, squash 0.4  |
| walk2 | passing        | legSwing 0, armSwing 0, bob -1 (lift)         |
| walk3 | contact-right  | legSwing -1, armSwing +1, bob 0, squash 0.4  |
| walk4 | passing        | legSwing 0, armSwing 0, bob -1 (lift)         |
| atk1  | wind-up        | lean back, arm raised (reuse current)         |
| atk2  | strike         | lunge forward (reuse current)                 |
| hurt  | recoil         | lean back + red tint (reuse current)          |

`/walk/` (PreloadScene regex) now spans walk1–walk4; enemy walk anim plays them at 7fps, looping. No PreloadScene change required.

### 3. Runtime tune (`src/scenes/battleSceneSprites.ts` → `animateEnemy`)

Now that legs stride in the frames, reduce the procedural **body-bob** amplitude (`yOff = -swing * 5 * A` → a smaller factor) and slightly soften the waddle so the two layers complement rather than double-bob. Distance-coupled phase, lean-into-travel, hurt overlay, and the ground-contact shadow stay exactly as they are (the shadow is the anti-float anchor and must remain).

### 4. Regeneration

Run `npx vite-node scripts/svgart/gen.mjs --only=enemy` to regenerate `public/assets/sprites/enemy/<id>.png` + `.json` for all non-boss enemies, then `--only=manifest` to refresh `src/data/spriteManifest.ts`. Deterministic output (no RNG) — regen is reproducible.

## Testing

New vitest `tests/enemy-walk.test.ts` importing `composeEnemyFrames` from `scripts/pixelart/creatures.mjs`:

1. **Frame contract** — names are `["idle","walk1","walk2","walk3","walk4","atk1","atk2","hurt"]`; 8 frames; all same dimension.
2. **Distinct walk frames** — walk1..walk4 are pairwise distinct canvases (rules out the old uniform-shear fake).
3. **Real stride (biped)** — for a bipedal spec (`grunt`), the lowest filled foot-y on the left half differs from the right half in `walk1` (one leg planted, one lifted), and that left/right asymmetry **flips sign** in `walk3`. A pure whole-body translate cannot produce a sign flip → proves articulation.
4. **No-leg bodies don't crash** — `slime`, `phantom` (ghost), `gargoyle` (winged) all compose 8 frames without error and stay distinct across the hop/float cycle.

These pass only after articulation lands → clean RED today (only walk1/walk2 exist, symmetric).

## Files touched

- `scripts/pixelart/creatures.mjs` — gait-parameterized composer + 8-pose table (must stay < 500 lines; currently 183).
- `src/scenes/battleSceneSprites.ts` — trim `animateEnemy` body-bob amplitude.
- `public/assets/sprites/enemy/*.png|json` — regenerated.
- `src/data/spriteManifest.ts` — regenerated (frame counts 6 → 8 for enemies).
- `tests/enemy-walk.test.ts` — new.

## Risks

- **Composer complexity** could push `creatures.mjs` over 500 lines. Mitigation: factor the biped leg/arm step into a small helper; keep body-type branches lean.
- **Double-bob** if runtime amplitude isn't trimmed → addressed in §3.
- **Manifest frame-count change** (6 → 8) is auto-handled by the regex grouping; verified by build + playtest.
