import { ITEM_CATALOG, rollItem, MAX_ITEM_REQ_LEVEL } from "../data/items.ts";
import { chapterIndexForStage } from "../data/chapters.ts";
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
    ...(inst.requiredLevel !== undefined ? { requiredLevel: inst.requiredLevel } : {}),
    ...(inst.apex ? { apex: true } : {}),
    rolledStats: Object.fromEntries(
      Object.entries(inst.rolledStats)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, v as number]),
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
 * The required-level band a chapter is allowed to drop. Each chapter spans 20
 * required levels: chapter 1 → 1–20, chapter 2 → 21–40, … capped at 90. This is
 * what scopes a stage's loot to its progression bracket.
 */
export function chapterLevelRange(stageId: string): [number, number] {
  const ci = chapterIndexForStage(stageId);
  const lo = Math.min(MAX_ITEM_REQ_LEVEL, ci * 20 + 1);
  const hi = Math.min(MAX_ITEM_REQ_LEVEL, (ci + 1) * 20);
  return [lo, hi];
}

/** Roll a required level for a dropped copy inside `[lo, hi]`, never below the
 *  item's own floor. */
function rollReqInBand(rng: Rng, floor: number, lo: number, hi: number): number {
  const min = Math.max(floor, lo);
  const max = Math.max(min, hi);
  return Math.round(min + rng.next() * (max - min));
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
export function rollItemDrop(
  save: HeroSave,
  itemLevel: number,
  rng: Rng,
  fromBoss = false,
  band?: [number, number],
): ItemInstanceSave | null {
  // When a chapter band is given, an item is eligible if its FLOOR fits the band;
  // the rolled required level then lands inside the band. Otherwise fall back to
  // the legacy stage item-level gate.
  const cap = band ? band[1] : itemLevel;
  const eligible = ITEM_CATALOG.filter(
    (d) => d.requiredLevel <= cap && (fromBoss || !BOSS_ONLY_RARITIES.has(d.rarity)),
  );
  if (eligible.length === 0) return null;

  // Weighted pick by each item's rarity weight.
  const total = eligible.reduce((sum, d) => sum + RARITY_DROP_WEIGHT[d.rarity], 0);
  let roll = rng.next() * total;
  let def = eligible[eligible.length - 1];
  for (const d of eligible) {
    roll -= RARITY_DROP_WEIGHT[d.rarity];
    if (roll < 0) {
      def = d;
      break;
    }
  }

  const reqLevel = band ? rollReqInBand(rng, def.requiredLevel, band[0], band[1]) : itemLevel;
  const inst = rollItem(def, itemLevel, Math.floor(rng.next() * 999983), reqLevel);
  const instSave = toItemInstanceSave(inst);
  save.inventory.items.push(instSave);
  return instSave;
}
