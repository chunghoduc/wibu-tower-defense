import type { HeroSave } from "./save.ts";
import type { Rarity } from "../data/schema.ts";
import { TOWERS } from "../data/towers.ts";

export const MAX_STARS = 5;

/** Rarer heroes cost more crystals to ascend (the copy cost stays by star). */
export const RARITY_COST_MULT: Record<Rarity, number> = {
  Common: 1, Magic: 1.6, Rare: 2.4, Legendary: 3.5, Unique: 5,
};
const TOWER_RARITY = new Map<string, Rarity>(TOWERS.map((t) => [t.id, t.rarity]));
export function towerRarity(towerId: string): Rarity {
  return TOWER_RARITY.get(towerId) ?? "Common";
}

/**
 * Star ascension economy. A duplicate pull now banks a COPY toward the next
 * star instead of granting it outright; ascending one star spends copies +
 * crystals. Indexed by the CURRENT star: 1→2 costs 1 copy, 2→3 costs 3,
 * 3→4 costs 7, 4→5 costs 15 (rising material cost), plus a crystal fee.
 */
export const STAR_UP_COPIES = [0, 1, 3, 7, 15];
export const STAR_UP_CRYSTALS = [0, 200, 500, 1000, 2000];

export function addTowerToCollection(save: HeroSave, towerId: string): void {
  if (save.collection[towerId]) {
    addTowerDupe(save, towerId);
  } else {
    save.collection[towerId] = { stars: 1, copies: 0 };
  }
}

/** A duplicate banks one copy toward the next ascension (maxed towers ignore it). */
export function addTowerDupe(save: HeroSave, towerId: string): void {
  const entry = save.collection[towerId];
  if (!entry) return;
  if (entry.stars >= MAX_STARS) return; // already maxed — nothing left to bank
  entry.copies = (entry.copies ?? 0) + 1;
}

export function isTowerOwned(save: HeroSave, towerId: string): boolean {
  return towerId in save.collection;
}

export function getTowerStars(save: HeroSave, towerId: string): number {
  return save.collection[towerId]?.stars ?? 0;
}

export function getTowerCopies(save: HeroSave, towerId: string): number {
  return save.collection[towerId]?.copies ?? 0;
}

export function isTowerMaxStar(save: HeroSave, towerId: string): boolean {
  return (save.collection[towerId]?.stars ?? 0) >= MAX_STARS;
}

/**
 * Copies + crystals required to ascend a tower at `stars` (null if maxed). The
 * crystal cost scales with BOTH the current star (rising base) and the hero's
 * `rarity` (rarer heroes cost more); the copy cost depends on star only.
 */
export function starUpCost(stars: number, rarity: Rarity = "Common"): { copies: number; crystals: number } | null {
  if (stars < 1 || stars >= MAX_STARS) return null;
  return {
    copies: STAR_UP_COPIES[stars],
    crystals: Math.round(STAR_UP_CRYSTALS[stars] * RARITY_COST_MULT[rarity]),
  };
}

export interface StarUpResult {
  success: boolean;
  message: string;
}

/** Spend banked copies + crystals to raise a tower one star (stats scale per star). */
export function upgradeTowerStar(save: HeroSave, towerId: string): StarUpResult {
  const entry = save.collection[towerId];
  if (!entry) return { success: false, message: "Not owned" };
  if (entry.stars >= MAX_STARS) return { success: false, message: "Already 5★" };
  const cost = starUpCost(entry.stars, towerRarity(towerId))!;
  const copies = entry.copies ?? 0;
  if (copies < cost.copies) return { success: false, message: `Need ${cost.copies - copies} more copies` };
  if (save.currency.gold < cost.crystals) return { success: false, message: `Need ${cost.crystals} 💎` };
  entry.copies = copies - cost.copies;
  save.currency.gold -= cost.crystals;
  entry.stars += 1;
  return { success: true, message: `Ascended to ${entry.stars}★` };
}
