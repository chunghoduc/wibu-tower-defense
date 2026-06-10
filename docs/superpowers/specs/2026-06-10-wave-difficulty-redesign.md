# Wave Difficulty Redesign — Intra-Stage Escalation

**Date:** 2026-06-10
**Status:** Approved (delegated-autonomy session)

## Problem

The game is too easy — a single tower clears every wave of a stage with no
pressure. The root cause is **structural, not a tuning slip**:

1. **No intra-stage ramp.** Enemy EHP/damage at spawn is
   `baseStats × difficulty.hpMult × challengeMul × endlessMul`
   (`battleWaves.ts:89-96`). **Nothing in that formula depends on the wave
   index.** A `grunt` in wave 1 is identical to a `grunt` in the final pressure
   wave. The only things that grow across a stage are enemy *count* and
   *archetype variety* — never per-enemy toughness. So a tower that trivializes
   wave 1 trivializes wave 6.
2. **The boss is the lone HP spike**, and a geared tower out-DPSes even that.
3. **Normal `hpMult` is only 1.3** (+30% HP) while tower power scales
   *quadratically* — gear buffs both `atk` and `attackSpeed`, which multiply
   into DPS — so the gap between "intended roster" and "content" widens every
   level.

The damage pipeline itself (`damage.ts`) is **correct** and stays unchanged:
crit scales only the bonus vs crit-defense, `r/(r+100)` partial mitigation,
True bypasses armor/resist, DR applied last. Verified by reading + tests.

## Design — make waves harder and harder in the same stage

**Core loop touched:** the *Run* loop (a battle). Target aesthetic (MDA): rising
tension across a stage — the opening rush is a warm-up, each wave demands more
throughput, and by the final pressure wave + boss a single tower physically
cannot keep up, forcing the player to commit more towers / better positioning
(restores the Autonomy + Competence the flat curve had erased).

### 1. Intra-stage wave-scaling curve (the headline)

A new pure helper `waveScaling(waveIndex, totalWaves, stageN)` returns per-spawn
`{ hpMult, atkMult, countBonus }`, applied in `spawnEnemy`:

```
frac      = totalWaves > 1 ? waveIndex / (totalWaves - 1) : 0   // 0..1 across the stage
stageRamp = 1 + STAGE_HP_RAMP * (stageN - 1)                    // gentle stage-over-stage
hpMult    = (1 + WAVE_HP_RAMP  * frac) * stageRamp
atkMult   = (1 + WAVE_ATK_RAMP * frac) * (1 + STAGE_ATK_RAMP * (stageN - 1))
```

Constants (anchored, documented next to the code):

| Const | Value | Effect |
| --- | --- | --- |
| `WAVE_HP_RAMP`  | `1.6` | last wave's trash ≈ **2.6×** the first wave's HP |
| `WAVE_ATK_RAMP` | `0.7` | last wave's trash ≈ **1.7×** the first wave's damage |
| `STAGE_HP_RAMP` | `0.08`| stage 10 trash ≈ **1.7×** stage 1 (on top of count growth) |
| `STAGE_ATK_RAMP`| `0.05`| stage 10 trash ≈ **1.45×** stage 1 damage |

**Bosses are exempt from the wave ramp** (`archetype === "Boss"`): they already
carry the stage's difficulty spike via `BOSS_BY_STAGE` escalation (warden 1700 →
meruon 3800) and authored stats. Ramping a 3800-HP boss by 2.6× would make a
slog, not a climax. Bosses still receive the gentle `stageRamp` so a stage-10
boss is a touch tankier than its base, but not the steep intra-stage curve.
Shields scale with `hpMult` like HP.

Why this shape: the explicit request is "harder and harder **in the same
stage**," so the intra-stage `frac` ramp is the primary lever and is large;
stage-over-stage and difficulty bumps are deliberately gentle so we don't
double-count the count/variety/boss growth already present.

### 2. Tighter late-wave cadence + one more pressure wave

`buildWaves` gains an escalation pressure wave from **stage 3** (was 6), and
later waves spawn on shorter intervals so more enemies are on-screen at once.
Combined with the HP ramp this turns the back half of a stage into a genuine
throughput test that one tower's single-target DPS cannot satisfy.

### 3. Modest Normal-difficulty bump

`Normal.hpMult 1.3 → 1.55`, `atkMult 1.15 → 1.25`. Keeps Hard/Nightmare as the
documented ~5× / ~20× power ratios (their multipliers rise proportionally is
*not* required — they already dwarf Normal; we only lift the floor). Small, so
early-stage competence stays intact (front-load easy, ramp later — §7 flow).

## Components / files

- **`src/core/waveScaling.ts`** (new, ~40 lines) — pure `waveScaling()` +
  exported constants. Independently unit-testable; no Phaser/battle deps.
- **`src/core/battleWaves.ts`** — `spawnEnemy` calls `waveScaling(this.waveIndex,
  this.stage.waves.length, stageNumber(this.stage.id))`, multiplies `maxHp`,
  `shield`, `atk` (skip the HP/atk ramp for `def.archetype === "Boss"`, apply
  stageRamp only).
- **`src/data/stage.ts`** — `buildWaves` cadence/extra-pressure-wave tweaks.
- **`src/data/schema.ts`** — `DIFFICULTY_SCALING.Normal` numbers + comment.
- **`src/core/waveScaling.test.ts`** (new) — curve monotonicity, endpoints,
  boss exemption, frac=0/1 anchors.

## TTK sanity check (intent)

Assume a strong single tower sustains ~120 effective DPS at mid-game. A stage-5
final pressure wave: ~10 trash at `frac≈0.85` → HP ≈ base×1.3×(1+1.6×0.85) ≈
base×3.05, arriving on a ~0.4s cadence. Aggregate incoming EHP/second now
outpaces 120 DPS → leaks unless a second/third tower (or AoE role) shares the
lane. That is the dynamic we want; the boss then finishes as a clean spike.

## Risk & verification

- **Risk:** over-tuning → early stages feel unfair. Mitigation: intra-stage ramp
  is *relative* (stage 1 wave 1 unchanged at ×1.0 frac), stage ramp gentle.
- **Verify:** `tsc` + full `vitest` (incl. new curve tests) + `npm run build`,
  then a CDP self-playtest (`window.__game`) on stage 1 and a later stage with a
  **single** tower to confirm later waves now leak / require more towers, where
  before one tower held. Falsifiable: if one tower still trivially clears a late
  wave, the ramp constants are too low.
