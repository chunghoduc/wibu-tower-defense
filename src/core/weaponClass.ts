/**
 * Weapon-CLASS gating for active skills — pure, Phaser-free.
 *
 * The hero's WeaponType enum is coarse (Sword/Bow/Staff/Gun/Tome/Fist/Any). A
 * skill can require an exact WeaponType (legacy `requiresWeapon`) OR a flexible
 * weapon CLASS. Class membership is the basis for "magic spells should work with
 * a staff, a tome/book, OR a magic sword": the magic class is satisfied by any
 * dedicated caster weapon AND by any weapon whose build archetype is "magic"
 * (an enchanted / spell-affix sword).
 */
import type { WeaponType } from "../data/schema.ts";
import type { ItemArchetype } from "../data/itemArchetype.ts";

export type WeaponClass = "magic" | "melee" | "ranged";

const MELEE: ReadonlySet<WeaponType> = new Set(["Sword", "Fist"]);
const RANGED: ReadonlySet<WeaponType> = new Set(["Bow", "Gun"]);
const MAGIC_WEAPONS: ReadonlySet<WeaponType> = new Set(["Staff", "Tome"]);

/**
 * Whether an equipped weapon (its coarse `weaponType` plus its derived build
 * `archetype`) satisfies a skill's required weapon class. A skill with no class
 * requirement is always met. An empty weapon slot (`undefined` type) meets no
 * class.
 */
export function weaponClassMet(
  req: WeaponClass | undefined,
  weaponType: WeaponType | undefined,
  archetype: ItemArchetype | undefined,
): boolean {
  if (!req) return true;
  if (!weaponType) return false;
  switch (req) {
    case "magic":
      // Dedicated casters, or any weapon built as a magic carry (magic swords).
      return MAGIC_WEAPONS.has(weaponType) || archetype === "magic";
    case "melee":
      return MELEE.has(weaponType);
    case "ranged":
      return RANGED.has(weaponType);
  }
}
