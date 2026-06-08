import { DAILY_QUESTS, DAILY_QUESTS_MAP } from "../data/quests.ts";
import { SUMMON_SCROLL } from "../data/materials.ts";
import type { HeroSave } from "./save.ts";

const ALL_QUEST_IDS = DAILY_QUESTS.map((q) => q.id);
/** Diamonds awarded for completing (and claiming) every daily quest. */
export const ALL_BONUS_DIAMONDS = 50;

/**
 * Reset progress/claims if the date has changed (midnight rollover).
 * No-op when called on the same day.
 */
export function rolloverQuests(save: HeroSave, today: string): void {
  if (save.quests.date === today) return;
  save.quests.date = today;
  save.quests.progress = {};
  save.quests.claimed = [];
  save.quests.allClaimed = false;
}

/** Current progress count for a quest (0 if not yet started). */
export function getQuestProgress(save: HeroSave, questId: string): number {
  return save.quests.progress[questId] ?? 0;
}

/** True when a quest is complete but its reward has not been claimed yet. */
export function isQuestClaimable(save: HeroSave, questId: string): boolean {
  const def = DAILY_QUESTS_MAP.get(questId);
  if (!def) return false;
  return (save.quests.progress[questId] ?? 0) >= def.target && !save.quests.claimed.includes(questId);
}

/**
 * How many rewards the player can collect right now: one per completed-but-
 * unclaimed quest, plus one for the all-complete bonus if it's ready. Drives
 * the main-menu notification badge.
 */
export function claimableQuestCount(save: HeroSave): number {
  let n = ALL_QUEST_IDS.filter((id) => isQuestClaimable(save, id)).length;
  if (!save.quests.allClaimed && ALL_QUEST_IDS.every((id) => save.quests.claimed.includes(id))) n += 1;
  return n;
}

/**
 * Increment a quest counter by `amount`. No-op if the save's quest date
 * doesn't match `today` (prevents stale increments after midnight).
 * Progress is capped at the quest's target — no over-counting.
 */
export function incrementQuestKey(save: HeroSave, key: string, amount: number, today: string): void {
  if (save.quests.date !== today) return;
  const def = DAILY_QUESTS_MAP.get(key);
  if (!def) return;
  const current = save.quests.progress[key] ?? 0;
  save.quests.progress[key] = Math.min(def.target, current + amount);
}

/**
 * Claim the reward for a completed quest. Returns false if the quest is not
 * yet complete or has already been claimed. Mutates `save` (currency/materials).
 */
export function claimQuestReward(save: HeroSave, questId: string): boolean {
  const def = DAILY_QUESTS_MAP.get(questId);
  if (!def) return false;
  if ((save.quests.progress[questId] ?? 0) < def.target) return false;
  if (save.quests.claimed.includes(questId)) return false;

  save.quests.claimed.push(questId);
  if (def.reward.gold) save.currency.gold += def.reward.gold;
  if (def.reward.diamonds) save.currency.diamonds += def.reward.diamonds;
  if (def.reward.scroll) {
    save.materials[SUMMON_SCROLL] = (save.materials[SUMMON_SCROLL] ?? 0) + def.reward.scroll;
  }
  return true;
}

/**
 * Claim the 50-diamond all-quests-complete bonus. Returns false if not all
 * quests are claimed yet, or if the bonus was already collected today.
 */
export function claimAllBonus(save: HeroSave): boolean {
  if (save.quests.allClaimed) return false;
  if (!ALL_QUEST_IDS.every((id) => save.quests.claimed.includes(id))) return false;
  save.quests.allClaimed = true;
  save.currency.diamonds += ALL_BONUS_DIAMONDS;
  return true;
}
