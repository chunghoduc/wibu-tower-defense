import { type CharacterDef } from "./schema.ts";
import { augmentTowerStats, applyDamageArchetype } from "./towerStats.ts";

/**
 * Wrap a character definition: fill the defensive stat layer, enforce the
 * damage-type offensive archetype (Physical = high atk/rate, no skill power;
 * Magic = low atk/rate, high skill power), and stamp the art placeholder.
 */
export function t(def: Omit<CharacterDef, "artRef">): CharacterDef {
  const augmented = augmentTowerStats(def.role, def.rarity, def.baseStats);
  const baseStats = applyDamageArchetype(def.damageType, def.rarity, augmented);
  return { ...def, baseStats, artRef: "placeholder" };
}
