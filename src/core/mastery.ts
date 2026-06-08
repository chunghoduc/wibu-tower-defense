/**
 * F6 — Tower Mastery. Each tower banks mastery XP from kills *while deployed*;
 * mastery levels (soft cap 10) grant a small permanent +% atk/hp to that tower.
 * Loop: Meta (earned in Run). Bartle: Achiever/Explorer — rewards maining favorites.
 *
 * Numbers: lvl10 ≈ +20% atk/hp (≈ one star), reached only through heavy use. XP
 * curve is power-shaped (a·n^1.6) so early levels come fast, later ones are a grind.
 */
import type { HeroSave } from "./save.ts";

export const MASTERY_MAX_LEVEL = 10;
/** Mastery XP granted to each deployed tower per enemy killed during the battle. */
export const MASTERY_XP_PER_KILL = 4;
/** Per-level permanent bonus (atk & hp). lvl10 → +20%. */
export const MASTERY_BONUS_PER_LEVEL = 0.02;

/** Cumulative XP required to REACH a given mastery level (level 1 = 0). */
export function masteryXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 1.6));
}

/** Mastery level implied by an XP total (clamped to the soft cap). */
export function masteryLevelFromXp(xp: number): number {
  let level = 1;
  while (level < MASTERY_MAX_LEVEL && xp >= masteryXpForLevel(level + 1)) level++;
  return level;
}

export function getMasteryLevel(save: HeroSave, towerId: string): number {
  return save.meta.mastery[towerId]?.level ?? 1;
}

export function getMasteryXp(save: HeroSave, towerId: string): number {
  return save.meta.mastery[towerId]?.xp ?? 0;
}

/** Permanent stat multiplier from a tower's mastery level (atk & hp share it). */
export function masteryStatMul(level: number): number {
  return 1 + MASTERY_BONUS_PER_LEVEL * (level - 1);
}

export interface MasteryGain {
  level: number;
  leveledUp: boolean;
}

/** Add mastery XP to a tower, recomputing its level (capped). Mutates the save. */
export function addMasteryXp(save: HeroSave, towerId: string, amount: number): MasteryGain {
  const entry = save.meta.mastery[towerId] ?? { xp: 0, level: 1 };
  const beforeLevel = entry.level;
  entry.xp += amount;
  entry.level = masteryLevelFromXp(entry.xp);
  save.meta.mastery[towerId] = entry;
  return { level: entry.level, leveledUp: entry.level > beforeLevel };
}
