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
 * Scope: this is the WITHIN-A-STAGE layer only. Cross-stage / cross-chapter
 * growth (the long-game "harder over time" curve) lives in
 * {@link progressionScaling}; tier scaling lives in `DIFFICULTY_SCALING`.
 *
 * Pure + dependency-free so it is independently unit-testable.
 */

/** How much an enemy's HP grows from the first wave to the last (intra-stage).
 *  1.6 ⇒ the final wave's trash has ≈2.6× the HP of the opening wave's. */
export const WAVE_HP_RAMP = 1.6;
/** Same, for enemy attack. 0.7 ⇒ final-wave trash hits ≈1.7× as hard. */
export const WAVE_ATK_RAMP = 0.7;

export interface WaveScale {
  /** Multiplier on maxHp (and shield). */
  hpMult: number;
  /** Multiplier on atk. */
  atkMult: number;
}

/**
 * Scaling factors for an enemy spawned in wave `waveIndex` (0-based) of a stage
 * that has `totalWaves` waves.
 *
 * `isBoss` enemies are exempt from the steep intra-stage ramp — they already
 * carry the stage's difficulty spike via the escalating boss roster, and
 * ramping a multi-thousand-HP boss by 2.6× makes a slog, not a climax. (Bosses
 * still scale across stages/chapters via {@link progressionScaling}.)
 */
export function waveScaling(waveIndex: number, totalWaves: number, isBoss = false): WaveScale {
  if (isBoss) return { hpMult: 1, atkMult: 1 };
  const frac = totalWaves > 1 ? clamp01(waveIndex / (totalWaves - 1)) : 0;
  return {
    hpMult: 1 + WAVE_HP_RAMP * frac,
    atkMult: 1 + WAVE_ATK_RAMP * frac,
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
