import type { Rarity } from "../data/schema.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection, isTowerMaxStar } from "./collection.ts";
import { Rng } from "./rng.ts";
import type { HeroSave } from "./save.ts";
import { incrementBountyEvent } from "./bounties.ts";
import { isoWeekKey } from "./meta.ts";
import { featuredDraw } from "./banner.ts";

export const SINGLE_PULL_COST = 160;
export const MULTI_PULL_COST = 1440;
/** A free single summon recharges 8 hours after the previous one is claimed. */
export const FREE_SUMMON_INTERVAL_MS = 8 * 60 * 60 * 1000;
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
  return save.currency.diamonds >= cost;
}

/**
 * Draw rarity given current pity count.
 *
 * Legendary is the pity target — pityCount tracks pulls since the last
 * Legendary-or-Unique. Both soft and hard pity increase the Legendary+
 * combined rate. When a Legendary+ fires, the exact tier is resolved via
 * drawLegendaryPlus (95% Legendary / 5% Unique).
 */
function drawRarity(pityCount: number, rng: Rng): Rarity {
  // Hard pity: guaranteed Legendary+
  if (pityCount >= HARD_PITY - 1) return drawLegendaryPlus(rng);

  // Combined Legendary+ base rate
  const legPlusBase = BASE_RATES.Unique + BASE_RATES.Legendary; // ~5.7%
  let legPlusRate = legPlusBase;
  if (pityCount >= SOFT_PITY_START) {
    legPlusRate = legPlusBase + SOFT_PITY_INCREASE * (pityCount - SOFT_PITY_START + 1);
    if (legPlusRate > 1) legPlusRate = 1;
  }

  const roll = rng.next();
  if (roll < legPlusRate) return drawLegendaryPlus(rng);

  // Scale remaining rarities proportionally to fill 1 - legPlusRate
  const base = 1 - legPlusBase;
  const remaining = 1 - legPlusRate;
  const rareRate  = (BASE_RATES.Rare  / base) * remaining;
  const magicRate = (BASE_RATES.Magic / base) * remaining;

  if (roll < legPlusRate + rareRate) return "Rare";
  if (roll < legPlusRate + rareRate + magicRate) return "Magic";
  return "Common";
}

function drawCharacter(save: HeroSave, rarity: Rarity, rng: Rng): string {
  // F10 spotlight tilt: within the rolled rarity, the featured character has a
  // boosted chance to be the one drawn.
  const featured = featuredDraw(save, rarity, rng.next(), isoWeekKey(new Date()));
  if (featured) return featured;
  // A maxed (5★) tower can't be pulled anymore — prefer non-maxed of the rolled
  // rarity, then any non-maxed tower, only falling back to the full list if the
  // player has somehow maxed everything.
  const fresh = TOWERS.filter((t) => !isTowerMaxStar(save, t.id));
  const pool = fresh.filter((t) => t.rarity === rarity);
  const source = pool.length > 0 ? pool : fresh.length > 0 ? fresh : TOWERS;
  return source[Math.floor(rng.next() * source.length)].id;
}

/**
 * Draw from the Legendary+ pool: 95% Legendary / 5% Unique.
 * Used for: hard pity, soft-pity Leg+ fires, and shop insurance pulls.
 */
function drawLegendaryPlus(rng: Rng): Rarity {
  return rng.next() < 0.05 ? "Unique" : "Legendary";
}

export function performSummon(save: HeroSave, rng: Rng): SummonResult {
  save.currency.diamonds -= SINGLE_PULL_COST;

  let rarity: Rarity;
  if (save.currency.pityInsuranceActive) {
    // Shop insurance: same Legendary+ pool, consumed on use.
    save.currency.pityInsuranceActive = false;
    rarity = drawLegendaryPlus(rng);
  } else {
    rarity = drawRarity(save.currency.pityCount, rng);
  }

  const characterId = drawCharacter(save, rarity, rng);
  const isNew = !(characterId in save.collection);
  addTowerToCollection(save, characterId);
  // F3 weekly bounty + F10 spark both tick once per pull.
  incrementBountyEvent(save, "summon", 1, isoWeekKey(new Date()));
  save.meta.banner.sparks += 1;
  const newStars = save.collection[characterId].stars;
  if (rarity === "Legendary" || rarity === "Unique") {
    save.currency.pityCount = 0;
  } else {
    save.currency.pityCount += 1;
  }
  return { characterId, rarity, isNew, newStars, pityCount: save.currency.pityCount };
}

export function performMultiSummon(save: HeroSave, rng: Rng, count: number): SummonResult[] {
  const totalCost = count === 10 ? MULTI_PULL_COST : SINGLE_PULL_COST * count;
  save.currency.diamonds -= totalCost;
  const results: SummonResult[] = [];
  for (let i = 0; i < count; i++) {
    save.currency.diamonds += SINGLE_PULL_COST; // credit so performSummon's deduction nets to 0
    results.push(performSummon(save, rng));
  }
  return results;
}
