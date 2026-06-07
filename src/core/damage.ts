/**
 * Damage resolution — the heart of the 3-damage-type system.
 *
 * - Physical is mitigated by armor (reduced by the attacker's armor penetration).
 * - Magic is mitigated by magic resist (reduced by magic penetration).
 * - True ignores both armor and magic resist.
 * - Damage Reduction is a flat fraction applied to ALL types, including True.
 *
 * Armor/resist use the standard partial-mitigation curve `r / (r + K)`, so a
 * stat never fully negates a damage type — consistent with the design's
 * "no hard-counter" rule.
 */
import type { DamageType, Stats } from "../data/schema.ts";

/** Constant in the armor/resist mitigation curve. Higher = armor matters less. */
export const MITIGATION_CONSTANT = 100;

export interface DamagePacket {
  amount: number;
  type: DamageType;
  /** Fraction of the target's armor ignored (0..1). */
  armorPen: number;
  /** Fraction of the target's magic resist ignored (0..1). */
  magicPen: number;
}

function curveMitigation(rating: number): number {
  if (rating <= 0) return 0;
  return rating / (rating + MITIGATION_CONSTANT);
}

/** Final damage a defender takes from a packet, never below 0. */
export function mitigatedDamage(packet: DamagePacket, defender: Stats): number {
  let dmg = Math.max(0, packet.amount);

  if (packet.type === "Physical") {
    const effArmor = defender.armor * (1 - clamp01(packet.armorPen));
    dmg *= 1 - curveMitigation(effArmor);
  } else if (packet.type === "Magic") {
    const effResist = defender.magicResist * (1 - clamp01(packet.magicPen));
    dmg *= 1 - curveMitigation(effResist);
  }
  // True: skips armor/resist entirely.

  dmg *= 1 - clamp01(defender.damageReduction);
  return Math.max(0, dmg);
}

/**
 * Effective crit multiplier after the defender's crit defense. `critDefense` is
 * the fraction (0..1) of the BONUS crit damage that is negated — the base hit
 * always lands; only the extra crit portion shrinks. So critDamage 2.0 vs
 * critDefense 0.5 yields 1 + (1.0 × 0.5) = 1.5× instead of 2.0×.
 */
export function critMultiplier(attackerCritDamage: number, defenderCritDefense: number): number {
  const bonus = Math.max(1, attackerCritDamage) - 1;
  return 1 + bonus * (1 - clamp01(defenderCritDefense));
}

/** Roll an attack's raw damage, applying crit (reduced by the defender's crit defense). */
export function rollAttackDamage(attacker: Stats, didCrit: boolean, defenderCritDefense = 0): number {
  const base = Math.max(0, attacker.atk);
  return didCrit ? base * critMultiplier(attacker.critDamage, defenderCritDefense) : base;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
