/**
 * Smelt — recycle gear into Jewel of Entropy (the Reforge material).
 *
 * Selling is gone: surplus gear is now smelted instead. Yield doubles per rarity
 * step, mirroring the exponential item-value ladder, so a stronger item is both a
 * better drop AND better fuel. Entropy is ONLY minted here (no drops, no shop), which
 * makes the reforge loop self-limiting — you can only perfect gear by spending gear.
 *
 * Pure mutations on HeroSave (like loadout.ts / enhance.ts); SaveManager wraps
 * them with persistence + events.
 */
import type { HeroSave } from "./save.ts";
import type { Rarity } from "../data/schema.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { CHAOS_JEWEL } from "../data/materials.ts";

/** Jewels of Entropy minted by smelting an item of each rarity (×2 per step). */
export const SMELT_YIELD: Record<Rarity, number> = {
  Common: 1,
  Magic: 2,
  Rare: 4,
  Legendary: 8,
  Unique: 16,
};

export function smeltYield(rarity: Rarity): number {
  return SMELT_YIELD[rarity] ?? 1;
}

export interface SmeltResult {
  ok: boolean;
  reason?: "no-item" | "equipped";
  /** Jewels of Entropy granted (when ok). */
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

/** Rarities the bulk/auto smelt is allowed to touch ("rare or lower"). */
export const AUTO_SMELT_RARITIES: Rarity[] = ["Common", "Magic", "Rare"];

export interface BulkSmeltPreview {
  count: number;
  chaos: number;
}

export interface BulkSmeltResult {
  count: number;
  chaos: number;
}

/**
 * Non-equipped inventory items whose def rarity is in both `rarities` and
 * AUTO_SMELT_RARITIES. Shared by preview (read) and bulk (mutate). An item whose
 * def can't be resolved is skipped — we can't classify its rarity safely.
 */
function eligibleForBulkSmelt(
  save: HeroSave,
  rarities: Rarity[],
): { idx: number; chaos: number }[] {
  const allowed = new Set(rarities.filter((r) => AUTO_SMELT_RARITIES.includes(r)));
  const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
  const out: { idx: number; chaos: number }[] = [];
  save.inventory.items.forEach((it, idx) => {
    if (equipped.has(it.id)) return;
    const def = ITEM_CATALOG_MAP.get(it.defId);
    if (!def || !allowed.has(def.rarity)) return;
    out.push({ idx, chaos: smeltYield(def.rarity) });
  });
  return out;
}

/** How many items + how much chaos a bulk smelt of `rarities` would yield. Pure. */
export function bulkSmeltPreview(save: HeroSave, rarities: Rarity[]): BulkSmeltPreview {
  const hits = eligibleForBulkSmelt(save, rarities);
  return { count: hits.length, chaos: hits.reduce((s, h) => s + h.chaos, 0) };
}

/** Smelt every eligible item of `rarities` at once. Mutates `save`; mints chaos. */
export function bulkSmelt(save: HeroSave, rarities: Rarity[]): BulkSmeltResult {
  const hits = eligibleForBulkSmelt(save, rarities);
  if (hits.length === 0) return { count: 0, chaos: 0 };
  const chaos = hits.reduce((s, h) => s + h.chaos, 0);
  // Remove by descending index so earlier splices don't shift later ones.
  for (const h of hits.sort((a, b) => b.idx - a.idx)) {
    save.inventory.items.splice(h.idx, 1);
  }
  save.materials[CHAOS_JEWEL] = (save.materials[CHAOS_JEWEL] ?? 0) + chaos;
  return { count: hits.length, chaos };
}
