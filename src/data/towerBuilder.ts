import { makeStats, type CharacterDef, type AttackDamageType } from "./schema.ts";
import { augmentTowerStats, applyDamageArchetype, towerBaseline } from "./towerStats.ts";
import { deriveDamageType } from "./weaponFamily.ts";

/** A tower definition before building: artRef is stamped, damageType is derived. */
type TowerInput = Omit<CharacterDef, "artRef" | "damageType"> & {
  /** Optional explicit override; normally omitted and derived from meta.weapon. */
  damageType?: AttackDamageType;
};

/**
 * Wrap a character definition into a balanced, art-stamped tower. Layers:
 *  1. role × rarity baseline owns the CORE power budget (atk/rate/range/hp/mana
 *     + placement cost) so the roster scales coherently;
 *  2. the per-tower baseStats supply FLAVOUR (crit, penetration, lifesteal…) on
 *     top — identity (role, type, passives, active, behaviour) is preserved;
 *  3. augmentTowerStats fills the defensive/survival layer by role × rarity;
 *  4. applyDamageArchetype splits Physical (high atk/rate, no skill power) from
 *     Magic (low atk/rate, high skill power → powerful actives).
 *
 * `damageType` is DERIVED from the structured weapon (family + elemental enchant)
 * so a bow is always Physical and a tome always Magic — no hand-authored value to
 * drift. An explicit `damageType` may be supplied only as a deliberate override
 * and must agree with the weapon.
 */
export function t(def: TowerInput): CharacterDef {
  const spec = def.meta?.weapon;
  const derived = spec ? deriveDamageType(spec) : undefined;
  if (def.damageType && derived && def.damageType !== derived) {
    throw new Error(
      `tower ${def.id}: authored damageType ${def.damageType} disagrees with weapon-derived ${derived}`,
    );
  }
  const damageType = def.damageType ?? derived;
  if (!damageType) throw new Error(`tower ${def.id}: cannot derive damageType (no meta.weapon)`);

  const { core, cost } = towerBaseline(def.role, def.rarity);
  const budgeted = makeStats({ ...def.baseStats, ...core }); // baseline owns the core keys
  const augmented = augmentTowerStats(def.role, def.rarity, budgeted);
  const baseStats = applyDamageArchetype(damageType, def.rarity, augmented);
  return { ...def, damageType, cost, baseStats, artRef: "placeholder" };
}
