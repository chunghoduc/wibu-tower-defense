/**
 * The canonical 24-stat system — the shared vocabulary for every combat entity
 * (hero, tower, enemy). Re-exported by `schema.ts`.
 */

/**
 * Every combat entity (hero, tower, enemy) is described by a subset of these.
 * Percentage-style stats (critRate, armorPen, damageReduction, omnivamp,
 * tenacity, goldFind) are expressed as fractions in [0, 1].
 */
export interface Stats {
  // Offense
  atk: number;
  attackSpeed: number; // attacks per second
  critRate: number; // 0..1
  critDamage: number; // crit multiplier, e.g. 1.5 = +50%
  range: number; // attack reach in world units
  armorPen: number; // 0..1 fraction of target armor ignored
  magicPen: number; // 0..1 fraction of target magic resist ignored
  skillPower: number; // amplifies active/ability damage (1.0 = baseline)

  // Defense / survival
  maxHp: number;
  hpRegen: number; // hp per second
  armor: number; // reduces Physical damage
  magicResist: number; // reduces Magic damage
  damageReduction: number; // 0..1 flat reduction applied to ALL damage incl. True
  critDefense: number; // 0..1 fraction of an incoming crit's BONUS damage negated
  tenacity: number; // 0..1 reduction of crowd-control duration

  // Resource (hero + towers)
  maxMana: number;
  manaRegen: number; // mana per second
  manaOnHit: number;
  manaOnKill: number;
  manaCostReduction: number; // 0..1

  // Sustain
  omnivamp: number; // 0..1 heal as fraction of damage dealt

  // Utility
  moveSpeed: number; // world units per second (static towers = 0)
  goldFind: number; // 0..1 bonus gold multiplier
}

/** A baseline Stats with everything zeroed — entities override what they use. */
export function defaultStats(): Stats {
  return {
    atk: 0,
    attackSpeed: 0,
    critRate: 0,
    critDamage: 1.5,
    range: 0,
    armorPen: 0,
    magicPen: 0,
    skillPower: 1,
    maxHp: 0,
    hpRegen: 0,
    armor: 0,
    magicResist: 0,
    damageReduction: 0,
    critDefense: 0,
    tenacity: 0,
    maxMana: 0,
    manaRegen: 0,
    manaOnHit: 0,
    manaOnKill: 0,
    manaCostReduction: 0,
    omnivamp: 0,
    moveSpeed: 0,
    goldFind: 0,
  };
}

/**
 * Stats that are already fractions / multipliers (crit chance, penetration, %
 * reductions, skill power…). On items these add FLAT and are NOT scaled by item
 * level (a level-40 item shouldn't turn a 12% crit base into 50%); scalar stats
 * like atk/hp do scale. Shared so item rolling and affix resolution agree.
 */
export const FRACTIONAL_STAT_KEYS = new Set<keyof Stats>([
  "critRate", "critDamage", "critDefense", "armorPen", "magicPen",
  "damageReduction", "tenacity", "omnivamp", "goldFind", "skillPower", "manaCostReduction",
]);

/** Build a Stats from partial overrides on top of the zeroed baseline. */
export function makeStats(overrides: Partial<Stats>): Stats {
  return { ...defaultStats(), ...overrides };
}
