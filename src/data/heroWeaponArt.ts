// src/data/heroWeaponArt.ts
//
// Pure mapping from an equipped weapon's WeaponType to the battle-hero art keys.
// The battle hero is no longer a worn-gear paper-doll: it is a single pre-drawn
// sprite chosen by weapon class, with two poses (combat stance + attack money-shot).
// Every WeaponType has its own archetype art; null/unknown falls back to "any"
// (a versatile adventurer) so the hero always has a body. Phaser-free, tested.

import { WEAPON_TYPES, type WeaponType } from "./schemaEnums.ts";
import { heroBattleTex, heroBattleAttackTex } from "./assetKeys.ts";

export interface WeaponArtKeys {
  /** Combat-stance texture key (idle / moving / hurting). */
  stanceKey: string;
  /** Attack-pose texture key (swapped in during the strike/cast window). */
  attackKey: string;
}

const KNOWN = new Set<string>(WEAPON_TYPES);

/** Lower-cased art id for a weapon type ("Sword" → "sword"); "any" when unknown. */
export function weaponArtId(weaponType: WeaponType | null | undefined): string {
  if (weaponType && KNOWN.has(weaponType)) return weaponType.toLowerCase();
  return "any";
}

/** The battle-hero stance + attack art keys for an equipped weapon type. */
export function weaponArtKeys(weaponType: WeaponType | null | undefined): WeaponArtKeys {
  const id = weaponArtId(weaponType);
  return { stanceKey: heroBattleTex(id), attackKey: heroBattleAttackTex(id) };
}
