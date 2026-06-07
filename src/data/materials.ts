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

export const MATERIALS_MAP = new Map<string, MaterialDef>(MATERIALS.map((m) => [m.id, m]));

/** Register additional materials (e.g. boss boxes from another module). */
export function registerMaterials(defs: MaterialDef[]): void {
  for (const d of defs) {
    if (!MATERIALS_MAP.has(d.id)) { MATERIALS.push(d); MATERIALS_MAP.set(d.id, d); }
  }
}
