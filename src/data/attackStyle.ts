/**
 * Per-character attack visual style (T6). Derived from a tower's role, damage
 * type, range and themed name so each character's basic attack reads distinctly
 * — bows loose arrows, fire mages throw fireballs, ice mages iceballs, chain
 * units arc lightning, brawlers slash, cannons lob shells, etc. — without hand-
 * tagging all 32 characters. The renderer (fx.ts) draws each style differently.
 */
import type { CharacterDef } from "./schema.ts";

export type AttackStyle =
  | "arrow" | "fireball" | "iceball" | "lightning" | "arcane"
  | "cannon" | "poison" | "holy" | "slash" | "hex";

const RANGED_MELEE = 120;
const has = (s: string, ...keys: string[]) => keys.some((k) => s.includes(k));

/** Pick an attack style for a character. */
export function attackStyleFor(def: CharacterDef): AttackStyle {
  const n = def.name.toLowerCase() + " " + def.id.toLowerCase();
  const fire = has(n, "ember", "flame", "fire", "molten", "magma", "wild", "inferno", "blaze", "sun", "phoenix", "burn", "powder", "spark");
  const ice = has(n, "ice", "frost", "glace", "chill", "snow", "hoar", "blizzard", "winter", "glacial");
  const elec = has(n, "spark", "thunder", "lightning", "bolt", "storm", "tempo", "volt");

  switch (def.role) {
    case "support": return "holy";
    case "chain": return def.damageType === "Magic" ? (ice ? "iceball" : "lightning") : "lightning";
    case "splash": return fire ? "fireball" : "cannon";
    case "dot": return fire ? "fireball" : "poison";
    case "debuff": return ice ? "iceball" : "hex";
    case "damage":
    default:
      if (def.damageType === "Magic") return fire ? "fireball" : ice ? "iceball" : elec ? "lightning" : "arcane";
      return def.baseStats.range >= RANGED_MELEE ? "arrow" : "slash";
  }
}

/** A simple hero attack style from its damage type + range. */
export function heroAttackStyle(damageType: string, range: number): AttackStyle {
  if (damageType === "Magic") return "arcane";
  return range >= RANGED_MELEE ? "arrow" : "slash";
}

export type SkillStyle = "fire" | "ice" | "lightning" | "heal" | "slash" | "poison" | "arcane";

/** Visual style for an ACTIVE skill, derived from its id/name keywords (T7). */
export function skillStyleFor(skillId: string | undefined): SkillStyle {
  const s = (skillId ?? "").toLowerCase();
  if (has(s, "ember", "flame", "fire", "inferno", "eruption", "magma", "wild", "blaze", "ignit", "sun")) return "fire";
  if (has(s, "ice", "glaci", "blizzard", "geyser", "frost", "chill", "snow", "freez")) return "ice";
  if (has(s, "thunder", "lightning", "chain", "kirin", "bolt", "spark", "storm")) return "lightning";
  if (has(s, "heal", "rebirth", "reject", "rally", "pep", "cheer", "crescendo", "wind", "creation", "blessing")) return "heal";
  if (has(s, "slash", "cleave", "iaido", "punch", "fist", "strike", "draw", "war-cry")) return "slash";
  if (has(s, "poison", "plague", "rot", "bramble", "toxin", "venom", "tar", "corros")) return "poison";
  return "arcane";
}

/** Primary color for a skill style. */
export const SKILL_STYLE_COLOR: Record<SkillStyle, number> = {
  fire: 0xff6a2a, ice: 0x6fc6ff, lightning: 0x9fe6ff, heal: 0x8be06a, slash: 0xffe07a, poison: 0x9ccc65, arcane: 0xc77dde,
};
