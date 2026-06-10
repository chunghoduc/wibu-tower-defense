# Progression Scaling — same enemy, harder over time

**Date:** 2026-06-10
**Status:** Approved (standing full-autonomy delegation)

## Problem

An enemy archetype (e.g. `grunt`) is authored once with global `baseStats`. Its
effective stats vary only by:

```
effective = base × DIFFICULTY(tier) × waveScaling(stage, wave) × challenge × endless
```

The only cross-stage "harder over time" lever is a **flat linear** stage bump
inside `waveScaling` (`STAGE_HP_RAMP = 0.08`/stage). Over a full ~30-stage,
6-chapter game that is only ~3.3× HP end-to-end — it plateaus, and it models no
notion of *chapter*. We want the same enemy to feel meaningfully different at
ch1-s1 vs ch2-s1 vs deep into the game, and the difficulty to keep climbing.

## Design — a clean 3-layer scaling model

Split the two jobs currently conflated in `waveScaling` into single-purpose
layers, each independently unit-testable:

| Layer | Scope | Question it answers |
|---|---|---|
| `DIFFICULTY_SCALING` | tier | Hard vs Normal (the shipped 10×) |
| **`progressionScaling`** *(new)* | global stage / chapter | ch1-s1 vs ch2-s1 vs ch1-s10 |
| `waveScaling` | within one stage | wave 1 vs final wave |

### `progressionScaling(stageN)` — geometric long-game curve

`stageN` is the global 1-based stage number (a "chapter" is a 5-stage biome
band, `floor((stageN-1)/5)`). Geometric so it gets *harder and harder* instead
of plateauing; a per-chapter step makes new chapters feel like walls while the
curve stays **strictly monotonic** (ch2-s1 > ch1-s10 — hero + gear also grew by
then, so no "new chapter feels trivial" trough).

```
idx       = max(1, stageN) - 1          // 0-based global step
chapters  = floor(idx / STAGES_PER_CHAPTER)
hpMult    = (1 + PROG_HP_PER_STAGE)  ** idx  ×  (1 + PROG_HP_PER_CHAPTER)  ** chapters
atkMult   = (1 + PROG_ATK_PER_STAGE) ** idx  ×  (1 + PROG_ATK_PER_CHAPTER) ** chapters
```

Tunable constants (one file):

| Constant | Value | Effect |
|---|---|---|
| `STAGES_PER_CHAPTER` | 5 | chapter band width (matches chapters.ts) |
| `PROG_HP_PER_STAGE` | 0.08 | ×1.08 HP each stage (compounding) |
| `PROG_ATK_PER_STAGE` | 0.04 | ×1.04 atk each stage |
| `PROG_HP_PER_CHAPTER` | 0.30 | extra ×1.30 HP at each new chapter |
| `PROG_ATK_PER_CHAPTER` | 0.14 | extra ×1.14 atk at each new chapter |

Resulting HP multipliers (vs ch1-s1 = 1×): ch1-s10 ≈ 2.5×, ch2-s1 ≈ 1.9×,
ch4-s1 ≈ 7×, ch6-s10 ≈ 35×. Stacked with Hard's 10× → late-game Hard enemy
≈ 350× a stage-1 Normal one.

### `waveScaling` — refactor to intra-stage only

Drop `STAGE_HP_RAMP` / `STAGE_ATK_RAMP` and the `stageN` argument; keep only the
frac-based intra-stage ramp (`WAVE_HP_RAMP` / `WAVE_ATK_RAMP`). Bosses remain
exempt from this frac ramp (returns ×1.0).

### Boss handling

`progressionScaling` applies to **all** enemies including bosses (cross-chapter
growth should lift bosses too). Only the *intra-stage* frac ramp stays
boss-exempt. Boss tier multipliers (`bossHpMult` / `bossAtkMult`) are unchanged.

### Wiring (`spawnEnemy`)

```ts
const prog = progressionScaling(stageNumber(this.stage.id));
const ramp = waveScaling(this.waveIndex, this.stage.waves.length, isBoss);
const hpMul  = (ch.enemyHpMul ?? 1) * this.endlessMul * ramp.hpMult  * prog.hpMult;
const atkMul =                         this.endlessMul * ramp.atkMult * prog.atkMult;
// shield also × prog.hpMult
```

## Testing

- New `progressionScaling.test.ts`: stage 1 = ×1.0; monotonic across stages;
  chapter boundary adds the extra step; ch2-s1 > ch1-s10 (monotonic guarantee);
  documented milestones (ch6-s10 ≈ 35× HP).
- Update `waveScaling.test.ts`: remove stage-ramp assertions, keep intra-stage.
- `mechanics.test.ts` difficulty tests use a stage-1 fixture (`stageN = 1` ⇒
  prog = ×1.0) so they stay green.

## Out of scope

Per-enemy authored overrides per stage; new chapter content; rebalancing
hero/gear power against the new curve.
