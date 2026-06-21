/**
 * Characteristic attack reach per HERO weapon family. The hero's WeaponType maps
 * onto the canonical tower weapon families (weaponFamily.ts) so towers and the
 * hero share one reach table: swords reach a melee step, bows/guns snipe from
 * afar, staves/tomes cast at mid range. Values straddle
 * the RANGED_MELEE threshold (120, see attackStyle.ts). `% range` affixes scale on
 * top of this base in the hero stat pipeline.
 */
import type { WeaponType } from "./schema.ts";
import { FAMILY, type WeaponFamily } from "./weaponFamily.ts";

/** Maps a hero WeaponType onto its tower weapon family; `Any` has no family. */
const HERO_WEAPON_FAMILY: Record<WeaponType, WeaponFamily | null> = {
  Sword: "sword",
  Bow: "bow",
  Gun: "gun",
  Staff: "staff",
  Tome: "tome",
  Any: null,
};

const ANY_RANGE = 150;

export const WEAPON_RANGE: Record<WeaponType, number> = {
  Sword: FAMILY.sword.range,
  Bow: FAMILY.bow.range,
  Gun: FAMILY.gun.range,
  Staff: FAMILY.staff.range,
  Tome: FAMILY.tome.range,
  Any: ANY_RANGE,
};

/** Hero reach for the equipped weapon family; unarmed defaults to sword reach. */
export function heroRangeForWeapon(weaponType: WeaponType | null): number {
  if (!weaponType) return WEAPON_RANGE.Sword;
  const fam = HERO_WEAPON_FAMILY[weaponType];
  return fam ? FAMILY[fam].range : ANY_RANGE;
}
