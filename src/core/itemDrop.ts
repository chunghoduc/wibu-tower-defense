import { ITEM_CATALOG, rollItem } from "../data/items.ts";
import type { Rarity } from "../data/schema.ts";
import type { Rng } from "./rng.ts";
import type { HeroSave, ItemInstanceSave } from "./save.ts";

/**
 * Relative drop weight per rarity — commons are the staple, uniques the prize.
 * Legendary + Unique are BOSS-ONLY (see BOSS_ONLY_RARITIES); the weight on Unique
 * is tiny so even a boss kill rarely yields one.
 */
const RARITY_DROP_WEIGHT: Record<Rarity, number> = {
  Common: 100,
  Magic: 45,
  Rare: 18,
  Legendary: 5,
  Unique: 1,
};
/** Rarities that ONLY ever drop from a boss kill, never from a regular enemy. */
const BOSS_ONLY_RARITIES = new Set<Rarity>(["Legendary", "Unique"]);

/** Serialize a rolled ItemInstance into its persisted save shape. */
export function toItemInstanceSave(inst: ReturnType<typeof rollItem>): ItemInstanceSave {
  return {
    id: inst.id,
    defId: inst.defId,
    acquiredLevel: inst.acquiredLevel,
    rolledStats: Object.fromEntries(
      Object.entries(inst.rolledStats).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v as number]),
    ),
    rolledPrimaryAffix: inst.rolledPrimaryAffix,
    rolledAffixes: inst.rolledAffixes,
    enhanceLevel: 0,
  };
}

/** Stage-derived item level: stages with a trailing number scale the drop tier. */
export function itemLevelForStage(stageId: string): number {
  const m = stageId.match(/(\d+)$/);
  const idx = m ? parseInt(m[1]) : 1;
  return Math.max(1, idx * 8 + 5);
}

/**
 * Roll an eligible item at `itemLevel`, push it into the save inventory, and
 * return the persisted instance (or null if nothing is eligible). Shared by
 * stage-clear rewards and per-kill drops so the roll logic lives in one place.
 *
 * Rarity is weighted (RARITY_DROP_WEIGHT) so commons are the staple and uniques
 * a super-rare prize. `fromBoss` gates the high tiers: Legendary + Unique ONLY
 * drop from a boss kill (and the stage-clear reward, which represents the boss);
 * regular enemies are capped at Rare.
 */
export function rollItemDrop(save: HeroSave, itemLevel: number, rng: Rng, fromBoss = false): ItemInstanceSave | null {
  const eligible = ITEM_CATALOG.filter(
    (d) => d.requiredLevel <= itemLevel && (fromBoss || !BOSS_ONLY_RARITIES.has(d.rarity)),
  );
  if (eligible.length === 0) return null;

  // Weighted pick by each item's rarity weight.
  const total = eligible.reduce((sum, d) => sum + RARITY_DROP_WEIGHT[d.rarity], 0);
  let roll = rng.next() * total;
  let def = eligible[eligible.length - 1];
  for (const d of eligible) {
    roll -= RARITY_DROP_WEIGHT[d.rarity];
    if (roll < 0) { def = d; break; }
  }

  const inst = rollItem(def, itemLevel, Math.floor(rng.next() * 999983));
  const instSave = toItemInstanceSave(inst);
  save.inventory.items.push(instSave);
  return instSave;
}
