/**
 * Expedition quest board — pure logic over save.meta.expedition. The board holds
 * up to BOARD_SIZE quests; each is Available (assign spare towers that meet its
 * rarity slots), Running (locked for its duration), or Ready (claim a rolled,
 * rarity-scaled reward). Claiming frees the towers and refills the slot with a
 * fresh quest. A daily reroll rotates Available quests while preserving Running
 * ones. Phaser-free; every random decision flows through a seeded Rng.
 */
import type { HeroSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { grantReward, type Reward } from "./rewards.ts";
import { towerRarity } from "./collection.ts";
import {
  QUEST_TIERS,
  generateQuest,
  rarityRank,
  type QuestInstance,
} from "../data/expeditionQuests.ts";
import type { Rarity } from "../data/schemaEnums.ts";

export const BOARD_SIZE = 5;

/** Free board rerolls a player gets each UTC day. */
export const REROLL_PER_DAY = 5;

export type QuestState = "available" | "running" | "ready";

/** ISO yyyy-mm-dd for a given epoch ms (UTC — matches the rest of the meta loop). */
function dayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Refill the free-reroll counter when the UTC day rolls over. Pure, idempotent. */
function resetDailyRerolls(board: HeroSave["meta"]["expedition"], today: string): void {
  if (board.rerollDay !== today) {
    board.freeRerollsLeft = REROLL_PER_DAY;
    board.rerollDay = today;
  }
}

/** Mint the next unique quest id and bump the save's counter. */
function nextId(save: HeroSave): string {
  const seq = save.meta.expedition.nextQuestSeq++;
  return `xq${seq}`;
}

export function questState(q: QuestInstance, nowMs: number): QuestState {
  if (q.startedAt <= 0) return "available";
  return nowMs >= q.startedAt + q.durationMs ? "ready" : "running";
}

export function questRemainingMs(q: QuestInstance, nowMs: number): number {
  if (q.startedAt <= 0) return 0;
  return Math.max(0, q.startedAt + q.durationMs - nowMs);
}

/** All tower ids locked by Running quests right now. */
export function questAssignedTowerIds(save: HeroSave): Set<string> {
  const ids = new Set<string>();
  for (const q of save.meta.expedition.quests) {
    if (q.startedAt > 0) for (const id of q.assigned) ids.add(id);
  }
  return ids;
}

/**
 * Fill the board to BOARD_SIZE and, once per day, reroll every Available quest
 * (Running quests are preserved). Idempotent within the same day.
 */
export function ensureBoard(save: HeroSave, nowMs: number, rng: Rng): void {
  const board = save.meta.expedition;
  const today = dayKey(nowMs);
  resetDailyRerolls(board, today);
  if (board.lastRerollDay !== today) {
    board.quests = board.quests.filter((q) => q.startedAt > 0); // keep Running, drop Available
    board.lastRerollDay = today;
  }
  while (board.quests.length < BOARD_SIZE) board.quests.push(generateQuest(rng, nextId(save)));
}

/**
 * Player-driven board reroll: refill the daily counter if the day changed, then —
 * if a free reroll remains — drop every Available quest (Running ones survive),
 * refill to BOARD_SIZE with fresh quests, and spend one reroll. Returns false
 * (no-op) when none remain.
 */
export function rerollBoard(save: HeroSave, nowMs: number, rng: Rng): boolean {
  const board = save.meta.expedition;
  resetDailyRerolls(board, dayKey(nowMs));
  if (board.freeRerollsLeft <= 0) return false;
  board.quests = board.quests.filter((q) => q.startedAt > 0); // keep Running
  while (board.quests.length < BOARD_SIZE) board.quests.push(generateQuest(rng, nextId(save)));
  board.freeRerollsLeft--;
  return true;
}

/**
 * Owned towers eligible for a slot: not in the battle squad, not locked by
 * another Running quest, not already picked in this dialog, rarity ≥ the floor.
 */
export function eligibleTowersForSlot(
  save: HeroSave,
  slotRarity: string,
  alreadyPicked: string[],
): string[] {
  const squad = new Set(save.squad ?? []);
  const locked = questAssignedTowerIds(save);
  const picked = new Set(alreadyPicked);
  const floor = rarityRank(slotRarity as Rarity);
  return Object.keys(save.collection).filter(
    (id) =>
      !squad.has(id) &&
      !locked.has(id) &&
      !picked.has(id) &&
      rarityRank(towerRarity(id)) >= floor,
  );
}

/**
 * True if `towerIds` is a valid one-to-one assignment to `q.slots`: exact count,
 * all owned/eligible, and a matching where each tower meets its slot floor.
 * Greedy by descending slot floor is optimal because slots are pure min-gates.
 */
export function assignmentMeetsSlots(
  save: HeroSave,
  q: QuestInstance,
  towerIds: string[],
): boolean {
  if (towerIds.length !== q.slots.length) return false;
  if (new Set(towerIds).size !== towerIds.length) return false; // no dupes
  const squad = new Set(save.squad ?? []);
  const locked = questAssignedTowerIds(save);
  for (const id of towerIds) {
    if (!(id in save.collection)) return false;
    if (squad.has(id) || locked.has(id)) return false;
  }
  // Match hardest slots to strongest towers (both sorted desc); each must fit.
  const slots = [...q.slots].sort((a, b) => rarityRank(b) - rarityRank(a));
  const towers = [...towerIds].sort(
    (a, b) => rarityRank(towerRarity(b)) - rarityRank(towerRarity(a)),
  );
  for (let i = 0; i < slots.length; i++) {
    if (rarityRank(towerRarity(towers[i])) < rarityRank(slots[i])) return false;
  }
  return true;
}

/** Dispatch a quest: lock the towers and start its timer. No-op if invalid. */
export function startQuest(
  save: HeroSave,
  questId: string,
  towerIds: string[],
  nowMs: number,
): boolean {
  const q = save.meta.expedition.quests.find((x) => x.id === questId);
  if (!q || q.startedAt > 0) return false;
  if (!assignmentMeetsSlots(save, q, towerIds)) return false;
  q.assigned = [...towerIds];
  q.startedAt = nowMs;
  return true;
}

/** Number of Ready (claimable) quests on the board. */
export function claimableQuestCount(save: HeroSave, nowMs: number): number {
  return save.meta.expedition.quests.filter((q) => questState(q, nowMs) === "ready").length;
}

/**
 * Claim a Ready quest: roll its tier reward, grant it, free the towers, and
 * replace the quest in place with a freshly generated one. Returns {} if not
 * Ready (or unknown id).
 */
export function claimQuest(save: HeroSave, questId: string, nowMs: number, rng: Rng): Reward {
  const board = save.meta.expedition;
  const idx = board.quests.findIndex((x) => x.id === questId);
  if (idx < 0) return {};
  const q = board.quests[idx];
  if (questState(q, nowMs) !== "ready") return {};
  const reward = QUEST_TIERS[q.rarity].rewardRoll(rng);
  grantReward(save, reward);
  board.quests[idx] = generateQuest(rng, nextId(save)); // refill the slot
  return reward;
}
