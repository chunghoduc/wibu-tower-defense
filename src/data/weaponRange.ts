/**
 * Characteristic attack reach per weapon family. A weapon's TYPE — not its rolled
 * stats — sets how far the hero engages: bare fists box at point blank, swords
 * reach a melee step, bows/guns snipe from afar, staves/tomes cast at mid range.
 * Values straddle the RANGED_MELEE threshold (120, see attackStyle.ts) so each
 * family reads correctly as melee or ranged. `% range` affixes (e.g. a Bow rolling
 * "range") scale on top of this family base in the hero stat pipeline.
 */
import type { WeaponType } from "./schema.ts";

export const WEAPON_RANGE: Record<WeaponType, number> = {
  Fist: 90,
  Sword: 115,
  Bow: 240,
  Gun: 260,
  Staff: 210,
  Tome: 195,
  Any: 150,
};

/** Hero reach for the equipped weapon family; unarmed boxes at the Fist range. */
export function heroRangeForWeapon(weaponType: WeaponType | null): number {
  return weaponType ? WEAPON_RANGE[weaponType] : WEAPON_RANGE.Fist;
}
