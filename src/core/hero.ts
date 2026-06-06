import type { HeroSave } from "./save.ts";

export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 90) return Math.floor(100 * Math.pow(level, 1.8));
  const base90 = Math.floor(100 * Math.pow(90, 1.8));
  const inc90 = base90 - Math.floor(100 * Math.pow(89, 1.8));
  let total = base90;
  for (let n = 91; n <= level; n++) {
    total += Math.floor(inc90 * Math.pow(10, n - 90));
  }
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
