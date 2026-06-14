/**
 * Pure view-model for the AchievementScene: groups the catalog by category (in
 * CATEGORY_ORDER), computes per-card progress/unlocked/frac, and totals. The
 * scene consumes this and never recomputes progress. Phaser-free + unit-tested.
 */
import type { HeroSave } from "./save.ts";
import { isAchievementUnlocked } from "./achievements.ts";
import {
  ACHIEVEMENTS,
  CATEGORY_ORDER,
  achievementRewardLabel,
  type AchievementCategory,
  type AchievementDef,
} from "../data/achievements.ts";

export interface AchievementCardVM {
  id: string;
  name: string;
  description: string;
  rewardLabel: string;
  current: number;
  target: number;
  /** Progress fraction, clamped to 0..1. */
  frac: number;
  unlocked: boolean;
}

export interface AchievementGroupVM {
  category: AchievementCategory;
  cards: AchievementCardVM[];
}

export interface AchievementViewVM {
  groups: AchievementGroupVM[];
  unlocked: number;
  total: number;
}

function cardOf(def: AchievementDef, save: HeroSave): AchievementCardVM {
  const { current, target } = def.progress(save);
  const unlocked = isAchievementUnlocked(def, save);
  const frac = target <= 0 ? 0 : Math.max(0, Math.min(1, current / target));
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    rewardLabel: achievementRewardLabel(def.reward),
    current,
    target,
    frac,
    unlocked,
  };
}

export function buildAchievementView(save: HeroSave): AchievementViewVM {
  const groups: AchievementGroupVM[] = [];
  let unlocked = 0;
  for (const category of CATEGORY_ORDER) {
    const cards = ACHIEVEMENTS.filter((a) => a.category === category).map((a) => cardOf(a, save));
    if (cards.length === 0) continue;
    unlocked += cards.filter((c) => c.unlocked).length;
    groups.push({ category, cards });
  }
  return { groups, unlocked, total: ACHIEVEMENTS.length };
}
