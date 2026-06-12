/**
 * Canonical weapon taxonomy — the single source of truth that turns a tower's
 * weapon into its damage type, attack reach, and (via attackStyle.ts) its basic-
 * attack visual. Each family declares a damage CLASS (Physical or Magic) and a
 * base RANGE band. A tower authors only its weapon; damageType is DERIVED, so a
 * bow can never be a "magic" tower by accident.
 *
 * Option (ii) "Elemental Enchant": a physical weapon (fist/sword/…) infused with
 * elemental or spirit energy (`enchanted: true`) reads as Magic — e.g. magma
 * fists, a frost katana. This is the only escape hatch from the family default.
 */
import type { AttackDamageType } from "./schema.ts";

export const WEAPON_ELEMENTS = ["fire", "ice", "lightning", "poison", "holy"] as const;
export type WeaponElement = (typeof WEAPON_ELEMENTS)[number];

export const WEAPON_FAMILIES = [
  // physical melee
  "fist",
  "sword",
  "spear",
  "blunt",
  // physical ranged
  "bow",
  "crossbow",
  "gun",
  "thrown",
  // magic implements
  "staff",
  "tome",
  "scepter",
  "wand",
  "rod",
  "orb",
  // physical conduits / thematic
  "thorn",
  "sand",
  "banner",
  // magic conduits / thematic
  "curse",
  "nature",
  "shadow",
  "talisman",
  "instrument",
  "aura",
  "charm",
] as const;
export type WeaponFamily = (typeof WEAPON_FAMILIES)[number];

/** A tower's structured weapon: family drives everything; the rest is flavour/VFX. */
export interface WeaponSpec {
  /** Weapon family — decides damage class, attack style, and base reach. */
  family: WeaponFamily;
  /** Elemental flavour — picks the projectile/impact VFX (fireball, iceball…). */
  element?: WeaponElement;
  /** Option (ii): elemental/spirit energy infuses a physical weapon → Magic. */
  enchanted?: boolean;
  /** Wields several blades at once → the swing reads as a rapid flurry. */
  multi?: boolean;
  /** A single, world-ending blow → the swing reads as a weighty smash. */
  heavy?: boolean;
  /** Player-facing weapon description shown in the collection codex. */
  display: string;
}

interface FamilyRow {
  damageClass: AttackDamageType;
  /** Characteristic reach; authoring guidance + hero WEAPON_RANGE source. */
  range: number;
}

/** The canonical family → {damage class, base range} table. */
export const FAMILY: Record<WeaponFamily, FamilyRow> = {
  // physical melee
  fist: { damageClass: "Physical", range: 90 },
  sword: { damageClass: "Physical", range: 115 },
  spear: { damageClass: "Physical", range: 120 },
  blunt: { damageClass: "Physical", range: 110 },
  // physical ranged
  bow: { damageClass: "Physical", range: 240 },
  crossbow: { damageClass: "Physical", range: 230 },
  gun: { damageClass: "Physical", range: 260 },
  thrown: { damageClass: "Physical", range: 200 },
  // magic implements
  staff: { damageClass: "Magic", range: 210 },
  tome: { damageClass: "Magic", range: 195 },
  scepter: { damageClass: "Magic", range: 200 },
  wand: { damageClass: "Magic", range: 185 },
  rod: { damageClass: "Magic", range: 195 },
  orb: { damageClass: "Magic", range: 190 },
  // physical conduits / thematic
  thorn: { damageClass: "Physical", range: 160 },
  sand: { damageClass: "Physical", range: 150 },
  banner: { damageClass: "Physical", range: 150 },
  // magic conduits / thematic
  curse: { damageClass: "Magic", range: 180 },
  nature: { damageClass: "Magic", range: 180 },
  shadow: { damageClass: "Magic", range: 175 },
  talisman: { damageClass: "Magic", range: 185 },
  instrument: { damageClass: "Magic", range: 150 },
  aura: { damageClass: "Magic", range: 170 },
  charm: { damageClass: "Magic", range: 150 },
};

/** Derive a tower's basic-attack damage type from its weapon (family + enchant). */
export function deriveDamageType(spec: WeaponSpec): AttackDamageType {
  if (spec.enchanted) return "Magic"; // option (ii): infused physical weapon → Magic
  return FAMILY[spec.family].damageClass;
}

/** The characteristic reach for a weapon family (authoring guidance for towers). */
export function weaponBaseRange(spec: WeaponSpec): number {
  return FAMILY[spec.family].range;
}
