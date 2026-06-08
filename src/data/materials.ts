/**
 * Crafting materials & loot boxes — stored as counts in HeroSave.materials
 * (keyed by id). Jewels drive the item enhance system (T13); boxes are boss
 * rewards opened for loot (T15).
 */
export const BLESS_JEWEL = "bless-jewel";
export const SOUL_JEWEL = "soul-jewel";
export const SUMMON_SCROLL = "summon-scroll";
export const OBLIVION_ORB = "oblivion-orb";

export type MaterialKind = "jewel" | "box" | "scroll" | "consumable";

export interface MaterialDef {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Short icon key (rendered by the icon system). */
  icon: string;
  description: string;
  /** box only: which loot table to roll when opened. */
  lootTable?: string;
  /** box only: rarity tier (1..5) — higher = bigger reward. */
  rarity?: number;
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
  {
    id: SUMMON_SCROLL, name: "Summoning Scroll", kind: "scroll", icon: "scroll",
    description: "A rare scroll dropped by bosses. Use it in the Summon Hall for one free summon.",
  },
  {
    id: OBLIVION_ORB, name: "Oblivion Orb", kind: "consumable", icon: "oblivion",
    description: "A rare orb that unwinds a single memory. Spend it in the Passive Tree to forget one allocated skill and refund its point.",
  },
];

/**
 * Boss loot boxes (T15). A chest's TIER doubles as its RARITY (1..5 =
 * Common..Unique): the higher the rarity, the bigger the reward when opened.
 * Bosses usually drop a chest near the stage's base rarity, but can drop a
 * higher (or lower) one by luck — better difficulty improves the odds.
 */
export const BOX_TIERS = 5;
export function boxIdForTier(tier: number): string {
  return `boss-box-t${Math.max(1, Math.min(BOX_TIERS, tier))}`;
}

const BOX_RARITY_NAME = ["", "Common", "Magic", "Rare", "Legendary", "Unique"];
/** Display colour for a box's rarity tier (matches the item rarity palette). */
export const BOX_RARITY_COLOR: Record<number, number> = {
  1: 0x9e9e9e, 2: 0x2196f3, 3: 0x9c27b0, 4: 0xff9800, 5: 0xf44336,
};
export function boxRarityName(tier: number): string {
  return BOX_RARITY_NAME[Math.max(1, Math.min(BOX_TIERS, tier))];
}

for (let t = 1; t <= BOX_TIERS; t++) {
  MATERIALS.push({
    id: boxIdForTier(t), name: `${boxRarityName(t)} Boss Chest`, kind: "box", icon: "box", rarity: t,
    description: `A ${boxRarityName(t).toLowerCase()} chest dropped by a stage boss — open for crystals, jewels and gear. Higher rarity = bigger reward.`,
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
