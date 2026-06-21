/**
 * Effective tower combat numbers — base atk / attack-speed after the support-aura
 * buffs (buffAtkPct / buffAsPct) that the sim applies at the consumption site in
 * battleTowers.updateTowers(). The info panel uses this so a tower standing in a
 * support tower's aura SHOWS its boosted attack and attack-speed (and the cap is
 * honoured, so a buff that can't push past the ceiling is correctly not flagged).
 * Pure / Phaser-free / deterministic — mirrors the sim's own math.
 */
import { cappedAttackSpeed } from "./attackSpeedCap.ts";

export interface TowerCombat {
  /** Attack after aura buff: `baseAtk * (1 + buffAtkPct)`. */
  atk: number;
  /** Attack-speed after aura buff, clamped to the global cap (matches the sim). */
  attackSpeed: number;
  /** True when the aura actually raised attack (positive buff with a visible delta). */
  atkBuffed: boolean;
  /** True when the aura actually raised attack-speed (positive, not cap-swallowed). */
  asBuffed: boolean;
}

const EPS = 1e-6;

/**
 * Effective atk / attack-speed for a tower given its current aura buffs.
 * Mirrors `updateTowers`: `effAtk = atk*(1+buffAtkPct)` and
 * `effAs = cappedAttackSpeed(attackSpeed*(1+buffAsPct))`.
 */
export function effectiveTowerCombat(
  baseAtk: number,
  baseAttackSpeed: number,
  buffAtkPct: number,
  buffAsPct: number,
): TowerCombat {
  const atk = baseAtk * (1 + buffAtkPct);
  const attackSpeed = cappedAttackSpeed(baseAttackSpeed * (1 + buffAsPct));
  return {
    atk,
    attackSpeed,
    atkBuffed: buffAtkPct > 0 && atk > baseAtk + EPS,
    asBuffed: buffAsPct > 0 && attackSpeed > baseAttackSpeed + EPS,
  };
}
