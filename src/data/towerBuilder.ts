import { type CharacterDef } from "./schema.ts";
import { augmentTowerStats } from "./towerStats.ts";

/** Wrap a character definition: fill the defensive stat layer + art placeholder. */
export function t(def: Omit<CharacterDef, "artRef">): CharacterDef {
  return { ...def, baseStats: augmentTowerStats(def.role, def.rarity, def.baseStats), artRef: "placeholder" };
}
