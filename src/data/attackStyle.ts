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
  // Elements are read from the WEAPON description only — the character name can
  // contain misleading substrings (e.g. "Thr-ice-draw"); every elemental weapon
  // states its element explicitly.
  const w = (def.meta?.weapon ?? "").toLowerCase();
  const fire = has(w, "ember", "flame", "fire", "molten", "magma", "wild", "inferno", "blaze", "burn", "powder", "explosion", "eruption", "lava", "foxfire", "ignit", "bomb");
  const ice = has(w, "ice", "frost", "chill", "snow", "hoar", "blizzard", "glacial", "freez");
  const elec = has(w, "thunder", "lightning", "bolt", "storm", "volt", "chidori", "spark");
  const poison = has(w, "poison", "venom", "toxin", "plague", "rot", "bramble", "corros", "blight", "decay", "barbed", "thorn");

  // Aura-based archetypes read by effect, not by a flying projectile.
  if (def.role === "support") return "holy";
  if (def.role === "debuff") return ice ? "iceball" : "hex";

  // Elemental theme drives the projectile flavor.
  if (fire) return "fireball";
  if (ice) return "iceball";
  if (elec) return "lightning";
  if (poison) return "poison";

  // Otherwise match the weapon the character actually holds.
  if (has(w, "bow", "arrow")) return "arrow";
  if (has(w, "cannon", "gun", "firearm", "artillery", "shell", "rifle")) return "cannon";
  if (has(w, "katana", "sword", "blade", "rapier", "glaive", "saber", "chokuto", "cleaver")) return def.baseStats.range >= RANGED_MELEE ? "arcane" : "slash";
  if (has(w, "staff", "wand", "tome", "grimoire", "scepter", "rod")) return "arcane";
  if (/\bki\b/.test(w) || has(w, "fist", "punch", "chakra", "knuckle", "gauntlet", "palm")) return def.damageType === "Magic" ? "arcane" : "slash";

  // Final fallbacks by role / damage type.
  if (def.role === "dot") return "poison";
  if (def.role === "chain") return "lightning";
  if (def.damageType === "Magic") return "arcane";
  return def.baseStats.range >= RANGED_MELEE ? "arrow" : "slash";
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
