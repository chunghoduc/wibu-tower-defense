/**
 * Item enhancement (T13) — MU-style.
 *
 * - +0 → +6 costs a Jewel of Bless and ALWAYS succeeds.
 * - +6 and beyond costs a Jewel of Soul; success starts at 90% and drops 10% per
 *   level (floored at 5%). On failure the item loses 1–5 enhance levels.
 * - Each enhance level multiplies the item's primary stats (and the displayed
 *   primary affix) by +8%.
 *
 * Pure mutations on HeroSave (like loadout.ts); SaveManager wraps them with
 * persistence + events.
 */
import type { Stats } from "../data/schema.ts";
import type { HeroSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { incrementQuestKey } from "./questTracker.ts";
import { incrementBountyEvent } from "./bounties.ts";
import { isoWeekKey } from "./meta.ts";
import { BLESS_JEWEL, SOUL_JEWEL } from "../data/materials.ts";

// Re-export the jewel ids so consumers can import from one place.
export { BLESS_JEWEL, SOUL_JEWEL };

export const MAX_ENHANCE = 15;
export const SOUL_THRESHOLD = 6;       // levels at/after this need a Soul jewel
const BONUS_PER_LEVEL = 0.08;
const FAIL_DROP_MAX = 5;

/** Stat/affix multiplier for an enhance level. */
export function enhanceBonus(level: number): number {
  return 1 + BONUS_PER_LEVEL * Math.max(0, level);
}

/** Which jewel a given current level needs to advance one step. */
export function jewelForLevel(level: number): string {
  return level < SOUL_THRESHOLD ? BLESS_JEWEL : SOUL_JEWEL;
}

/** Success chance to advance from `level` to `level+1`. */
export function enhanceChance(level: number): number {
  if (level < SOUL_THRESHOLD) return 1;
  return Math.max(0.05, 1 - 0.1 * (level - (SOUL_THRESHOLD - 1)));
}

/** A copy of `stats` with every entry multiplied by the enhance bonus. */
export function scaleStatsByEnhance(stats: Partial<Stats>, level: number): Partial<Stats> {
  if (level <= 0) return { ...stats };
  const m = enhanceBonus(level);
  const out: Partial<Stats> = {};
  for (const [k, v] of Object.entries(stats) as [keyof Stats, number][]) out[k] = v * m;
  return out;
}

export interface EnhanceResult {
  ok: boolean;            // whether the attempt was performed (had item + jewel)
  reason?: "no-item" | "maxed" | "no-jewel";
  success?: boolean;      // whether it advanced
  jewel?: string;
  from?: number;
  to?: number;
}

/**
 * Attempt to enhance one inventory item by one level, consuming the appropriate
 * jewel. Mutates `save`. Deterministic given `rng`.
 */
export function attemptEnhance(save: HeroSave, instanceId: string, rng: Rng): EnhanceResult {
  const inst = save.inventory.items.find((i) => i.id === instanceId);
  if (!inst) return { ok: false, reason: "no-item" };
  const level = inst.enhanceLevel ?? 0;
  if (level >= MAX_ENHANCE) return { ok: false, reason: "maxed" };

  const jewel = jewelForLevel(level);
  const have = save.materials[jewel] ?? 0;
  if (have <= 0) return { ok: false, reason: "no-jewel" };
  save.materials[jewel] = have - 1;

  const success = rng.next() < enhanceChance(level);
  const from = level;
  if (success) {
    inst.enhanceLevel = level + 1;
  } else {
    const drop = 1 + Math.floor(rng.next() * FAIL_DROP_MAX); // 1..5
    inst.enhanceLevel = Math.max(0, level - drop);
  }
  incrementQuestKey(save, "enhance_items", 1, new Date().toISOString().slice(0, 10));
  incrementBountyEvent(save, "enhance", 1, isoWeekKey(new Date()));
  return { ok: true, success, jewel, from, to: inst.enhanceLevel };
}
