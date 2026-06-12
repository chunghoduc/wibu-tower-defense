/**
 * F18 — Alchemy core. Applies the lossy material recipes and the dupe-copy →
 * Awakening Crystal exchange. All conversions are guarded so a craft never goes
 * into the negative.
 */
import { ALCHEMY_RECIPES_MAP, COPIES_PER_CRYSTAL } from "../data/alchemy.ts";
import { AWAKENING_CRYSTAL } from "../data/materials.ts";
import type { HeroSave } from "./save.ts";

/** Max times a recipe can be crafted from the current materials. */
export function maxCrafts(save: HeroSave, recipeId: string): number {
  const r = ALCHEMY_RECIPES_MAP.get(recipeId);
  if (!r) return 0;
  let max = Infinity;
  for (const [id, n] of Object.entries(r.inputs)) {
    max = Math.min(max, Math.floor((save.materials[id] ?? 0) / n));
  }
  return max === Infinity ? 0 : max;
}

/** Craft a recipe `times` times. Returns crafts actually performed (0 if unaffordable). */
export function craftAlchemy(save: HeroSave, recipeId: string, times = 1): number {
  const r = ALCHEMY_RECIPES_MAP.get(recipeId);
  if (!r || times <= 0) return 0;
  const n = Math.min(times, maxCrafts(save, recipeId));
  if (n <= 0) return 0;
  for (const [id, c] of Object.entries(r.inputs))
    save.materials[id] = (save.materials[id] ?? 0) - c * n;
  for (const [id, c] of Object.entries(r.outputs))
    save.materials[id] = (save.materials[id] ?? 0) + c * n;
  return n;
}

/**
 * Convert banked dupe copies of a tower into Awakening Crystals (lossy). Returns
 * crystals minted (0 if not enough copies). Spends COPIES_PER_CRYSTAL per crystal.
 */
export function exchangeCopies(save: HeroSave, towerId: string, crystals = 1): number {
  const entry = save.collection[towerId];
  if (!entry) return 0;
  const copies = entry.copies ?? 0;
  const minted = Math.min(crystals, Math.floor(copies / COPIES_PER_CRYSTAL));
  if (minted <= 0) return 0;
  entry.copies = copies - minted * COPIES_PER_CRYSTAL;
  save.materials[AWAKENING_CRYSTAL] = (save.materials[AWAKENING_CRYSTAL] ?? 0) + minted;
  return minted;
}
