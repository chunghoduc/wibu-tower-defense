/**
 * F2 — Idle Expedition. Dispatch up to 3 towers to accrue gold (and a chance at
 * materials) in real time, capped at 8h so it tops up but never replaces playing.
 * Loop: Meta. Bartle: Achiever. Feeling: "it grew while I was away → come back."
 *
 * Towers sent on expedition cannot be in the active battle squad, and each
 * tower's gold contribution scales with its rarity and star level — sending your
 * strongest spare heroes is the play. A 15-minute minimum gates collecting so the
 * loop reads as a real expedition, not a tap-spam faucet.
 */
import type { HeroSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { grantReward, type Reward } from "./rewards.ts";
import { BLESS_JEWEL } from "../data/materials.ts";
import { TOWERS } from "../data/towers.ts";
import type { Rarity } from "../data/schema.ts";

export const EXPEDITION_CAP_MS = 8 * 60 * 60 * 1000;
/** Heroes must be out for at least this long before their haul can be collected. */
export const MIN_COLLECT_MS = 15 * 60 * 1000;
export const MAX_EXPEDITION_TOWERS = 3;
const HOUR_MS = 60 * 60 * 1000;
/** Base gold/hour contributed by a single 1★ Common tower at zero progress. */
const BASE_GOLD_PER_HOUR = 120;
/** Each cleared stage adds 10% to the rate (deeper progress → richer expeditions). */
const PROGRESS_BONUS = 0.1;
/** Per-hour chance to also bring back a Bless jewel. */
const MATERIAL_CHANCE_PER_HOUR = 0.25;
/** Gold weight per rarity (a stronger hero gathers more). */
const RARITY_WEIGHT: Record<Rarity, number> = {
  Common: 1,
  Magic: 1.4,
  Rare: 2,
  Legendary: 3,
  Unique: 4.5,
};
/** Each star above the first adds 20% to that tower's contribution. */
const STAR_STEP = 0.2;

const TOWER_RARITY = new Map<string, Rarity>(TOWERS.map((t) => [t.id, t.rarity]));

/** Count of distinct cleared stages (any difficulty) — the progress driver. */
function clearedStageCount(save: HeroSave): number {
  let n = 0;
  for (const rec of Object.values(save.progress.stageClearMap)) {
    if (rec.Normal || rec.Hard || rec.Nightmare) n++;
  }
  return n;
}

/** One tower's gold weight from its rarity and star level (1★ Common = 1.0). */
export function towerExpeditionWeight(save: HeroSave, id: string): number {
  const rarity = TOWER_RARITY.get(id) ?? "Common";
  const stars = Math.max(1, save.collection[id]?.stars ?? 1);
  return RARITY_WEIGHT[rarity] * (1 + (stars - 1) * STAR_STEP);
}

/** Gold per hour for an arbitrary party (drives the live preview while choosing). */
export function expeditionGoldPerHourFor(save: HeroSave, towerIds: string[]): number {
  const weight = towerIds.reduce((sum, id) => sum + towerExpeditionWeight(save, id), 0);
  const progressMul = 1 + clearedStageCount(save) * PROGRESS_BONUS;
  return Math.round(BASE_GOLD_PER_HOUR * weight * progressMul);
}

/** Gold per hour for the currently dispatched party + progress. */
export function expeditionGoldPerHour(save: HeroSave): number {
  return expeditionGoldPerHourFor(save, save.meta.expedition.towerIds);
}

export function expeditionActive(save: HeroSave): boolean {
  return save.meta.expedition.startedAt > 0;
}

/** Owned towers eligible for an expedition: everything not in the battle squad. */
export function expeditionEligibleTowerIds(save: HeroSave): string[] {
  const squad = new Set(save.squad ?? []);
  return Object.keys(save.collection).filter((id) => !squad.has(id));
}

/** Ms of accrual banked (capped), given the current time. */
export function expeditionElapsedMs(save: HeroSave, nowMs: number): number {
  if (!expeditionActive(save)) return 0;
  return Math.min(EXPEDITION_CAP_MS, Math.max(0, nowMs - save.meta.expedition.lastCollectAt));
}

/** Epoch ms at which the current haul first becomes collectable (0 if inactive). */
export function expeditionCollectReadyAt(save: HeroSave): number {
  return expeditionActive(save) ? save.meta.expedition.lastCollectAt + MIN_COLLECT_MS : 0;
}

/** True once the party has been out for at least the 15-minute minimum. */
export function expeditionCanCollect(save: HeroSave, nowMs: number): boolean {
  return expeditionActive(save) && expeditionElapsedMs(save, nowMs) >= MIN_COLLECT_MS;
}

/** Start (or re-party) an expedition. Squad towers are excluded automatically. */
export function startExpedition(save: HeroSave, towerIds: string[], nowMs: number): void {
  const squad = new Set(save.squad ?? []);
  const owned = towerIds
    .filter((id) => id in save.collection && !squad.has(id))
    .slice(0, MAX_EXPEDITION_TOWERS);
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
 * running). No-ops (returns {}) until the 15-minute minimum has elapsed.
 */
export function collectExpedition(save: HeroSave, nowMs: number, rng: Rng): Reward {
  if (!expeditionCanCollect(save, nowMs)) return {};
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
