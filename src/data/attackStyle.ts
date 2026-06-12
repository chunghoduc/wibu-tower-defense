/**
 * Per-character attack visual style (T6). Derived from a tower's role, damage
 * type, range and themed name so each character's basic attack reads distinctly
 * — bows loose arrows, fire mages throw fireballs, ice mages iceballs, chain
 * units arc lightning, brawlers slash, cannons lob shells, etc. — without hand-
 * tagging all 32 characters. The renderer (fx.ts) draws each style differently.
 */
import type { CharacterDef, WeaponType } from "./schema.ts";

export type AttackStyle =
  | "arrow"
  | "fireball"
  | "iceball"
  | "lightning"
  | "arcane"
  | "cannon"
  | "poison"
  | "holy"
  | "slash"
  | "hex"
  | "punch"
  | "gunshot"
  // Melee swing archetypes — each reads as a distinct hand-to-hand strike.
  | "flurry"
  | "smash";

const RANGED_MELEE = 120;
const has = (s: string, ...keys: string[]) => keys.some((k) => s.includes(k));

/**
 * Hand-to-hand swing styles. A tower whose basic attack reads as one of these
 * fights at melee reach and CLEAVES — every swing strikes all enemies within
 * its (short) range for full damage. Ranged/elemental/aura styles do not. `hex`
 * is deliberately excluded: it's the ranged debuff touch, not a melee swing.
 */
const MELEE_STYLES: ReadonlySet<AttackStyle> = new Set(["slash", "flurry", "punch", "smash"]);

/** Whether an attack style is a melee swing (and therefore cleaves). */
export function isMeleeStyle(style: AttackStyle): boolean {
  return MELEE_STYLES.has(style);
}

/** Pick a basic-attack style for a character from its structured weapon spec. */
export function attackStyleFor(def: CharacterDef): AttackStyle {
  const spec = def.meta?.weapon;
  if (!spec) return fallbackStyle(def); // defensive: towers always carry a spec

  const el = spec.element;
  const fire = el === "fire",
    ice = el === "ice",
    elec = el === "lightning",
    poison = el === "poison";

  // Aura-based archetypes read by effect, not by a flying projectile.
  if (def.role === "support") return "holy";
  if (def.role === "debuff") return ice ? "iceball" : "hex";
  // Tankers are walls — they body-slam and crack the ground.
  if (def.role === "tanker") return "smash";

  // Elemental theme drives the projectile flavour (incl. enchanted melee weapons).
  if (fire) return "fireball";
  if (ice) return "iceball";
  if (elec) return "lightning";
  if (poison) return "poison";
  if (el === "holy") return "holy"; // radiant-imbued weapon casts a holy bolt

  // Otherwise the weapon the character actually holds.
  switch (spec.family) {
    case "bow":
    case "crossbow":
      return "arrow";
    case "gun":
      return "cannon";
    case "blunt":
      return "smash";
    case "spear":
    case "sword":
      if (def.baseStats.range >= RANGED_MELEE) return "arcane";
      return spec.multi ? "flurry" : "slash"; // several blades → a rapid flurry
    case "staff":
    case "wand":
    case "tome":
    case "scepter":
    case "rod":
    case "orb":
      return "arcane";
    case "fist":
      if (def.damageType === "Magic") return "arcane"; // ki/spirit fists cast
      return spec.heavy ? "smash" : "punch";
    default:
      // thrown / thorn / sand / banner / nature / curse / shadow / talisman /
      // instrument / aura / charm — read by role / damage type.
      return fallbackStyle(def);
  }
}

/** Role/range fallback when no weapon family maps to a concrete swing or loose. */
function fallbackStyle(def: CharacterDef): AttackStyle {
  if (def.role === "dot") return "poison";
  if (def.role === "chain") return "lightning";
  if (def.damageType === "Magic") return "arcane";
  return def.baseStats.range >= RANGED_MELEE ? "arrow" : "slash";
}

/**
 * The hero's basic-attack style — driven entirely by the equipped weapon family so
 * the attack reads as what the hero is holding: bare fists box, swords slash, bows
 * loose arrows, guns fire bullets, staves/tomes cast magic bolts. `Any` (or an
 * unrecognised family) falls back to the old damage-type/range heuristic.
 */
export function heroAttackStyle(
  weaponType: WeaponType | null,
  damageType: string,
  range: number,
): AttackStyle {
  switch (weaponType) {
    case "Fist":
      return "punch";
    case "Sword":
      return "slash";
    case "Bow":
      return "arrow";
    case "Gun":
      return "gunshot";
    case "Staff":
    case "Tome":
      return "arcane";
    case null:
      return "punch"; // unarmed — boxing
    default:
      if (damageType === "Magic") return "arcane";
      return range >= RANGED_MELEE ? "arrow" : "slash";
  }
}

export type SkillStyle = "fire" | "ice" | "lightning" | "heal" | "slash" | "poison" | "arcane";

/** Visual style for an ACTIVE skill, derived from its id/name keywords (T7). */
export function skillStyleFor(skillId: string | undefined): SkillStyle {
  const s = (skillId ?? "").toLowerCase();
  if (
    has(
      s,
      "ember",
      "flame",
      "fire",
      "inferno",
      "eruption",
      "magma",
      "wild",
      "blaze",
      "ignit",
      "sun",
    )
  )
    return "fire";
  if (has(s, "ice", "glaci", "blizzard", "geyser", "frost", "chill", "snow", "freez")) return "ice";
  if (has(s, "thunder", "lightning", "chain", "kirin", "bolt", "spark", "storm"))
    return "lightning";
  if (
    has(
      s,
      "heal",
      "rebirth",
      "reject",
      "rally",
      "pep",
      "cheer",
      "crescendo",
      "wind",
      "creation",
      "blessing",
    )
  )
    return "heal";
  if (has(s, "slash", "cleave", "iaido", "punch", "fist", "strike", "draw", "war-cry"))
    return "slash";
  if (has(s, "poison", "plague", "rot", "bramble", "toxin", "venom", "tar", "corros"))
    return "poison";
  return "arcane";
}

/** Primary color for a skill style. */
export const SKILL_STYLE_COLOR: Record<SkillStyle, number> = {
  fire: 0xff6a2a,
  ice: 0x6fc6ff,
  lightning: 0x9fe6ff,
  heal: 0x8be06a,
  slash: 0xffe07a,
  poison: 0x9ccc65,
  arcane: 0xc77dde,
};

/**
 * Mechanical-motion archetype for a tower ACTIVE skill — orthogonal to the
 * element (`SkillStyle`). Element = substance + colour; shape = how it moves and
 * arrives. Together they de-collapse the 52 tower actives from 7 looks into many.
 */
export type SkillShape = "nova" | "chain" | "barrage" | "beam" | "cloud" | "slam" | "aura" | "bolt";

/** Runtime list of every shape (keep in sync with `SkillShape`). */
export const SKILL_SHAPES: readonly SkillShape[] = [
  "nova",
  "chain",
  "barrage",
  "beam",
  "cloud",
  "slam",
  "aura",
  "bolt",
];

/**
 * Shape for a tower's active skill, derived from its ROLE (reliable structured
 * data). Only the `damage` role is ambiguous, so it's refined by skill-name
 * keyword into a focused beam, a rapid barrage, or a plain charged bolt.
 */
export function towerSkillShape(def: CharacterDef): SkillShape {
  switch (def.role) {
    case "splash":
      return "nova";
    case "chain":
      return "chain";
    case "dot":
      return "cloud";
    case "debuff":
      return "cloud";
    case "support":
      return "aura";
    case "tanker":
      return "slam";
    case "damage": {
      const s = (def.active ?? "").toLowerCase();
      if (
        has(
          s,
          "wave",
          "flash",
          "hollow",
          "purple",
          "palm",
          "kame",
          "serious",
          "punch",
          "fist",
          "ki",
          "ball",
          "spirit",
          "beam",
          "ray",
          "dimensional",
        )
      )
        return "beam";
      if (
        has(
          s,
          "volley",
          "salvo",
          "missile",
          "rapid",
          "spin",
          "siege",
          "shot",
          "barrage",
          "fusillade",
        )
      )
        return "barrage";
      return "bolt";
    }
    default:
      return "bolt";
  }
}
