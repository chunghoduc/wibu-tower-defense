/**
 * skillDamage — the single source of truth for "what does this hero skill hit
 * for", shared by the Skills screen and (by construction) the battle sim.
 *
 * The in-battle cast (battleDamage.ts `castActive`) deals, to every enemy in
 * splash, the pre-mitigation burst from `activeBurst` (activeDamage.ts):
 *
 *     burst = (powerMult×BASE_FLAT + powerMult×atkCoef×atk) × spellPowerMult
 *
 * ATK is ADDITIVE; spell power MULTIPLIES (Magic/True only). `atk`/`skillPower`
 * come from `resolveHeroBattleStats` and `powerMult` from `heroActiveBurst`. This
 * module recomputes that same number from the same functions, so anything the UI
 * displays is exactly what the cast applies.
 */
import type { HeroSave } from "./save.ts";
import type { DamageType, Stats } from "../data/schema.ts";
import { resolveHeroBattleStats } from "./heroStats.ts";
import { defaultHeroStats } from "../data/stage.ts";
import { skillEffectivePower, ACTIVE_POWER_ANCHOR } from "./hero.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import { activeBurst, spellPowerMult, ACTIVE_ATK_COEF } from "./activeDamage.ts";

export interface SkillDamageInfo {
  /** The skill's level-aware intensity P = effectivePower / ANCHOR (drives base + ATK term). */
  mult: number;
  /** Resolved hero ATK fed to the cast — the same value the sim passes (pre aura buffs). */
  atk: number;
  /** Resolved hero skillPower, clamped exactly as the sim does (`max(1, …)`). */
  skillPower: number;
  /** This type's ATK coefficient (the slope of the additive ATK term). */
  atkCoef: number;
  /** Spell-power multiplier applied to this cast — exactly 1 for Physical. */
  spellMult: number;
  /** Pre-mitigation burst dealt to each enemy in splash (via `activeBurst`). */
  burst: number;
  /** The skill's own damage type (the only path to a True/Magic burst from a physical hero). */
  damageType: DamageType;
}

/**
 * The skill's intrinsic, level-aware ATK multiplier. Power 100 == the legacy ×2,
 * so `mult = effectivePower / 50`. Independent of the hero — pure catalog math.
 */
export function skillAtkMult(basePower: number, skillLevel: number): number {
  return skillEffectivePower(basePower, skillLevel) / ACTIVE_POWER_ANCHOR;
}

/**
 * Resolve exactly what `skillId` would hit for if cast by this hero right now.
 * Mirrors the sim formula so the Skills screen and the battle never disagree.
 */
export function heroSkillDamage(
  save: HeroSave,
  skillId: string,
  base: Stats = defaultHeroStats(),
): SkillDamageInfo {
  const def = ACTIVE_SKILLS_MAP.get(skillId)!;
  const level = save.hero.obtainedSkills.find((e) => e.skillId === skillId)?.level ?? 0;
  const { stats } = resolveHeroBattleStats(save, base);
  const mult = skillAtkMult(def.basePower, level);
  const skillPower = Math.max(1, stats.skillPower);
  return {
    mult,
    atk: stats.atk,
    skillPower,
    atkCoef: ACTIVE_ATK_COEF[def.damageType],
    spellMult: spellPowerMult(def.damageType, skillPower),
    burst: activeBurst({
      atk: stats.atk,
      skillPower,
      powerMult: mult,
      damageType: def.damageType,
    }),
    damageType: def.damageType,
  };
}
