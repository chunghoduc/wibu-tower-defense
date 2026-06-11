/**
 * Smelt — recycle gear into Jewel of Chaos (the Reforge material).
 *
 * Selling is gone: surplus gear is now smelted instead. Yield doubles per rarity
 * step, mirroring the exponential item-value ladder, so a stronger item is both a
 * better drop AND better fuel. Chaos is ONLY minted here (no drops, no shop), which
 * makes the reforge loop self-limiting — you can only perfect gear by spending gear.
 *
 * Pure mutations on HeroSave (like loadout.ts / enhance.ts); SaveManager wraps
 * them with persistence + events.
 */
import type { HeroSave } from "./save.ts";
import type { Rarity } from "../data/schema.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { CHAOS_JEWEL } from "../data/materials.ts";

/** Jewels of Chaos minted by smelting an item of each rarity (×2 per step). */
export const SMELT_YIELD: Record<Rarity, number> = {
  Common: 1, Magic: 2, Rare: 4, Legendary: 8, Unique: 16,
};

export function smeltYield(rarity: Rarity): number {
  return SMELT_YIELD[rarity] ?? 1;
}

export interface SmeltResult {
  ok: boolean;
  reason?: "no-item" | "equipped";
  /** Jewels of Chaos granted (when ok). */
  chaos?: number;
}

/** Smelt one inventory item, destroying it and minting chaos. Mutates `save`. */
export function smeltItem(save: HeroSave, instanceId: string): SmeltResult {
  if (Object.values(save.inventory.equipped).includes(instanceId)) {
    return { ok: false, reason: "equipped" };
  }
  const idx = save.inventory.items.findIndex((it) => it.id === instanceId);
  if (idx < 0) return { ok: false, reason: "no-item" };
  const def = ITEM_CATALOG_MAP.get(save.inventory.items[idx].defId);
  const chaos = def ? smeltYield(def.rarity) : 1;
  save.inventory.items.splice(idx, 1);
  save.materials[CHAOS_JEWEL] = (save.materials[CHAOS_JEWEL] ?? 0) + chaos;
  return { ok: true, chaos };
}
