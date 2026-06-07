import { makeStats, type CharacterDef } from "./schema.ts";
import { augmentTowerStats, applyDamageArchetype, towerBaseline } from "./towerStats.ts";

/**
 * Wrap a character definition into a balanced, art-stamped tower. Layers:
 *  1. role × rarity baseline owns the CORE power budget (atk/rate/range/hp/mana
 *     + placement cost) so the roster scales coherently;
 *  2. the per-tower baseStats supply FLAVOUR (crit, penetration, lifesteal…) on
 *     top — identity (role, type, passives, active, behaviour) is preserved;
 *  3. augmentTowerStats fills the defensive/survival layer by role × rarity;
 *  4. applyDamageArchetype splits Physical (high atk/rate, no skill power) from
 *     Magic (low atk/rate, high skill power → powerful actives).
 */
export function t(def: Omit<CharacterDef, "artRef">): CharacterDef {
  const { core, cost } = towerBaseline(def.role, def.rarity);
  const budgeted = makeStats({ ...def.baseStats, ...core }); // baseline owns the core keys
  const augmented = augmentTowerStats(def.role, def.rarity, budgeted);
  const baseStats = applyDamageArchetype(def.damageType, def.rarity, augmented);
  return { ...def, cost, baseStats, artRef: "placeholder" };
}
