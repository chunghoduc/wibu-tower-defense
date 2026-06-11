/**
 * Categorical attributes — the closed vocabularies every catalog entry draws
 * from (damage types, roles, rarities, slots, …). Re-exported by `schema.ts`.
 */

export const DAMAGE_TYPES = ["Physical", "Magic", "True"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const TARGET_TYPES = ["Ground", "Air", "Both"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const TOWER_ROLES = [
  "damage",
  "splash",
  "chain",
  "dot",
  "support",
  "debuff",
  "tanker",
] as const;
export type TowerRole = (typeof TOWER_ROLES)[number];

/**
 * Damage type a tower's BASIC ATTACK may deal. Towers auto-attack only in
 * Physical or Magic; True damage is reserved for passive/active SKILLS (see
 * TowerBehavior.activeType and the DoT damageType override).
 */
export const ATTACK_DAMAGE_TYPES = ["Physical", "Magic"] as const;
export type AttackDamageType = (typeof ATTACK_DAMAGE_TYPES)[number];

export const RARITIES = ["Common", "Magic", "Rare", "Legendary", "Unique"] as const;
export type Rarity = (typeof RARITIES)[number];

/** An enemy may be immune to at most ONE of these (the "no lock-and-key" rule). */
export const IMMUNITIES = ["Physical", "Magic", "CC", "AoE"] as const;
export type Immunity = (typeof IMMUNITIES)[number];

export const ENEMY_ARCHETYPES = [
  "Rusher",
  "Brute",
  "Bulwark",
  "Mender",
  "Regenerator",
  "Splitter",
  "Gargoyle",
  "StormFlyer",
  "Sapper",
  "Phantom",
  "Summoner",
  "Raider",
  "Courier",
  "Juggernaut",
  "Herald",
  "Hexer",
  "Berserker",
  "Adapter",
  "Burster",
  "Dreadnought",
  "Disruptor",
  "Boss",
] as const;
export type EnemyArchetype = (typeof ENEMY_ARCHETYPES)[number];

export const ITEM_SLOTS = [
  "Weapon",
  "Helmet",
  "BodyArmor",
  "Gloves",
  "Boots",
  "Amulet",
  "Ring1",
  "Ring2",
  "Pet",
  "Wing",
] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

/**
 * Item CATEGORY slots. Identical to the equip slots except the two ring slots
 * collapse to a single "Ring": a ring item isn't a "Ring1" or "Ring2" item, it's
 * just a ring that fits EITHER ring slot.
 */
export type ItemDefSlot = Exclude<ItemSlot, "Ring1" | "Ring2"> | "Ring";

/** The equip slot(s) an item of category `slot` can occupy (a Ring fits both). */
export function equipSlotsFor(slot: ItemDefSlot): ItemSlot[] {
  return slot === "Ring" ? ["Ring1", "Ring2"] : [slot];
}

export const WEAPON_TYPES = ["Sword", "Bow", "Staff", "Gun", "Tome", "Fist", "Any"] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const PASSIVE_NODE_TYPES = ["path", "notable", "keystone", "mastery", "jewel-socket"] as const;
export type PassiveNodeType = (typeof PASSIVE_NODE_TYPES)[number];

export const PASSIVE_REGIONS = [
  "brawler", "arcane", "warden", "tactician",
  "predator", "phantom", "conduit", "prestige",
] as const;
export type PassiveRegion = (typeof PASSIVE_REGIONS)[number];
