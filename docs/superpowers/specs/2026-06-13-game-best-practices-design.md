# Game-Engineering Best Practices Refactor — Design

**Date:** 2026-06-13
**Mode:** FULL-AUTO (self-approved gates; assumptions stated inline)
**Request:** "refactor the project using best practices for a game"
**Constraint:** strictly behavior-preserving — zero gameplay/balance change; visuals must be indistinguishable.

## Audit summary (what drove the scope)

Three parallel audits (game loop, allocation churn, sim↔scene coupling) found the
architecture already follows several core game-engineering practices:

- **Determinism: present.** Seeded Mulberry32 `Rng` (`core/rng.ts`), zero `Math.random`
  and zero `Date.now`/`performance.now` in the battle sim; all timing accumulated from `dt`.
- **Sim↔presentation boundary: clean.** `src/core` has zero Phaser imports; scene reads
  state directly and consumes a typed 13-variant `FxEvent` discriminated union drained per
  tick; input flows through explicit command methods (`commandHero`, `placeTowerAt`, …).
- **Sprites: reused by uid** (`Map<number, Sprite>` in battleSceneSprites).

These are **not** touched. The remaining gaps, in priority order:

1. **No fixed timestep in production.** `BattleScene.update` (BattleScene.ts:453-460)
   passes a variable clamped frame delta to `battle.tick(dt)` and implements 2×/3× speed
   by re-ticking the _same_ dt N times. The test suite drives the sim exclusively at a
   fixed **0.05s** step — production runs a different temporal discretization than the
   one 1041 tests validate.
2. **Zero pooling on one-shot VFX.** Every projectile/impact/skill effect creates fresh
   Graphics/Arc/Rectangle/Star objects destroyed on tween completion — ~300-400
   objects/sec at peak combat (vfxDraw.ts `go()`, projectileFx.ts). Not a measured lag
   problem at this game's scale (≤~25 enemies), but the classic GC-spike risk on mobile.
3. **Micro-churn in hot loops.** Per-tick `Dot[]` reallocation per enemy with DoTs
   (battleEnemies.ts:104-116); 3 fresh `Set<number>` per frame in `manageSprites`.

## Approaches considered

- **A — targeted, behavior-preserving (CHOSEN):** fixed-step driver at the canonical
  0.05s step + render interpolation + FX pool at the two centralized seams + micro-churn
  fixes.
- **B — ECS rewrite:** rejected. The sim is already systems-over-structs with tiny entity
  counts; ECS adds indirection and migration risk for zero payoff.
- **C — instrumentation only:** rejected; leaves the prod/test timestep divergence.

## Milestones

### M1 — Fixed-timestep driver (`src/core/fixedStep.ts`)

Pure, fully tested `FixedStepper`:

- `STEP = 0.05` s — chosen because it is the suite's canonical tick everywhere
  (tests/fixtures.ts `runFor`, battle.test.ts, …). After this change the production sim
  executes **exactly the discretization the tests verify**.
- `advance(frameSeconds): number` — accumulates and returns whole steps to run.
- Catch-up cap: **5 steps per frame** (0.25 s); excess accumulator is dropped
  (spiral-of-death guard, same intent as today's 50 ms clamp).
- `alpha: number` getter — leftover fraction (acc/STEP) for render interpolation.

`BattleScene.update` becomes:

```ts
const steps = this.stepper.advance(Math.min(deltaMs / 1000, 0.25) * this.gameSpeed);
for (let i = 0; i < steps; i++) this.battle.tick(STEP);
```

`gameSpeed` (0/1/2/3) multiplies accumulated time — pause = no accumulation; fast-forward
= more fixed steps, never a different dt.

### M2 — Render interpolation (keeps M1 visually invisible)

A 0.05 s sim step at a 60 fps display would visibly stutter (positions jump at 20 Hz).
Scene-side interpolation, sim untouched:

- Before stepping each frame, snapshot prev positions of enemies + hero by uid.
- Pure `src/scenes/renderLerp.ts` (Phaser-free, tested): given prev-map, current entities
  and `alpha`, produce render positions (new entity ⇒ current pos; missing ⇒ current).
- Sprite sync + graphics draw read the interpolated position instead of `e.pos` directly.
- Positions only — hp bars, walk-cycle phase, badges read live state (sub-perceptual at
  50 ms).

### M3 — FX pool (`src/scenes/fxPool.ts`)

Small capped pool for the three shape types behind nearly all one-shot VFX (Arc,
Rectangle, Star):

- API mirrors the factory (`pool.circle(x,y,r)`, `pool.rect(…)`, `pool.star(…)`) +
  `release(o)`; acquire performs a **full state reset** (position, scale, alpha, angle,
  fill, stroke, depth, visible, active).
- Capped (128/type); overflow falls back to create-and-destroy — never unbounded.
- Adopted at the two centralized seams only: `VfxDraw` (its `go()` already owns every
  destroy) and `ProjectileFx`. `skillElementFx`/`meleeFx`/`lootFlyFx` keep their current
  pattern — the pool API permits later adoption (non-goal now).
- Pure pool bookkeeping (acquire/release/reuse/cap) unit-tested with stub objects.

### M4 — Micro-churn fixes

- `battleEnemies.ts` DoT update: mutate `d.remaining` in place + write-index compaction —
  no per-tick array allocation. Behavior identical (existing DoT tests must stay green).
- `manageSprites`: reuse 3 persistent `Set`s via `.clear()`.

## Non-goals

- ECS / data-layout rewrite; any change to the FxEvent model, RNG, or save handling.
- Pooling the long-tail VFX call sites (skillElementFx/meleeFx/lootFlyFx).
- The uncommitted tower-art session files (spriteManifest.ts, tower PNGs/JSONs,
  regen_seeds.json, sync_manifest.mjs) — out of scope, remain untouched.
- Any balance, content, or visual change.

## Verification gates (every milestone)

`npm test` (1041 green) · `npm run typecheck` · `npm run lint` (0 errors) ·
`npm run lint:cycles` (0) · `npm run format:check`. Final: production build + CDP
playtest screenshots (battle mid-combat) compared against pre-refactor captures; the
camera/feel must be indistinguishable. Incremental commit per milestone.

## Risks

- **M2 is the riskiest:** missed interpolation in one draw path ⇒ sprite/hp-bar
  desync. Mitigation: single `renderPos(uid)` helper used by every consumer; playtest
  screenshot + manual smoothness check at 1×/2×/3×.
- **M3 reset bugs** ⇒ ghost styling on reused shapes. Mitigation: exhaustive reset list
  in one function; cap keeps blast radius bounded; fallback path identical to today.
- **M1 changes effective tick cadence** (e.g. 60 Hz variable → 20 Hz fixed). DPS/timers
  are dt-integrated so outcomes match the tested cadence by construction; combo/perfect
  windows already pass at 0.05 in tests.
