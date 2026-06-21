// src/core/activeDamage.ts
//
// THE active-skill burst formula — shared by the battle sim (battleDamage.castActive)
// and every display (skillDamage / skillDescribe / SkillsScene) so the number a
// player reads is exactly the number the cast deals.
//
//   additive = powerMult × BASE_FLAT  +  powerMult × atkCoef(type) × atk
//   burst    = additive × spellPowerMult(type, skillPower)  +  defBonus
//
// Design (see docs/superpowers/specs/2026-06-22-active-damage-…):
//   • ATK is ADDITIVE — it is the "+ x% of ATK" term inside the parenthesis.
//   • SPELL POWER (the `skillPower` stat) is MULTIPLICATIVE and TYPE-GATED:
//     Physical actives CANNOT use it (×1 always); Magic actives live on it; True
//     is the hybrid.
//   • So Physical skills are strongest with ATK, Magic skills strongest with spell
//     power, True scales with both.
//
// Pure / declarative; imports only the `DamageType` type, so there are no cycles.
import type { DamageType } from "../data/schema.ts";

/**
 * ATK coefficient per damage type — the slope of the additive `atkCoef × ATK`
 * term, i.e. the "x% of ATK" inside the parenthesis.
 *
 * Physical's x (1.5) MASSIVELY exceeds Magic/True's y (0.18 / 0.35): a physical
 * cast lives on ATK, while ATK is nearly a rounding error on a magic cast — which
 * instead rides spell power (see ACTIVE_SPELL_GAIN). True is the hybrid in between.
 */
export const ACTIVE_ATK_COEF: Record<DamageType, number> = {
  Physical: 1.5, // x — heavy ATK reliance
  True: 0.35, // hybrid, low ATK
  Magic: 0.18, // y — tiny ATK; magic lives on spell power
};

/**
 * How strongly SPELL POWER multiplies a cast, per type: the burst is multiplied
 * by `1 + (skillPower − 1) × gain`. Physical is 0 → the multiplier is locked to
 * ×1 (it cannot use the stat, it lives on ATK). Magic gets the dominant payoff
 * (3.0) so a built caster's burst is mostly spell power; True is the hybrid (1.6).
 */
export const ACTIVE_SPELL_GAIN: Record<DamageType, number> = {
  Physical: 0,
  True: 1.6,
  Magic: 3.0,
};

/**
 * Flat base damage per unit of `powerMult` — the "base damage" floor so a 0-ATK
 * cast still does something. Small versus a built hero's ATK term.
 */
export const ACTIVE_BASE_FLAT = 18;

/**
 * The spell-power multiplier a cast of `type` earns from a `skillPower` stat.
 * Always ≥1 (a cast is never *reduced*), exactly 1 for Physical and for any
 * un-invested caster (skillPower ≤ 1).
 */
export function spellPowerMult(type: DamageType, skillPower: number): number {
  const sp = Math.max(1, skillPower);
  return 1 + (sp - 1) * ACTIVE_SPELL_GAIN[type];
}

export interface ActiveBurstInput {
  /** Caster ATK fed to the cast (hero or hero-shared tower ATK). */
  atk: number;
  /** Caster `skillPower` stat (raw; clamped to ≥1 internally). */
  skillPower: number;
  /** `P` — the skill's level-scaled intensity (`effectivePower / ANCHOR`); towers use 2. */
  powerMult: number;
  damageType: DamageType;
  /** Tanker `defenseScale` conversion (armor/MR/maxHP → damage); added FLAT, post-multiplier. */
  defBonus?: number;
}

/**
 * Pre-mitigation burst dealt to each enemy in a cast's splash. Single source of
 * truth — every display recomputes the same value from the same inputs.
 */
export function activeBurst(i: ActiveBurstInput): number {
  const additive =
    i.powerMult * ACTIVE_BASE_FLAT + i.powerMult * ACTIVE_ATK_COEF[i.damageType] * i.atk;
  return additive * spellPowerMult(i.damageType, i.skillPower) + (i.defBonus ?? 0);
}
