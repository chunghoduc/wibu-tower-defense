import type { Rarity } from "../data/schema.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import { Rng } from "./rng.ts";
import type { HeroSave } from "./save.ts";

export const SINGLE_PULL_COST = 160;
export const MULTI_PULL_COST = 1440;
export const HARD_PITY = 90;
const SOFT_PITY_START = 75;
const SOFT_PITY_INCREASE = 0.06;

const BASE_RATES: Record<Rarity, number> = {
  Unique: 0.006,
  Legendary: 0.051,
  Rare: 0.12,
  Magic: 0.256,
  Common: 0.567,
};

export interface SummonResult {
  characterId: string;
  rarity: Rarity;
  isNew: boolean;
  newStars: number;
  pityCount: number;
}

export function canAffordSummon(save: HeroSave, count = 1): boolean {
  const cost = count === 1 ? SINGLE_PULL_COST : MULTI_PULL_COST;
  return save.currency.crystals >= cost;
}

function drawRarity(pityCount: number, rng: Rng): Rarity {
  if (pityCount >= HARD_PITY - 1) return "Unique";
  let uniqueRate = BASE_RATES.Unique;
  if (pityCount >= SOFT_PITY_START) {
    uniqueRate = BASE_RATES.Unique + SOFT_PITY_INCREASE * (pityCount - SOFT_PITY_START + 1);
  }
  const roll = rng.next();
  if (roll < uniqueRate) return "Unique";
  const remaining = 1 - uniqueRate;
  const legRate = BASE_RATES.Legendary * remaining;
  const rareRate = BASE_RATES.Rare * remaining;
  const magicRate = BASE_RATES.Magic * remaining;
  if (roll < uniqueRate + legRate) return "Legendary";
  if (roll < uniqueRate + legRate + rareRate) return "Rare";
  if (roll < uniqueRate + legRate + rareRate + magicRate) return "Magic";
  return "Common";
}

function drawCharacter(rarity: Rarity, rng: Rng): string {
  const pool = TOWERS.filter((t) => t.rarity === rarity);
  const source = pool.length > 0 ? pool : TOWERS;
  return source[Math.floor(rng.next() * source.length)].id;
}

export function performSummon(save: HeroSave, rng: Rng): SummonResult {
  save.currency.crystals -= SINGLE_PULL_COST;
  const rarity = drawRarity(save.currency.pityCount, rng);
  const characterId = drawCharacter(rarity, rng);
  const isNew = !(characterId in save.collection);
  addTowerToCollection(save, characterId);
  const newStars = save.collection[characterId].stars;
  if (rarity === "Unique") {
    save.currency.pityCount = 0;
  } else {
    save.currency.pityCount += 1;
  }
  return { characterId, rarity, isNew, newStars, pityCount: save.currency.pityCount };
}

export function performMultiSummon(save: HeroSave, rng: Rng, count: number): SummonResult[] {
  const totalCost = count === 10 ? MULTI_PULL_COST : SINGLE_PULL_COST * count;
  save.currency.crystals -= totalCost;
  const results: SummonResult[] = [];
  for (let i = 0; i < count; i++) {
    save.currency.crystals += SINGLE_PULL_COST; // credit so performSummon's deduction nets to 0
    results.push(performSummon(save, rng));
  }
  return results;
}
