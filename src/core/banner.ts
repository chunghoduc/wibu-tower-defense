/**
 * F10 — Spotlight Banner + Spark (wishlist pity).
 *
 * A featured character rotates weekly with boosted odds within its rarity. Every
 * pull (any source) grants 1 spark (incremented in gacha.performSummon); at
 * SPARK_PITY sparks the player can claim their wishlisted featured Unique for
 * free — a hard guarantee that kills "lost the 50/50" churn.
 * Loop: Meta. Bartle: Achiever/Killer.
 */
import type { HeroSave } from "./save.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection, isTowerMaxStar } from "./collection.ts";

export const SPARK_PITY = 200;
/** Within the featured rarity, chance the drawn character is the featured one. */
export const FEATURED_TILT = 0.5;

const UNIQUES = TOWERS.filter((t) => t.rarity === "Unique");
const LEGENDARIES = TOWERS.filter((t) => t.rarity === "Legendary");

/** Stable hash of the week key → deterministic featured picks. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export interface FeaturedBanner {
  weekKey: string;
  /** The headline featured Unique (the spark target). */
  unique: string;
  /** A featured Legendary that also gets the rate tilt. */
  legendary: string;
}

/** The deterministic featured rotation for a given ISO week. */
export function featuredForWeek(weekKey: string): FeaturedBanner {
  const h = hashStr(weekKey);
  const unique = UNIQUES.length ? UNIQUES[h % UNIQUES.length].id : "";
  const legendary = LEGENDARIES.length ? LEGENDARIES[(h >>> 8) % LEGENDARIES.length].id : "";
  return { weekKey, unique, legendary };
}

/** The featured character ids that receive the in-pool rate tilt this week. */
export function featuredIds(weekKey: string): Set<string> {
  const b = featuredForWeek(weekKey);
  return new Set([b.unique, b.legendary].filter(Boolean));
}

/** Ensure the player's wishlist defaults to this week's featured Unique. */
export function ensureWishlist(save: HeroSave, weekKey: string): void {
  const b = save.meta.banner;
  if (b.weekKey !== weekKey) {
    b.weekKey = weekKey;
    // Reset the wishlist to the new headline only if the old one is gone/empty.
    if (!b.pickedFeaturedId) b.pickedFeaturedId = featuredForWeek(weekKey).unique;
  }
  if (!b.pickedFeaturedId) b.pickedFeaturedId = featuredForWeek(weekKey).unique;
}

/** Pick which featured Unique the sparks count toward. Must be a Unique tower. */
export function setWishlist(save: HeroSave, towerId: string): boolean {
  if (!UNIQUES.some((t) => t.id === towerId)) return false;
  save.meta.banner.pickedFeaturedId = towerId;
  return true;
}

export function canClaimSpark(save: HeroSave): boolean {
  return save.meta.banner.sparks >= SPARK_PITY && !!save.meta.banner.pickedFeaturedId;
}

/**
 * Claim the spark guarantee: grant the wishlisted Unique and spend SPARK_PITY
 * sparks. Returns the granted tower id, or null if not enough sparks / no pick.
 */
export function claimSpark(save: HeroSave): string | null {
  if (!canClaimSpark(save)) return null;
  const id = save.meta.banner.pickedFeaturedId;
  addTowerToCollection(save, id);
  save.meta.banner.sparks -= SPARK_PITY;
  return id;
}

/**
 * Featured-rate tilt for the gacha character draw. Given the rolled rarity and a
 * fresh (non-maxed) pool, return the featured character of that rarity to force
 * (with probability FEATURED_TILT), else null to fall through to the normal pick.
 */
export function featuredDraw(save: HeroSave, rarity: string, roll: number, weekKey: string): string | null {
  if (roll >= FEATURED_TILT) return null;
  const ids = featuredIds(weekKey);
  for (const id of ids) {
    const def = TOWERS.find((t) => t.id === id);
    if (def && def.rarity === rarity && !isTowerMaxStar(save, id)) return id;
  }
  return null;
}
