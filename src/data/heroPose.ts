// Pure: which hero weapon-class pose (if any) to show for an equipped weapon.
// Only bow/fist/gun/staff have pose art; everything else falls back to the
// animated hero__hero idle. Phaser-free, tested.
import type { WeaponType } from "./schema.ts";

export type HeroPoseFamily = "bow" | "fist" | "gun" | "staff";

const POSE_BY_WEAPON: Partial<Record<WeaponType, HeroPoseFamily>> = {
  Bow: "bow",
  Fist: "fist",
  Gun: "gun",
  Staff: "staff",
};

/** The pose family for an equipped weapon's type, or null if none has art. */
export function heroPoseFamily(weaponType: WeaponType | null | undefined): HeroPoseFamily | null {
  return (weaponType && POSE_BY_WEAPON[weaponType]) ?? null;
}
