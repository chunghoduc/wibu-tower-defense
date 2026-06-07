/**
 * Crafting materials & loot boxes — stored as counts in HeroSave.materials
 * (keyed by id). Jewels drive the item enhance system (T13); boxes are boss
 * rewards opened for loot (T15).
 */
export const BLESS_JEWEL = "bless-jewel";
export const SOUL_JEWEL = "soul-jewel";

export type MaterialKind = "jewel" | "box";

export interface MaterialDef {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Short icon key (rendered by the icon system). */
  icon: string;
  description: string;
  /** box only: which loot table to roll when opened. */
  lootTable?: string;
}

export const MATERIALS: MaterialDef[] = [
  {
    id: BLESS_JEWEL, name: "Jewel of Bless", kind: "jewel", icon: "bless",
    description: "Enhances an item from +0 up to +6 — always succeeds.",
  },
  {
    id: SOUL_JEWEL, name: "Jewel of Soul", kind: "jewel", icon: "soul",
    description: "Enhances an item beyond +6. Success falls 10% per level; on failure the item loses 1–5 levels.",
  },
];

/** Boss loot boxes, one tier per pair of stages (T15). Higher tier = better loot. */
export const BOX_TIERS = 5;
export function boxIdForTier(tier: number): string {
  return `boss-box-t${Math.max(1, Math.min(BOX_TIERS, tier))}`;
}
const BOX_TIER_NAME = ["", "Worn", "Sturdy", "Gilded", "Royal", "Sovereign"];
for (let t = 1; t <= BOX_TIERS; t++) {
  MATERIALS.push({
    id: boxIdForTier(t), name: `${BOX_TIER_NAME[t]} Boss Chest`, kind: "box", icon: "box",
    description: `A chest dropped by a stage boss. Open for crystals, jewels and gear (tier ${t}).`,
    lootTable: `t${t}`,
  });
}

export const MATERIALS_MAP = new Map<string, MaterialDef>(MATERIALS.map((m) => [m.id, m]));

/** Register additional materials (e.g. boss boxes from another module). */
export function registerMaterials(defs: MaterialDef[]): void {
  for (const d of defs) {
    if (!MATERIALS_MAP.has(d.id)) { MATERIALS.push(d); MATERIALS_MAP.set(d.id, d); }
  }
}
