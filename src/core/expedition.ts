/**
 * F2 — Idle Expedition. Dispatch up to 3 towers to accrue gold (and a chance at
 * materials) in real time, capped at 8h so it tops up but never replaces playing.
 * Loop: Meta. Bartle: Achiever. Feeling: "it grew while I was away → come back."
 */
import type { HeroSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { grantReward, type Reward } from "./rewards.ts";
import { BLESS_JEWEL } from "../data/materials.ts";

export const EXPEDITION_CAP_MS = 8 * 60 * 60 * 1000;
export const MAX_EXPEDITION_TOWERS = 3;
const HOUR_MS = 60 * 60 * 1000;
/** Base gold/hour for a single tower at zero progress. */
const BASE_GOLD_PER_HOUR = 120;
/** Each cleared stage adds 10% to the rate (deeper progress → richer expeditions). */
const PROGRESS_BONUS = 0.10;
/** Per-hour chance to also bring back a Bless jewel. */
const MATERIAL_CHANCE_PER_HOUR = 0.25;

/** Count of distinct cleared stages (any difficulty) — the progress driver. */
function clearedStageCount(save: HeroSave): number {
  let n = 0;
  for (const rec of Object.values(save.progress.stageClearMap)) {
    if (rec.Normal || rec.Hard || rec.Nightmare) n++;
  }
  return n;
}

/** Gold per hour for the current expedition party + progress. */
export function expeditionGoldPerHour(save: HeroSave): number {
  const towers = Math.max(1, save.meta.expedition.towerIds.length);
  const progressMul = 1 + clearedStageCount(save) * PROGRESS_BONUS;
  return Math.round(BASE_GOLD_PER_HOUR * towers * progressMul);
}

export function expeditionActive(save: HeroSave): boolean {
  return save.meta.expedition.startedAt > 0;
}

/** Hours of accrual banked (capped), given the current time. */
export function expeditionElapsedMs(save: HeroSave, nowMs: number): number {
  if (!expeditionActive(save)) return 0;
  return Math.min(EXPEDITION_CAP_MS, Math.max(0, nowMs - save.meta.expedition.lastCollectAt));
}

/** Start (or re-party) an expedition with up to 3 towers. */
export function startExpedition(save: HeroSave, towerIds: string[], nowMs: number): void {
  const owned = towerIds.filter((id) => id in save.collection).slice(0, MAX_EXPEDITION_TOWERS);
  save.meta.expedition.towerIds = owned;
  save.meta.expedition.startedAt = nowMs;
  save.meta.expedition.lastCollectAt = nowMs;
}

/** Preview the reward that collecting right now would yield (gold only; materials are rolled on collect). */
export function expeditionPendingGold(save: HeroSave, nowMs: number): number {
  const hours = expeditionElapsedMs(save, nowMs) / HOUR_MS;
  return Math.floor(expeditionGoldPerHour(save) * hours);
}

/**
 * Collect accrued rewards and reset the accrual baseline (the expedition keeps
 * running). Returns the reward bundle (empty if nothing accrued / inactive).
 */
export function collectExpedition(save: HeroSave, nowMs: number, rng: Rng): Reward {
  if (!expeditionActive(save)) return {};
  const elapsedMs = expeditionElapsedMs(save, nowMs);
  const hours = elapsedMs / HOUR_MS;
  const gold = Math.floor(expeditionGoldPerHour(save) * hours);
  const reward: Reward = {};
  if (gold > 0) reward.gold = gold;
  // Roll a material per whole hour elapsed.
  let bless = 0;
  for (let h = 0; h < Math.floor(hours); h++) {
    if (rng.next() < MATERIAL_CHANCE_PER_HOUR) bless++;
  }
  if (bless > 0) reward.materials = { [BLESS_JEWEL]: bless };
  save.meta.expedition.lastCollectAt = nowMs;
  grantReward(save, reward);
  return reward;
}
