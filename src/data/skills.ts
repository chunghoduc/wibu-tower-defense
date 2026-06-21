import { type ActiveSkillDef, validateActiveSkill } from "./schema.ts";

function s(def: ActiveSkillDef): ActiveSkillDef {
  return validateActiveSkill(def);
}

export const ACTIVE_SKILLS: ActiveSkillDef[] = [
  // Starter skills every hero begins with — one Physical, one Magic, and neither
  // needs a particular weapon, so a brand-new hero always has usable actives.
  s({
    id: "valiant-strike",
    name: "Valiant Strike",
    rarity: "Common",
    description: "A sweeping heroic blow that strikes all nearby foes. Works with any weapon.",
    damageType: "Physical",
    basePower: 85,
    artRef: "placeholder",
  }),
  s({
    id: "spirit-bolt",
    name: "Spirit Bolt",
    rarity: "Common",
    description: "Hurl a bolt of raw spirit energy that bursts on impact. Works with any weapon.",
    damageType: "Magic",
    basePower: 85,
    artRef: "placeholder",
  }),
  s({
    id: "iron-cleave",
    name: "Iron Cleave",
    rarity: "Common",
    description: "A wide arc that cleaves all nearby enemies.",
    requiresWeapon: "Sword",
    damageType: "Physical",
    basePower: 80,
    artRef: "placeholder",
  }),
  s({
    id: "stone-bash",
    name: "Stone Bash",
    rarity: "Magic",
    description: "A stunning overhead blow that pulverises armour.",
    requiresWeapon: "Fist",
    damageType: "Physical",
    basePower: 110,
    artRef: "placeholder",
  }),
  s({
    id: "execute-slash",
    name: "Execute",
    rarity: "Rare",
    description: "A brutal finishing blow — deals bonus damage to weakened enemies.",
    requiresWeapon: "Sword",
    damageType: "Physical",
    basePower: 160,
    artRef: "placeholder",
  }),
  s({
    id: "tri-shot",
    name: "Tri-Shot",
    rarity: "Common",
    description: "Fire three bolts in a wide spread.",
    requiresWeapon: "Bow",
    damageType: "Physical",
    basePower: 75,
    artRef: "placeholder",
  }),
  s({
    id: "piercing-arrow",
    name: "Piercing Arrow",
    rarity: "Rare",
    description: "An arrow that passes through every enemy in a line.",
    requiresWeapon: "Bow",
    damageType: "Physical",
    basePower: 145,
    artRef: "placeholder",
  }),
  s({
    id: "mana-burst",
    name: "Mana Burst",
    rarity: "Common",
    description: "Release a burst of raw magical energy. Works with any magic weapon.",
    weaponClass: "magic",
    damageType: "Magic",
    basePower: 90,
    artRef: "placeholder",
  }),
  s({
    id: "arcane-nova",
    name: "Arcane Nova",
    rarity: "Legendary",
    description: "An expanding ring of arcane force that damages everything it touches.",
    weaponClass: "magic",
    damageType: "Magic",
    basePower: 250,
    artRef: "placeholder",
  }),
  s({
    id: "rapid-fire",
    name: "Rapid Fire",
    rarity: "Magic",
    description: "A burst of five rapid shots at the nearest enemy.",
    requiresWeapon: "Gun",
    damageType: "Physical",
    basePower: 100,
    artRef: "placeholder",
  }),
  s({
    id: "concussion-round",
    name: "Concussion Round",
    rarity: "Rare",
    description: "A heavy round that stuns the target on impact.",
    requiresWeapon: "Gun",
    damageType: "Physical",
    basePower: 140,
    artRef: "placeholder",
  }),
  s({
    id: "shadow-curse",
    name: "Shadow Curse",
    rarity: "Magic",
    description: "Apply a weakening curse that amplifies all damage taken. Works with any magic weapon.",
    weaponClass: "magic",
    damageType: "Magic",
    basePower: 95,
    artRef: "placeholder",
  }),
  s({
    id: "true-strike",
    name: "True Strike",
    rarity: "Legendary",
    description: "A technique perfected beyond all defences — deals True damage.",
    damageType: "True",
    basePower: 200,
    artRef: "placeholder",
  }),
  s({
    id: "void-palm",
    name: "Void Palm",
    rarity: "Unique",
    description: "A palm strike that tears through reality itself.",
    requiresWeapon: "Fist",
    damageType: "True",
    basePower: 320,
    artRef: "placeholder",
  }),
];

export const ACTIVE_SKILLS_MAP = new Map<string, ActiveSkillDef>(
  ACTIVE_SKILLS.map((s) => [s.id, s]),
);

/** The weapon-free actives every hero starts with (one Physical, one Magic). */
export const STARTER_SKILL_IDS = ["valiant-strike", "spirit-bolt"] as const;

/** How many active skills the hero can have equipped at once. */
export const MAX_ACTIVE_SKILLS = 1;
