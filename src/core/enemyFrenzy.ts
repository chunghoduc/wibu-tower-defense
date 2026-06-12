/**
 * Pure frenzy math for Berserker enemies (e.g. the Bloodmad Reaver). A frenzy is
 * a one-way latch — once HP falls below the threshold the enemy stays frenzied
 * (mirrors boss enrage), gaining move-speed and attack multipliers.
 */
import type { EnemySpecial } from "../data/schema.ts";

/** True when a frenzy-capable enemy should latch into frenzy at this HP fraction. */
export function shouldFrenzy(
  special: EnemySpecial | undefined,
  hpFrac: number,
  already: boolean,
): boolean {
  const f = special?.frenzy;
  if (!f || already) return false;
  return hpFrac <= f.belowHpPct;
}

/** Speed/atk multipliers from an active frenzy; neutral {1,1} when inactive or absent. */
export function frenzyMods(
  special: EnemySpecial | undefined,
  frenzied: boolean,
): { speedMult: number; atkMult: number } {
  const f = special?.frenzy;
  if (!f || !frenzied) return { speedMult: 1, atkMult: 1 };
  return { speedMult: f.speedMult, atkMult: f.atkMult };
}
