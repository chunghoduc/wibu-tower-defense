/**
 * Reforge — re-roll a Rare+ item's affixes for gold + Jewel of Chaos.
 *
 * The affix re-roll uses the exact same logic as a fresh drop (items.rollAffixes),
 * so a reforged item is statistically identical to a freshly-rolled one of the same
 * rarity — same affix count, same pool, same ranges, same Apex +25%. Only the
 * SECONDARY affixes change; the primary affix, base stats, enhance level, and Apex
 * flag are the item's identity and are left untouched.
 *
 * Cost rises with rarity: a higher-rarity item has more affixes worth chasing, and
 * it also smelts into more chaos, so the loop stays balanced (smelting a same-rarity
 * item roughly funds one reforge). Gold is the second cost — reforge is now the main
 * gold sink that selling used to be.
 *
 * Pure mutations on HeroSave; SaveManager wraps them with persistence + events.
 */
import type { HeroSave } from "./save.ts";
import type { Rarity } from "../data/schema.ts";
import type { Rng } from "./rng.ts";
import { ITEM_CATALOG_MAP, rollAffixes, APEX_STAT_MULT } from "../data/items.ts";
import { CHAOS_JEWEL } from "../data/materials.ts";

export interface ReforgeCost {
  gold: number;
  chaos: number;
}

/** Reforge cost by rarity. Common/Magic are absent — they aren't reforge-able. */
const REFORGE_COST: Partial<Record<Rarity, ReforgeCost>> = {
  Rare: { gold: 400, chaos: 3 },        // ≈ smelting one Rare (4 chaos)
  Legendary: { gold: 900, chaos: 6 },   // ≈ smelting one Legendary partway
  Unique: { gold: 2000, chaos: 10 },    // a Unique smelts to 16 → ~1.6 reforges
};

export function reforgeCost(rarity: Rarity): ReforgeCost | null {
  return REFORGE_COST[rarity] ?? null;
}

/** Only Rare and above carry enough affixes to be worth re-rolling. */
export function canReforge(rarity: Rarity): boolean {
  return REFORGE_COST[rarity] !== undefined;
}

export interface ReforgeResult {
  ok: boolean;
  reason?: "no-item" | "not-eligible" | "no-gold" | "no-chaos";
}

/**
 * Re-roll one inventory item's secondary affixes, consuming gold + chaos. Works on
 * equipped items too (like enhance) since the item itself is never removed. Mutates
 * `save`; deterministic given `rng`.
 */
export function reforgeItem(save: HeroSave, instanceId: string, rng: Rng): ReforgeResult {
  const inst = save.inventory.items.find((it) => it.id === instanceId);
  if (!inst) return { ok: false, reason: "no-item" };
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  if (!def) return { ok: false, reason: "no-item" };
  const cost = reforgeCost(def.rarity);
  if (!cost) return { ok: false, reason: "not-eligible" };
  if ((save.currency.gold ?? 0) < cost.gold) return { ok: false, reason: "no-gold" };
  if ((save.materials[CHAOS_JEWEL] ?? 0) < cost.chaos) return { ok: false, reason: "no-chaos" };

  save.currency.gold -= cost.gold;
  save.materials[CHAOS_JEWEL] -= cost.chaos;
  const apexMult = inst.apex ? APEX_STAT_MULT : 1;
  inst.rolledAffixes = rollAffixes(def, rng, apexMult);
  return { ok: true };
}
