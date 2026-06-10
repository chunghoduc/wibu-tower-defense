/**
 * Cross-stage / cross-chapter progression scaling — the long-game difficulty
 * curve.
 *
 * An enemy archetype is authored once with global `baseStats`. To make the SAME
 * enemy meaningfully tougher the deeper you are in the campaign — and to make
 * each new chapter feel like a wall — we scale its HP/atk by a function of the
 * GLOBAL stage number (1-based across all chapters; a "chapter" is a 5-stage
 * biome band, `floor((stageN-1)/5)`).
 *
 * The curve is GEOMETRIC (compounding), not linear, so difficulty keeps climbing
 * — "harder and harder" — instead of plateauing the way a flat per-stage bump
 * does. A discrete per-chapter step adds a felt wall at each chapter boundary
 * while the curve stays strictly monotonic (chapter N's first stage is tougher
 * than chapter N-1's last — the hero and gear have grown by then, so there is no
 * "new chapter feels trivial" trough).
 *
 * This is the cross-stage sibling of {@link waveScaling} (intra-stage) and
 * `DIFFICULTY_SCALING` (tier). Pure + dependency-free so it is independently
 * unit-testable.
 */

import type { WaveScale } from "./waveScaling.ts";

/** Stages per chapter (biome band). Mirrors `STAGES_PER_CHAPTER` in chapters.ts. */
export const STAGES_PER_CHAPTER = 5;

/** Compounding HP growth per stage. 0.08 ⇒ ×1.08 HP each stage. */
export const PROG_HP_PER_STAGE = 0.08;
/** Compounding atk growth per stage. 0.04 ⇒ ×1.04 atk each stage. */
export const PROG_ATK_PER_STAGE = 0.04;
/** Extra compounding HP step at every new chapter ("wall"). 0.30 ⇒ ×1.30. */
export const PROG_HP_PER_CHAPTER = 0.3;
/** Extra compounding atk step at every new chapter. 0.14 ⇒ ×1.14. */
export const PROG_ATK_PER_CHAPTER = 0.14;

/**
 * Progression multipliers for an enemy spawned in the `stageN`-th stage (1-based,
 * global across chapters). Applies to ALL enemies including bosses — cross-chapter
 * growth should lift bosses too; only the intra-stage frac ramp is boss-exempt.
 *
 * stage 1 ⇒ ×1.0 (the authored baseline). Geometric per-stage growth, plus a
 * discrete step at each chapter boundary.
 */
export function progressionScaling(stageN: number): WaveScale {
  const idx = Math.max(1, Math.floor(stageN)) - 1; // 0-based global step
  const chapters = Math.floor(idx / STAGES_PER_CHAPTER);
  return {
    hpMult: (1 + PROG_HP_PER_STAGE) ** idx * (1 + PROG_HP_PER_CHAPTER) ** chapters,
    atkMult: (1 + PROG_ATK_PER_STAGE) ** idx * (1 + PROG_ATK_PER_CHAPTER) ** chapters,
  };
}
