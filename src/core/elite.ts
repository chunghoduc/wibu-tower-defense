import type { Stats } from "../data/schema.ts";
import type { Rng } from "./rng.ts";

/**
 * Elite enemies (T17). Any non-boss spawn has a small chance to be promoted to
 * an "elite": dramatically tougher stats, 1.5× size with a pulsing aura, and a
 * GUARANTEED loot box on death whose rarity is weighted toward Common (Unique
 * is very rare). Bosses are never made elite — they are already special.
 */

/** Per-spawn chance a normal enemy is promoted to an elite. */
export const ELITE_SPAWN_CHANCE = 0.05;

/** Visual scale-up vs a normal enemy (the spec's "150% bigger"). */
export const ELITE_SIZE_MULT = 1.5;

/** Bounty (gold) multiplier for killing an elite. */
export const ELITE_BOUNTY_MULT = 4;

/**
 * Dramatic all-round stat boost applied on top of difficulty scaling. Survival
 * stats get the biggest jump (a beefy mini-boss); move speed is bumped only
 * slightly so elites stay catchable.
 */
export const ELITE_MULT = {
  maxHp: 5,
  atk: 2.6,
  attackSpeed: 1.3,
  armor: 2.5,
  magicResist: 2.5,
  moveSpeed: 1.15,
} as const;

/** Return a NEW Stats object with the elite multipliers applied. */
export function applyEliteBoost(stats: Stats): Stats {
  return {
    ...stats,
    maxHp: stats.maxHp * ELITE_MULT.maxHp,
    atk: stats.atk * ELITE_MULT.atk,
    attackSpeed: stats.attackSpeed * ELITE_MULT.attackSpeed,
    armor: stats.armor * ELITE_MULT.armor,
    magicResist: stats.magicResist * ELITE_MULT.magicResist,
    moveSpeed: stats.moveSpeed * ELITE_MULT.moveSpeed,
  };
}

/**
 * Weighted box-tier table for an elite kill (tier 1..5 = Common..Unique).
 * Heavily skewed to Common; Unique is a 1-in-100 jackpot.
 */
const ELITE_BOX_WEIGHTS: ReadonlyArray<readonly [tier: number, weight: number]> = [
  [1, 60], // Common
  [2, 25], // Magic
  [3, 10], // Rare
  [4, 4], //  Legendary
  [5, 1], //  Unique
];

/** Roll the rarity tier (1..5) of the box an elite drops on death. */
export function rollEliteBoxTier(rng: Rng): number {
  const total = ELITE_BOX_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [tier, weight] of ELITE_BOX_WEIGHTS) {
    if (roll < weight) return tier;
    roll -= weight;
  }
  return 1;
}
