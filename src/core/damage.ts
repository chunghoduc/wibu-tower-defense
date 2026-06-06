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

/** Roll an attack's raw damage, applying crit. Returns the pre-mitigation amount. */
export function rollAttackDamage(attacker: Stats, didCrit: boolean): number {
  const base = Math.max(0, attacker.atk);
  return didCrit ? base * Math.max(1, attacker.critDamage) : base;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
