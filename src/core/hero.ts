import type { HeroSave } from "./save.ts";
import type { DamageType } from "../data/schema.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";

/** Per-level XP cost of the original smooth curve (100 · L^1.8). */
function baseLevelCost(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.8)) - Math.floor(100 * Math.pow(level - 1, 1.8));
}

/**
 * Rebalanced per-level XP cost:
 *  - Levels 2–20: discounted (ramping ~40% → 100% of base) so early play is fast.
 *  - Levels 21–39: unchanged — identical cost to the original curve.
 *  - Levels 40+: scaled up ~5%/level (capped ×2.5) so the late game bites harder.
 */
function levelCost(level: number): number {
  const base = baseLevelCost(level);
  if (level <= 20) {
    const t = (level - 2) / 18; // 0 at L2 → 1 at L20
    return Math.floor(base * (0.4 + 0.6 * t));
  }
  if (level <= 39) return base;
  return Math.floor(base * Math.min(2.0, 1 + 0.04 * (level - 39)));
}

// Memoize cumulative thresholds (levels are bounded 1–100, so this is O(1) after warmup).
const _totalXpCache: number[] = [0, 0];

export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (_totalXpCache[level] !== undefined) return _totalXpCache[level];
  // 90+ keeps the original exponential soft-cap wall, anchored to the new L89 cost.
  const inc = level <= 89 ? levelCost(level) : Math.floor(levelCost(89) * Math.pow(10, level - 89));
  const total = totalXpForLevel(level - 1) + inc;
  _totalXpCache[level] = total;
  return total;
}

export function levelFromTotalXp(totalXp: number): number {
  for (let lvl = 100; lvl >= 1; lvl--) {
    if (totalXp >= totalXpForLevel(lvl)) return lvl;
  }
  return 1;
}

export function xpToNextLevel(currentLevel: number, totalXp: number): number {
  if (currentLevel >= 100) return 0;
  return totalXpForLevel(currentLevel + 1) - totalXp;
}

export function skillXpToLevel(skillLevel: number): number {
  return Math.floor(10 * Math.pow(skillLevel, 1.5));
}

export function skillEffectivePower(basePower: number, skillLevel: number): number {
  return basePower * (1 + 0.05 * skillLevel);
}

/** Power 100 == the legacy ×2 burst baseline (so `mult = effectivePower / 50`). */
export const ACTIVE_POWER_ANCHOR = 50;

/**
 * Resolves the hero's *equipped* active skill into the burst it should actually
 * deal: `burst = atk × mult × skillPower`.
 *
 * `mult` is the skill's effective power — its authored `basePower` scaled by the
 * skill's level (the same "Power" number the Skills screen shows) — normalised so
 * Power 100 equals the legacy flat ×2. This is what makes the cast reflect the
 * skill the hero equipped: a higher-`basePower` skill, or a more-levelled one,
 * hits harder, and the skill's own `damageType` applies (the only path to a
 * True/Magic burst from a physical-weapon hero). Falls back to the legacy ×2 and
 * the hero's weapon damage type when no skill is equipped or the id is unknown.
 */
export function heroActiveBurst(
  save: HeroSave,
): { skillId?: string; mult: number; damageType?: DamageType } {
  const skillId = save.hero.equippedSkillIds[0];
  const def = skillId ? ACTIVE_SKILLS_MAP.get(skillId) : undefined;
  if (!def) return { skillId, mult: 2 };
  const entry = save.hero.obtainedSkills.find((e) => e.skillId === skillId);
  const power = skillEffectivePower(def.basePower, entry?.level ?? 0);
  return { skillId, mult: power / ACTIVE_POWER_ANCHOR, damageType: def.damageType };
}

export function awardHeroXp(save: HeroSave, amount: number): void {
  const prevLevel = save.hero.level;
  save.hero.totalXp += amount;
  const newLevel = Math.min(100, levelFromTotalXp(save.hero.totalXp));
  const levelsGained = newLevel - prevLevel;
  if (levelsGained > 0) {
    save.hero.level = newLevel;
    save.hero.skillPoints += levelsGained;
  }
}

export function awardSkillUseXp(save: HeroSave, skillId: string): void {
  const entry = save.hero.obtainedSkills.find((s) => s.skillId === skillId);
  if (!entry) return;
  if (entry.level >= save.hero.level) return;
  entry.useXp += 1;
  const needed = skillXpToLevel(entry.level);
  if (entry.useXp >= needed) {
    entry.useXp = 0;
    entry.level = Math.min(entry.level + 1, save.hero.level);
  }
}
