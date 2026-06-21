/**
 * Weapon-CLASS gating for active skills — pure, Phaser-free.
 *
 * The hero's WeaponType enum is coarse (Sword/Bow/Staff/Gun/Tome/Any). A
 * skill can require an exact WeaponType (legacy `requiresWeapon`) OR a flexible
 * weapon CLASS. Class membership is the basis for "magic spells require a spell
 * weapon": the magic class is satisfied ONLY by a dedicated caster weapon type
 * (Staff or Tome — scepters and wands are modelled as Staff). It is deliberately
 * NOT satisfied by a gun, a bow, or a sword, even one with a magic build archetype
 * (an enchanted "magic sword" is still a sword, not a spell weapon).
 */
import type { WeaponType } from "../data/schema.ts";

export type WeaponClass = "magic" | "melee" | "ranged";

const MELEE: ReadonlySet<WeaponType> = new Set(["Sword"]);
const RANGED: ReadonlySet<WeaponType> = new Set(["Bow", "Gun"]);
const MAGIC_WEAPONS: ReadonlySet<WeaponType> = new Set(["Staff", "Tome"]);

/**
 * Whether an equipped weapon's coarse `weaponType` satisfies a skill's required
 * weapon class. A skill with no class requirement is always met. An empty weapon
 * slot (`undefined` type) meets no class. Magic requires a dedicated caster weapon
 * type — build archetype is intentionally ignored so a magic gun/bow/sword cannot
 * cast spells.
 */
export function weaponClassMet(
  req: WeaponClass | undefined,
  weaponType: WeaponType | undefined,
): boolean {
  if (!req) return true;
  if (!weaponType) return false;
  switch (req) {
    case "magic":
      return MAGIC_WEAPONS.has(weaponType); // Staff | Tome (spell weapons) only
    case "melee":
      return MELEE.has(weaponType);
    case "ranged":
      return RANGED.has(weaponType);
  }
}
