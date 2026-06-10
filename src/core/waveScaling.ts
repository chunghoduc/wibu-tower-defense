/**
 * Intra-stage wave escalation.
 *
 * The base game had NO difficulty ramp within a stage: an enemy's HP/atk was
 * `base × difficulty × challenge × endless`, with nothing depending on the wave
 * index — so a grunt in the opening rush was identical to a grunt in the final
 * pressure wave, and a single tower that cleared wave 1 cleared them all. This
 * module makes each successive wave in the same stage tougher: the opening wave
 * is a warm-up (×1.0), and the per-enemy toughness climbs to the boss finale, so
 * the back half of a stage becomes a real throughput test rather than a victory
 * lap.
 *
 * Pure + dependency-free so it is independently unit-testable.
 */

/** How much an enemy's HP grows from the first wave to the last (intra-stage).
 *  1.6 ⇒ the final wave's trash has ≈2.6× the HP of the opening wave's. */
export const WAVE_HP_RAMP = 1.6;
/** Same, for enemy attack. 0.7 ⇒ final-wave trash hits ≈1.7× as hard. */
export const WAVE_ATK_RAMP = 0.7;
/** Gentle stage-over-stage HP bump (on top of count/archetype growth already in
 *  buildWaves). 0.08 ⇒ stage-10 trash ≈1.7× stage-1 trash. Applies to bosses
 *  too, lightly, so a late-stage boss is a touch tankier than its base. */
export const STAGE_HP_RAMP = 0.08;
/** Gentle stage-over-stage atk bump. 0.05 ⇒ stage-10 trash hits ≈1.45× harder. */
export const STAGE_ATK_RAMP = 0.05;

export interface WaveScale {
  /** Multiplier on maxHp (and shield). */
  hpMult: number;
  /** Multiplier on atk. */
  atkMult: number;
}

/**
 * Scaling factors for an enemy spawned in wave `waveIndex` (0-based) of a stage
 * that has `totalWaves` waves, where the stage is the `stageN`-th (1-based).
 *
 * `isBoss` enemies are exempt from the steep intra-stage ramp — they already
 * carry the stage's difficulty spike via the escalating boss roster, and
 * ramping a multi-thousand-HP boss by 2.6× makes a slog, not a climax. Bosses
 * still receive the gentle stage-over-stage bump.
 */
export function waveScaling(
  waveIndex: number,
  totalWaves: number,
  stageN: number,
  isBoss = false,
): WaveScale {
  const frac = totalWaves > 1 ? clamp01(waveIndex / (totalWaves - 1)) : 0;
  const stage = Math.max(1, stageN);
  const stageHp = 1 + STAGE_HP_RAMP * (stage - 1);
  const stageAtk = 1 + STAGE_ATK_RAMP * (stage - 1);
  if (isBoss) {
    return { hpMult: stageHp, atkMult: stageAtk };
  }
  return {
    hpMult: (1 + WAVE_HP_RAMP * frac) * stageHp,
    atkMult: (1 + WAVE_ATK_RAMP * frac) * stageAtk,
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
