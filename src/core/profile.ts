/**
 * F16 — Player Profile, Power Rating & Titles. Aggregates the player's investment
 * into one Power Rating (a north-star number for Achievers) and exposes a profile
 * summary card. Titles are earned from milestones (F15) and equipped here for
 * identity/expression. Loop: Meta. Bartle: Socializer-lite/Achiever.
 */
import type { HeroSave } from "./save.ts";
import { TOWERS } from "../data/towers.ts";
import { unlockedTitles } from "./milestones.ts";

const RARITY_WEIGHT: Record<string, number> = { Common: 1, Magic: 2, Rare: 4, Legendary: 8, Unique: 16 };
const TOWER_RARITY = new Map(TOWERS.map((t) => [t.id, t.rarity]));

/**
 * A single aggregate strength number. Monotonic in every kind of progress so it
 * only ever goes up as the player invests:
 *  hero level, collection (stars × rarity), gear enhancement, mastery, awakening.
 */
export function powerRating(save: HeroSave): number {
  let power = 0;
  power += save.hero.level * 10;
  power += (save.hero.unlockedNodes?.length ?? 0) * 5;

  for (const [id, entry] of Object.entries(save.collection)) {
    const w = RARITY_WEIGHT[TOWER_RARITY.get(id) ?? "Common"] ?? 1;
    power += entry.stars * w * 3;
    power += (save.meta.mastery[id]?.level ?? 0) * w;
    power += (save.meta.awakening[id] ?? 0) * w * 5;
  }

  for (const item of save.inventory.items) {
    power += (item.enhanceLevel ?? 0) * 2;
    if (item.apex) power += 25;
  }
  return Math.round(power);
}

/** Collection completion as a fraction 0..1 (owned distinct heroes / total). */
export function collectionPct(save: HeroSave): number {
  return TOWERS.length ? Object.keys(save.collection).length / TOWERS.length : 0;
}

/** Equip a title the player has unlocked (or "" to clear). Returns false if locked. */
export function setTitle(save: HeroSave, titleId: string): boolean {
  if (titleId === "") { save.meta.profile.titleId = ""; return true; }
  if (!unlockedTitles(save).includes(titleId)) return false;
  save.meta.profile.titleId = titleId;
  return true;
}

export interface ProfileSummary {
  heroLevel: number;
  power: number;
  bestEndlessWave: number;
  collectionPct: number;
  title: string;
  lifetimeKills: number;
  lifetimeClears: number;
}

export function profileSummary(save: HeroSave): ProfileSummary {
  return {
    heroLevel: save.hero.level,
    power: powerRating(save),
    bestEndlessWave: Object.values(save.meta.endless.bestWave).reduce((m, w) => Math.max(m, w), 0),
    collectionPct: collectionPct(save),
    title: save.meta.profile.titleId,
    lifetimeKills: save.meta.profile.lifetimeKills,
    lifetimeClears: save.meta.profile.lifetimeClears,
  };
}
