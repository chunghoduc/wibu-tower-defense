import type { Difficulty } from "../data/schema.ts";
import { rollItemDrop, itemLevelForStage } from "./itemDrop.ts";
import { rollJewelDrop } from "./jewelDrop.ts";
import { ACTIVE_SKILLS } from "../data/skills.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import { Rng } from "./rng.ts";
import { BLESS_JEWEL, SOUL_JEWEL, SUMMON_SCROLL, OBLIVION_ORB, boxIdForTier } from "../data/materials.ts";
import { boxTierForStage } from "../data/stage.ts";
import type { HeroSave, ItemInstanceSave, JewelInstanceSave } from "./save.ts";

export const CRYSTAL_REWARD: Record<Difficulty, number> = {
  Normal: 20,
  Hard: 30,
  Nightmare: 50,
};
const FIRST_CLEAR_BONUS = 50;
const ITEM_DROP_CHANCE = 0.30;
const SKILL_DROP_CHANCE = 0.15;
const CHARACTER_DROP_CHANCE = 0.05;
const JEWEL_DROP_CHANCE = 0.12;

export interface DropResult {
  crystalsAwarded: number;
  itemDropped: ItemInstanceSave | null;
  skillDropped: string | null;
  characterDropped: string | null;
  jewelDropped: JewelInstanceSave | null;
  isFirstClear: boolean;
  /** Enhance jewels (+ later boxes) gained this clear, by material id (T13/T15). */
  materialsDropped: Record<string, number>;
}

// Every stage clear kills that stage's boss, so jewels drop from a win.
const BLESS_DROP_CHANCE = 0.5;   // a clear usually yields a Bless jewel
const SOUL_DROP_CHANCE = 0.15;   // Soul jewels are rarer (for high enhances)
const SCROLL_DROP_CHANCE = 0.05; // Summoning Scrolls are a rare boss drop
const ORB_DROP_CHANCE = 0.02;    // Oblivion Orbs (passive-tree respec) are very rare

/**
 * Roll a dropped chest's rarity tier (1..5) around the stage's `base`: usually
 * the base, with a chance to upgrade one (or rarely two) rarities for a bigger
 * reward, and a small chance to be one lower. Difficulty skews the odds upward.
 */
function rollBoxTier(base: number, diffBonus: number, rng: Rng): number {
  const up = 0.2 + diffBonus * 1.5; // chance to roll a better rarity
  const r = rng.next();
  if (r < up * 0.22) return Math.min(5, base + 2);
  if (r < up) return Math.min(5, base + 1);
  if (r > 0.88) return Math.max(1, base - 1);
  return base;
}
// Boss chest: guaranteed the FIRST time you beat a stage+difficulty, then a rare
// bonus on repeat farming so the box stays a meaningful first-clear reward (T15).
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

  const crystalsAwarded = CRYSTAL_REWARD[difficulty] + (isFirstClear ? FIRST_CLEAR_BONUS : 0);
  save.currency.crystals += crystalsAwarded;

  const itemLevel = itemLevelForStage(stageId);

  let itemDropped: ItemInstanceSave | null = null;
  if (rng.next() < ITEM_DROP_CHANCE) {
    itemDropped = rollItemDrop(save, itemLevel, rng);
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
  if (rng.next() < JEWEL_DROP_CHANCE) {
    jewelDropped = rollJewelDrop(save, rng);
  }

  let characterDropped: string | null = null;
  if (rng.next() < CHARACTER_DROP_CHANCE) {
    const pool = TOWERS.filter(
      (t) => (t.rarity === "Common" || t.rarity === "Magic") && !(t.id in save.collection)
    );
    if (pool.length > 0) {
      const char = pool[Math.floor(rng.next() * pool.length)];
      addTowerToCollection(save, char.id);
      characterDropped = char.id;
    }
  }

  // Enhance jewels (T13). Scale a touch with difficulty.
  const materialsDropped: Record<string, number> = {};
  const giveMat = (id: string, n: number) => {
    save.materials[id] = (save.materials[id] ?? 0) + n;
    materialsDropped[id] = (materialsDropped[id] ?? 0) + n;
  };
  const diffBonus = difficulty === "Nightmare" ? 0.2 : difficulty === "Hard" ? 0.1 : 0;
  if (rng.next() < BLESS_DROP_CHANCE + diffBonus) giveMat(BLESS_JEWEL, 1);
  if (rng.next() < SOUL_DROP_CHANCE + diffBonus) giveMat(SOUL_JEWEL, 1);
  // Boss chest (T15): 100% on first clear of this stage+difficulty, then a rare
  // bonus on repeats. Its RARITY tier is rolled around the stage's base — usually
  // the base, sometimes higher (bigger reward) or lower; difficulty skews it up.
  if (isFirstClear || rng.next() < BOX_REPEAT_CHANCE + diffBonus) {
    giveMat(boxIdForTier(rollBoxTier(boxTierForStage(stageId), diffBonus, rng)), 1);
  }
  // Rare Summoning Scroll — only the stage boss drops it.
  if (rng.next() < SCROLL_DROP_CHANCE + diffBonus * 0.5) giveMat(SUMMON_SCROLL, 1);
  // Very rare Oblivion Orb — a full passive-tree respec consumable.
  if (rng.next() < ORB_DROP_CHANCE + diffBonus * 0.25) giveMat(OBLIVION_ORB, 1);

  return { crystalsAwarded, itemDropped, skillDropped, characterDropped, jewelDropped, isFirstClear, materialsDropped };
}
