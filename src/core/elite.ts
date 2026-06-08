import type { Immunity, Stats } from "../data/schema.ts";
import type { Rng } from "./rng.ts";

/**
 * Elite enemies (T17). At most ONE elite appears per battle, gated by a single
 * per-battle roll (ELITE_BATTLE_CHANCE). When it appears it is dramatically
 * tougher, 1.5× size with a pulsing aura, immune to EITHER physical OR magic
 * damage, takes a flat 50% less damage from everything else, and GUARANTEES a
 * loot box on death (rarity weighted toward Common; Unique is very rare).
 * Bosses are never made elite — they are already special.
 */

/** Chance that a given battle contains an elite (rolled once per battle). */
export const ELITE_BATTLE_CHANCE = 0.25;

/**
 * Flat damage reduction an elite gains. The damage pipeline applies the
 * defender's damageReduction as its FINAL step (after armor/resist), so folding
 * this into the elite's stats satisfies "reduction applied last". Combined
 * multiplicatively with any reduction the base enemy already had.
 */
export const ELITE_DAMAGE_REDUCTION = 0.5;

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

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Return a NEW Stats object with the elite multipliers + flat 50% reduction applied. */
export function applyEliteBoost(stats: Stats): Stats {
  return {
    ...stats,
    maxHp: stats.maxHp * ELITE_MULT.maxHp,
    atk: stats.atk * ELITE_MULT.atk,
    attackSpeed: stats.attackSpeed * ELITE_MULT.attackSpeed,
    armor: stats.armor * ELITE_MULT.armor,
    magicResist: stats.magicResist * ELITE_MULT.magicResist,
    moveSpeed: stats.moveSpeed * ELITE_MULT.moveSpeed,
    // Combine with any existing reduction so it never *lowers* a tankier base.
    damageReduction: 1 - (1 - clamp01(stats.damageReduction)) * (1 - ELITE_DAMAGE_REDUCTION),
  };
}

/**
 * The damage type an elite becomes immune to — Physical or Magic, 50/50. Only
 * granted to elites that have no innate immunity, so we never create a
 * physical-AND-magic-immune unit that only True damage can scratch.
 */
export function rollEliteImmunity(rng: Rng): Immunity {
  return rng.next() < 0.5 ? "Physical" : "Magic";
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
