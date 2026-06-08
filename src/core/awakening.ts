/**
 * F7 — Awakening. The end-game chase beyond 5★: spend Awakening Crystals to raise
 * a maxed tower's Awakening rank (0→3), each rank a permanent +10% atk/hp and a
 * deepening signature glow. Loop: Meta. Bartle: Achiever/Killer — keeps a maxed
 * collection meaningful. A months-long sink (~30 crystals total at rank 3).
 */
import type { HeroSave } from "./save.ts";
import { isTowerMaxStar } from "./collection.ts";
import { AWAKENING_CRYSTAL } from "../data/materials.ts";

export const MAX_AWAKENING = 3;
/** Crystals to reach each rank (index = target rank). Rank 0 is free/default. */
export const AWAKENING_CRYSTAL_COST = [0, 8, 10, 12];
/** Per-rank permanent stat bonus (atk & hp). rank3 → +30%. */
export const AWAKENING_BONUS_PER_RANK = 0.10;

export function getAwakening(save: HeroSave, towerId: string): number {
  return save.meta.awakening[towerId] ?? 0;
}

/** Permanent stat multiplier from a tower's awakening rank (atk & hp). */
export function awakeningStatMul(rank: number): number {
  return 1 + AWAKENING_BONUS_PER_RANK * rank;
}

/** Crystals to raise from the current rank to the next (null if maxed rank). */
export function awakeningCost(rank: number): number | null {
  if (rank >= MAX_AWAKENING) return null;
  return AWAKENING_CRYSTAL_COST[rank + 1];
}

export interface AwakenCheck {
  ok: boolean;
  reason?: string;
  cost?: number;
}

/** Whether the tower can be awakened one rank right now. */
export function canAwaken(save: HeroSave, towerId: string): AwakenCheck {
  if (!(towerId in save.collection)) return { ok: false, reason: "Not owned" };
  if (!isTowerMaxStar(save, towerId)) return { ok: false, reason: "Must be 5★ first" };
  const rank = getAwakening(save, towerId);
  if (rank >= MAX_AWAKENING) return { ok: false, reason: "Already fully Awakened" };
  const cost = awakeningCost(rank)!;
  if ((save.materials[AWAKENING_CRYSTAL] ?? 0) < cost) {
    return { ok: false, reason: `Need ${cost} Awakening Crystals`, cost };
  }
  return { ok: true, cost };
}

/** Spend crystals to awaken the tower one rank. Returns the new rank, or -1 if blocked. */
export function awaken(save: HeroSave, towerId: string): number {
  const check = canAwaken(save, towerId);
  if (!check.ok) return -1;
  save.materials[AWAKENING_CRYSTAL] -= check.cost!;
  const rank = getAwakening(save, towerId) + 1;
  save.meta.awakening[towerId] = rank;
  return rank;
}
