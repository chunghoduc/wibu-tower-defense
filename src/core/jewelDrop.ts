import { JEWEL_CATALOG, type JewelDef } from "../data/jewels.ts";
import type { Rarity } from "../data/schema.ts";
import type { HeroSave, JewelInstanceSave } from "./save.ts";
import { type Rng } from "./rng.ts";

/** Relative drop weight per rarity — commons are the staple, uniques the prize. */
const RARITY_WEIGHT: Record<Rarity, number> = {
  Common: 55,
  Magic: 28,
  Rare: 13,
  Legendary: 0, // jewels don't use the Legendary tier
  Unique: 4,
};

const JEWELS_BY_RARITY = new Map<Rarity, JewelDef[]>();
for (const jw of JEWEL_CATALOG) {
  const list = JEWELS_BY_RARITY.get(jw.rarity) ?? [];
  list.push(jw);
  JEWELS_BY_RARITY.set(jw.rarity, list);
}

/**
 * Roll one dropped jewel, grant it to the hero's owned pool, and return the
 * instance. Rarity is weighted (see RARITY_WEIGHT); within a rarity the jewel is
 * uniform-random. Returns null only if the catalog is somehow empty.
 */
export function rollJewelDrop(save: HeroSave, rng: Rng): JewelInstanceSave | null {
  const rarities = (Object.keys(RARITY_WEIGHT) as Rarity[]).filter(
    (r) => (JEWELS_BY_RARITY.get(r)?.length ?? 0) > 0,
  );
  const total = rarities.reduce((sum, r) => sum + RARITY_WEIGHT[r], 0);
  if (total <= 0) return null;

  let roll = rng.next() * total;
  let rarity: Rarity = rarities[0];
  for (const r of rarities) {
    roll -= RARITY_WEIGHT[r];
    if (roll < 0) {
      rarity = r;
      break;
    }
  }

  const pool = JEWELS_BY_RARITY.get(rarity)!;
  const def = pool[Math.floor(rng.next() * pool.length)];
  const instance: JewelInstanceSave = {
    id: `jewel-${def.id}-${(rng.next() * 1e9) | 0}`,
    defId: def.id,
  };
  save.hero.jewels.push(instance);
  return instance;
}
