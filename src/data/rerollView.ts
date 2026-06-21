/**
 * rerollView — pure (Phaser-free) view-models for the Forge "Reroll Affixes"
 * station. Turns a HeroSave into the list of reroll-eligible items (with each
 * item's own escalating cost + affordability) and exposes the affix-only rows for
 * the detail panel. No mutation, no Phaser — just the shape the dialog renders.
 */
import type { HeroSave, ItemInstanceSave } from "../core/save.ts";
import type { ItemDef, Rarity } from "./schema.ts";
import { ITEM_CATALOG_MAP } from "./items.ts";
import { reforgeCost, canReforge } from "../core/reforge.ts";
import { CHAOS_JEWEL } from "./materials.ts";
import { itemStatRows, type ItemStatRow } from "./itemDisplay.ts";

export interface RerollItemVM {
  id: string;
  defId: string;
  name: string;
  rarity: Rarity;
  slot: string;
  weaponType?: string;
  enhanceLevel: number;
  rerollCount: number;
  entropyCost: number;
  goldCost: number;
  /** True when the player can pay this item's next reroll right now. */
  affordable: boolean;
  equipped: boolean;
}

const RARITY_RANK: Record<Rarity, number> = {
  Common: 0,
  Magic: 1,
  Rare: 2,
  Legendary: 3,
  Unique: 4,
};

/** All Rare+ inventory items (equipped included), each with its own next cost. */
export function rerollEligibleItems(save: HeroSave): RerollItemVM[] {
  const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
  const gold = save.currency.gold ?? 0;
  const entropy = save.materials[CHAOS_JEWEL] ?? 0;
  const out: RerollItemVM[] = [];
  for (const inst of save.inventory.items) {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def || !canReforge(def.rarity)) continue;
    const n = inst.rerollCount ?? 0;
    const cost = reforgeCost(def.rarity, n)!;
    out.push({
      id: inst.id,
      defId: inst.defId,
      name: def.name,
      rarity: def.rarity,
      slot: def.slot,
      weaponType: def.weaponType,
      enhanceLevel: inst.enhanceLevel ?? 0,
      rerollCount: n,
      entropyCost: cost.entropy,
      goldCost: cost.gold,
      affordable: gold >= cost.gold && entropy >= cost.entropy,
      equipped: equipped.has(inst.id),
    });
  }
  out.sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || a.name.localeCompare(b.name));
  return out;
}

/** The item's secondary-affix rows only (base + primary filtered out). */
export function rerollAffixRows(inst: ItemInstanceSave, def: ItemDef): ItemStatRow[] {
  return itemStatRows(inst, def).filter((r) => r.source === "affix");
}
