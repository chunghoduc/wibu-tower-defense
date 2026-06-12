import type { Difficulty } from "../data/schema.ts";
import { rollItemDrop, itemLevelForStage, chapterLevelRange } from "./itemDrop.ts";
import { rollJewelDrop } from "./jewelDrop.ts";
import { ACTIVE_SKILLS } from "../data/skills.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import { type Rng } from "./rng.ts";
import {
  BLESS_JEWEL,
  SOUL_JEWEL,
  SUMMON_SCROLL,
  OBLIVION_ORB,
  boxIdForTier,
} from "../data/materials.ts";
import { boxTierForStage, stageNumber } from "../data/stage.ts";
import type { HeroSave, ItemInstanceSave, JewelInstanceSave } from "./save.ts";
import { incrementQuestKey } from "./questTracker.ts";
import { incrementBountyEvent } from "./bounties.ts";
import { isoWeekKey } from "./meta.ts";

/** Gold awarded per difficulty on stage clear (primary progression currency). */
export const GOLD_REWARD: Record<Difficulty, number> = {
  Normal: 400,
  Hard: 650,
  Nightmare: 1000,
};
const FIRST_CLEAR_GOLD_BONUS = 200;

/**
 * Depth bonus: gold scales with the global stage number so deeper chapters pay
 * strictly more (gold was previously flat per difficulty, so depth didn't pay).
 * 0.06 ⇒ +6% per stage — stage 1 ×1.0, stage 10 ×1.54, stage 20 ×2.14.
 */
export const GOLD_DEPTH_PER_STAGE = 0.06;

/** Multiplier applied to a stage-clear's gold for its depth (global stage no.). */
export function goldDepthMultiplier(stageId: string): number {
  return 1 + Math.max(0, stageNumber(stageId) - 1) * GOLD_DEPTH_PER_STAGE;
}

/**
 * Diamonds awarded per stage clear. Scales gently with stage number so later
 * stages are worth more; earlier stages are cheaper so new players accumulate
 * slowly — diamonds gate summons and high-rarity shop items, not progression.
 * Formula: base(difficulty) + stageIndex * 2, capped to keep early-game sparse.
 */
export const DIAMOND_BASE: Record<Difficulty, number> = { Normal: 3, Hard: 6, Nightmare: 10 };
const DIAMOND_PER_STAGE = 2;
const FIRST_CLEAR_DIAMOND_BONUS = 5;

const ITEM_DROP_CHANCE = 0.3;
const SKILL_DROP_CHANCE = 0.15;
const CHARACTER_DROP_CHANCE = 0.05;
const JEWEL_DROP_CHANCE = 0.12;

export interface DropResult {
  goldAwarded: number;
  diamondsAwarded: number;
  itemDropped: ItemInstanceSave | null;
  skillDropped: string | null;
  characterDropped: string | null;
  jewelDropped: JewelInstanceSave | null;
  isFirstClear: boolean;
  /** Materials gained this clear, by material id. */
  materialsDropped: Record<string, number>;
}

// Every stage clear defeats its boss.
const BLESS_DROP_CHANCE = 0.5;
const SOUL_DROP_CHANCE = 0.15;
const SCROLL_DROP_CHANCE = 0.05;
const ORB_DROP_CHANCE = 0.02;

function rollBoxTier(base: number, diffBonus: number, rng: Rng): number {
  const up = 0.2 + diffBonus * 1.5;
  const r = rng.next();
  if (r < up * 0.22) return Math.min(5, base + 2);
  if (r < up) return Math.min(5, base + 1);
  if (r > 0.88) return Math.max(1, base - 1);
  return base;
}
const BOX_REPEAT_CHANCE = 0.08;

export function processStageClear(
  save: HeroSave,
  stageId: string,
  difficulty: Difficulty,
  rng: Rng,
): DropResult {
  if (!save.progress.stageClearMap[stageId]) {
    save.progress.stageClearMap[stageId] = { Normal: false, Hard: false, Nightmare: false };
  }
  const isFirstClear = !save.progress.stageClearMap[stageId][difficulty];
  save.progress.stageClearMap[stageId][difficulty] = true;

  const today = new Date().toISOString().slice(0, 10);
  incrementQuestKey(save, "clear_stages", 1, today);
  if (difficulty !== "Normal") incrementQuestKey(save, "clear_hard", 1, today);
  incrementBountyEvent(save, "clear", 1, isoWeekKey(new Date()));
  save.meta.profile.lifetimeClears += 1; // F16 profile lifetime tally

  // Gold — primary currency from stage clears. Scaled by stage depth so deeper
  // chapters pay more (the base table is flat per difficulty).
  const goldBase = GOLD_REWARD[difficulty] + (isFirstClear ? FIRST_CLEAR_GOLD_BONUS : 0);
  const goldAwarded = Math.round(goldBase * goldDepthMultiplier(stageId));
  save.currency.gold += goldAwarded;

  // Diamonds — premium currency, scales with stage number so late-game earns more.
  const idx = Math.max(0, stageNumber(stageId) - 1);
  const diamondsAwarded =
    DIAMOND_BASE[difficulty] +
    idx * DIAMOND_PER_STAGE +
    (isFirstClear ? FIRST_CLEAR_DIAMOND_BONUS : 0);
  save.currency.diamonds += diamondsAwarded;

  const itemLevel = itemLevelForStage(stageId);
  const band = chapterLevelRange(stageId);

  let itemDropped: ItemInstanceSave | null = null;
  if (rng.next() < ITEM_DROP_CHANCE) {
    itemDropped = rollItemDrop(save, itemLevel, rng, true, band);
  }

  let skillDropped: string | null = null;
  if (rng.next() < SKILL_DROP_CHANCE) {
    const ownedSkills = new Set(save.hero.obtainedSkills.map((s) => s.skillId));
    const available = ACTIVE_SKILLS.filter((s) => !ownedSkills.has(s.id));
    if (available.length > 0) {
      const skill = available[Math.floor(rng.next() * available.length)];
      save.hero.obtainedSkills.push({ skillId: skill.id, level: 1, useXp: 0 });
      skillDropped = skill.id;
    }
  }

  let jewelDropped: JewelInstanceSave | null = null;
  if (rng.next() < JEWEL_DROP_CHANCE) jewelDropped = rollJewelDrop(save, rng);

  let characterDropped: string | null = null;
  if (rng.next() < CHARACTER_DROP_CHANCE) {
    const pool = TOWERS.filter(
      (t) => (t.rarity === "Common" || t.rarity === "Magic") && !(t.id in save.collection),
    );
    if (pool.length > 0) {
      const char = pool[Math.floor(rng.next() * pool.length)];
      addTowerToCollection(save, char.id);
      characterDropped = char.id;
    }
  }

  const materialsDropped: Record<string, number> = {};
  const giveMat = (id: string, n: number) => {
    save.materials[id] = (save.materials[id] ?? 0) + n;
    materialsDropped[id] = (materialsDropped[id] ?? 0) + n;
  };
  const diffBonus = difficulty === "Nightmare" ? 0.2 : difficulty === "Hard" ? 0.1 : 0;
  if (rng.next() < BLESS_DROP_CHANCE + diffBonus) giveMat(BLESS_JEWEL, 1);
  if (rng.next() < SOUL_DROP_CHANCE + diffBonus) giveMat(SOUL_JEWEL, 1);
  if (isFirstClear || rng.next() < BOX_REPEAT_CHANCE + diffBonus) {
    giveMat(boxIdForTier(rollBoxTier(boxTierForStage(stageId), diffBonus, rng)), 1);
  }
  if (rng.next() < SCROLL_DROP_CHANCE + diffBonus * 0.5) giveMat(SUMMON_SCROLL, 1);
  if (rng.next() < ORB_DROP_CHANCE + diffBonus * 0.25) giveMat(OBLIVION_ORB, 1);

  return {
    goldAwarded,
    diamondsAwarded,
    itemDropped,
    skillDropped,
    characterDropped,
    jewelDropped,
    isFirstClear,
    materialsDropped,
  };
}
