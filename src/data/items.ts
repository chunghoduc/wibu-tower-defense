import { Rng } from "../core/rng.ts";
import {
  type ItemDef,
  type ItemInstance,
  type ItemSlot,
  type Rarity,
  type RolledAffix,
  type Stats,
  type WeaponType,
  validateItemDef,
} from "./schema.ts";

function i(def: ItemDef): ItemDef {
  return validateItemDef(def);
}

const AFFIX_COUNT: Record<string, number> = {
  Common: 0, Magic: 1, Rare: 2, Legendary: 3, Unique: 3,
};

export const ITEM_CATALOG: ItemDef[] = [
  i({ id: "iron-sword", name: "Iron Sword", slot: "Weapon", weaponType: "Sword",
      rarity: "Common", requiredLevel: 1,
      baseStats: { atk: 18 },
      primaryAffix: { type: "physicalDamage", baseValue: 0.08 },
      affixPool: ["critRate", "armorPen"], artRef: "placeholder" }),
  i({ id: "elven-bow", name: "Elven Bow", slot: "Weapon", weaponType: "Bow",
      rarity: "Magic", requiredLevel: 10,
      baseStats: { atk: 22, attackSpeed: 0.3 },
      primaryAffix: { type: "attackSpeed", baseValue: 0.12 },
      affixPool: ["critRate", "critDamage", "range"], artRef: "placeholder" }),
  i({ id: "arcane-staff", name: "Arcane Staff", slot: "Weapon", weaponType: "Staff",
      rarity: "Rare", requiredLevel: 20,
      baseStats: { atk: 14, skillPower: 0.25, maxMana: 20 },
      primaryAffix: { type: "magicDamage", baseValue: 0.18 },
      affixPool: ["skillPower", "magicPen", "manaRegen"], artRef: "placeholder" }),
  i({ id: "thunder-cannon", name: "Thunder Cannon", slot: "Weapon", weaponType: "Gun",
      rarity: "Legendary", requiredLevel: 40,
      baseStats: { atk: 38, armorPen: 0.2 },
      primaryAffix: { type: "physicalDamage", baseValue: 0.25 },
      affixPool: ["critRate", "critDamage", "armorPen", "attackSpeed"], artRef: "placeholder" }),
  i({ id: "leather-cap", name: "Leather Cap", slot: "Helmet",
      rarity: "Common", requiredLevel: 1,
      baseStats: { maxHp: 60 },
      primaryAffix: { type: "maxHp", baseValue: 0.06 },
      affixPool: ["armor", "hpRegen"], artRef: "placeholder" }),
  i({ id: "iron-helm", name: "Iron Helm", slot: "Helmet",
      rarity: "Rare", requiredLevel: 15,
      baseStats: { maxHp: 120, armor: 8 },
      primaryAffix: { type: "maxHp", baseValue: 0.12 },
      affixPool: ["armor", "magicResist", "hpRegen", "tenacity"], artRef: "placeholder" }),
  i({ id: "cloth-robe", name: "Cloth Robe", slot: "BodyArmor",
      rarity: "Common", requiredLevel: 1,
      baseStats: { maxHp: 80, magicResist: 5 },
      primaryAffix: { type: "armor", baseValue: 0.06 },
      affixPool: ["magicResist", "hpRegen"], artRef: "placeholder" }),
  i({ id: "scale-mail", name: "Scale Mail", slot: "BodyArmor",
      rarity: "Rare", requiredLevel: 18,
      baseStats: { maxHp: 150, armor: 12, magicResist: 8 },
      primaryAffix: { type: "armor", baseValue: 0.15 },
      affixPool: ["maxHp", "magicResist", "damageReduction"], artRef: "placeholder" }),
  i({ id: "worn-gloves", name: "Worn Gloves", slot: "Gloves",
      rarity: "Common", requiredLevel: 1,
      baseStats: { critRate: 0.03 },
      primaryAffix: { type: "critRate", baseValue: 0.04 },
      affixPool: ["critDamage", "atk"], artRef: "placeholder" }),
  i({ id: "assassin-gloves", name: "Assassin Gloves", slot: "Gloves",
      rarity: "Legendary", requiredLevel: 35,
      baseStats: { critRate: 0.12, critDamage: 0.3, atk: 10 },
      primaryAffix: { type: "critDamage", baseValue: 0.30 },
      affixPool: ["critRate", "atk", "armorPen", "attackSpeed"], artRef: "placeholder" }),
  i({ id: "worn-boots", name: "Worn Boots", slot: "Boots",
      rarity: "Common", requiredLevel: 1,
      baseStats: { moveSpeed: 15 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.08 },
      affixPool: ["tenacity", "hpRegen"], artRef: "placeholder" }),
  i({ id: "swift-boots", name: "Swift Boots", slot: "Boots",
      rarity: "Rare", requiredLevel: 12,
      baseStats: { moveSpeed: 28, tenacity: 0.1 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.18 },
      affixPool: ["tenacity", "maxHp", "armor"], artRef: "placeholder" }),
  i({ id: "mana-pendant", name: "Mana Pendant", slot: "Amulet",
      rarity: "Magic", requiredLevel: 8,
      baseStats: { maxMana: 25, skillPower: 0.08 },
      primaryAffix: { type: "skillPower", baseValue: 0.10 },
      affixPool: ["manaRegen", "magicPen", "maxMana"], artRef: "placeholder" }),
  i({ id: "copper-ring", name: "Copper Ring", slot: "Ring1",
      rarity: "Common", requiredLevel: 1,
      baseStats: { maxMana: 15, manaRegen: 1 },
      primaryAffix: { type: "manaRegen", baseValue: 0.08 },
      affixPool: ["manaOnHit", "maxMana"], artRef: "placeholder" }),
  i({ id: "resonance-ring", name: "Resonance Ring", slot: "Ring2",
      rarity: "Rare", requiredLevel: 22,
      baseStats: { maxMana: 35, manaRegen: 3, manaOnHit: 5 },
      primaryAffix: { type: "manaOnHit", baseValue: 6 },
      affixPool: ["manaRegen", "maxMana", "skillPower"], artRef: "placeholder" }),
  i({ id: "coin-sprite", name: "Coin Sprite", slot: "Pet",
      rarity: "Common", requiredLevel: 1,
      baseStats: { goldFind: 0.05 },
      primaryAffix: { type: "goldFind", baseValue: 0.05 },
      affixPool: ["goldFind"],
      petUtility: { goldPerSec: 2, goldFind: 0.05 },
      artRef: "placeholder" }),
  i({ id: "fortune-fox", name: "Fortune Fox", slot: "Pet",
      rarity: "Legendary", requiredLevel: 30,
      baseStats: { goldFind: 0.20 },
      primaryAffix: { type: "goldFind", baseValue: 0.20 },
      affixPool: ["goldFind", "maxHp"],
      petUtility: { goldPerSec: 8, goldFind: 0.20 },
      artRef: "placeholder" }),
  i({ id: "fledgling-wings", name: "Fledgling Wings", slot: "Wing",
      rarity: "Common", requiredLevel: 5,
      baseStats: { moveSpeed: 20 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.15 },
      affixPool: ["moveSpeed", "tenacity"], artRef: "placeholder" }),
  i({ id: "tempest-wings", name: "Tempest Wings", slot: "Wing",
      rarity: "Legendary", requiredLevel: 50,
      baseStats: { moveSpeed: 50, tenacity: 0.15 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.35 },
      affixPool: ["moveSpeed", "tenacity", "attackSpeed"],
      wingPassive: "tempest-gale",
      artRef: "placeholder" }),
];

// ---------------------------------------------------------------------------
// Procedurally generated item lines (T10): 26 themed lines × 5 rarities = 130
// extra items, spanning every slot/weapon type with varied PRIMARY affixes.
// ---------------------------------------------------------------------------
interface ItemLine {
  id: string;
  base: string;
  slot: ItemSlot;
  weaponType?: WeaponType;
  primary: string;       // primary affix type (a stat label)
  primaryBase: number;   // primary affix base value at Common tier
  stats: Partial<Stats>; // base stats at Common tier
  affixPool: string[];
  pet?: boolean;
}

const RARITY_TIERS: { rarity: Rarity; lvl: number; statMult: number; primMult: number; prefix: string }[] = [
  { rarity: "Common", lvl: 1, statMult: 1, primMult: 1, prefix: "Worn" },
  { rarity: "Magic", lvl: 10, statMult: 1.35, primMult: 1.5, prefix: "Fine" },
  { rarity: "Rare", lvl: 22, statMult: 1.8, primMult: 2.1, prefix: "Masterwork" },
  { rarity: "Legendary", lvl: 40, statMult: 2.4, primMult: 2.9, prefix: "Heroic" },
  { rarity: "Unique", lvl: 60, statMult: 3.0, primMult: 3.7, prefix: "Mythic" },
];

const ITEM_LINES: ItemLine[] = [
  // Weapons (one per weapon type → distinct primary affixes)
  { id: "warblade", base: "Warblade", slot: "Weapon", weaponType: "Sword", primary: "physicalDamage", primaryBase: 0.08, stats: { atk: 16 }, affixPool: ["critRate", "armorPen", "atk"] },
  { id: "longbow", base: "Longbow", slot: "Weapon", weaponType: "Bow", primary: "attackSpeed", primaryBase: 0.12, stats: { atk: 13, attackSpeed: 0.2 }, affixPool: ["critRate", "critDamage", "range"] },
  { id: "wizard-staff", base: "Wizard Staff", slot: "Weapon", weaponType: "Staff", primary: "magicDamage", primaryBase: 0.14, stats: { atk: 11, skillPower: 0.2, maxMana: 14 }, affixPool: ["skillPower", "magicPen", "manaRegen"] },
  { id: "hand-cannon", base: "Hand Cannon", slot: "Weapon", weaponType: "Gun", primary: "armorPen", primaryBase: 0.12, stats: { atk: 18, armorPen: 0.1 }, affixPool: ["critRate", "critDamage", "attackSpeed"] },
  { id: "grimoire", base: "Grimoire", slot: "Weapon", weaponType: "Tome", primary: "skillPower", primaryBase: 0.16, stats: { skillPower: 0.18, maxMana: 16 }, affixPool: ["skillPower", "magicPen", "maxMana"] },
  { id: "war-fists", base: "War Fists", slot: "Weapon", weaponType: "Fist", primary: "critRate", primaryBase: 0.05, stats: { atk: 12, critRate: 0.04 }, affixPool: ["critDamage", "atk", "attackSpeed"] },
  // Helmets
  { id: "warhelm", base: "Warhelm", slot: "Helmet", primary: "maxHp", primaryBase: 0.07, stats: { maxHp: 70, armor: 5 }, affixPool: ["armor", "magicResist", "hpRegen"] },
  { id: "mage-cowl", base: "Mage Cowl", slot: "Helmet", primary: "skillPower", primaryBase: 0.08, stats: { maxMana: 24, skillPower: 0.06 }, affixPool: ["maxMana", "manaRegen", "magicResist"] },
  // Body armor
  { id: "platemail", base: "Platemail", slot: "BodyArmor", primary: "armor", primaryBase: 0.09, stats: { armor: 14, maxHp: 90 }, affixPool: ["maxHp", "magicResist", "damageReduction"] },
  { id: "battle-robe", base: "Battle Robe", slot: "BodyArmor", primary: "magicResist", primaryBase: 0.08, stats: { magicResist: 12, skillPower: 0.06, maxHp: 60 }, affixPool: ["skillPower", "maxMana", "magicResist"] },
  { id: "brigandine", base: "Brigandine", slot: "BodyArmor", primary: "maxHp", primaryBase: 0.08, stats: { maxHp: 110, armor: 8 }, affixPool: ["maxHp", "armor", "tenacity"] },
  // Gloves
  { id: "battle-gloves", base: "Battle Gloves", slot: "Gloves", primary: "critDamage", primaryBase: 0.12, stats: { critDamage: 0.1, atk: 6 }, affixPool: ["critRate", "atk", "armorPen"] },
  { id: "swift-gloves", base: "Swift Gloves", slot: "Gloves", primary: "attackSpeed", primaryBase: 0.08, stats: { attackSpeed: 0.08 }, affixPool: ["critRate", "atk"] },
  { id: "assassin-mitts", base: "Assassin Mitts", slot: "Gloves", primary: "critRate", primaryBase: 0.05, stats: { critRate: 0.05, critDamage: 0.08 }, affixPool: ["critDamage", "armorPen", "attackSpeed"] },
  // Boots
  { id: "striders", base: "Striders", slot: "Boots", primary: "moveSpeed", primaryBase: 0.1, stats: { moveSpeed: 24 }, affixPool: ["moveSpeed", "tenacity", "armor"] },
  { id: "war-boots", base: "War Boots", slot: "Boots", primary: "moveSpeed", primaryBase: 0.08, stats: { moveSpeed: 18, armor: 6 }, affixPool: ["armor", "maxHp", "tenacity"] },
  // Amulets
  { id: "mana-talisman", base: "Mana Talisman", slot: "Amulet", primary: "maxMana", primaryBase: 0.1, stats: { maxMana: 30, manaRegen: 2 }, affixPool: ["manaRegen", "skillPower", "manaOnHit"] },
  { id: "focus-gem", base: "Focus Gem", slot: "Amulet", primary: "skillPower", primaryBase: 0.1, stats: { skillPower: 0.1, maxMana: 12 }, affixPool: ["skillPower", "magicPen", "maxMana"] },
  { id: "pierce-pendant", base: "Pierce Pendant", slot: "Amulet", primary: "magicPen", primaryBase: 0.08, stats: { magicPen: 0.08, skillPower: 0.06 }, affixPool: ["magicPen", "skillPower", "critRate"] },
  // Rings (Ring1 slot — varied unusual primaries)
  { id: "blood-ring", base: "Blood Ring", slot: "Ring1", primary: "omnivamp", primaryBase: 0.04, stats: { omnivamp: 0.03, atk: 5 }, affixPool: ["omnivamp", "atk", "critRate"] },
  { id: "fortune-ring", base: "Fortune Ring", slot: "Ring1", primary: "goldFind", primaryBase: 0.08, stats: { goldFind: 0.06 }, affixPool: ["goldFind", "manaOnKill"] },
  { id: "precision-ring", base: "Precision Ring", slot: "Ring2", primary: "critRate", primaryBase: 0.05, stats: { critRate: 0.04, critDamage: 0.06 }, affixPool: ["critRate", "critDamage", "armorPen"] },
  { id: "vital-ring", base: "Vital Ring", slot: "Ring2", primary: "hpRegen", primaryBase: 0.1, stats: { hpRegen: 6, maxHp: 40 }, affixPool: ["hpRegen", "maxHp", "tenacity"] },
  // Pets
  { id: "coin-pet", base: "Coin Sprite", slot: "Pet", primary: "goldFind", primaryBase: 0.1, stats: { goldFind: 0.08 }, affixPool: ["goldFind"], pet: true },
  { id: "fortune-pet", base: "Fortune Beast", slot: "Pet", primary: "goldFind", primaryBase: 0.12, stats: { goldFind: 0.12, maxHp: 30 }, affixPool: ["goldFind", "hpRegen"], pet: true },
  // Wings
  { id: "skywings", base: "Skywings", slot: "Wing", primary: "moveSpeed", primaryBase: 0.14, stats: { moveSpeed: 26, tenacity: 0.08 }, affixPool: ["moveSpeed", "tenacity", "attackSpeed"] },
];

const r2 = (n: number) => Math.round(n * 1000) / 1000;
const generatedItems: ItemDef[] = [];
for (const line of ITEM_LINES) {
  for (const tier of RARITY_TIERS) {
    const stats: Partial<Stats> = {};
    for (const [k, v] of Object.entries(line.stats) as [keyof Stats, number][]) {
      const scaled = v * tier.statMult;
      stats[k] = v >= 1 ? Math.round(scaled) : r2(scaled);
    }
    generatedItems.push(i({
      id: `${tier.prefix.toLowerCase()}-${line.id}`,
      name: `${tier.prefix} ${line.base}`,
      slot: line.slot,
      ...(line.weaponType ? { weaponType: line.weaponType } : {}),
      rarity: tier.rarity,
      requiredLevel: tier.lvl,
      baseStats: stats,
      primaryAffix: { type: line.primary, baseValue: r2(line.primaryBase * tier.primMult) },
      affixPool: line.affixPool,
      ...(line.pet ? { petUtility: { goldPerSec: r2(0.4 * tier.statMult), goldFind: r2(0.04 * tier.statMult) } } : {}),
      artRef: "placeholder",
    }));
  }
}
ITEM_CATALOG.push(...generatedItems);

export const ITEM_CATALOG_MAP = new Map<string, ItemDef>(
  ITEM_CATALOG.map((i) => [i.id, i])
);

export function rollItem(def: ItemDef, heroLevel: number, seed: number): ItemInstance {
  const rng = new Rng(seed);

  const rolledStats: Partial<Stats> = {};
  for (const [k, v] of Object.entries(def.baseStats) as [keyof Stats, number][]) {
    if (v === undefined) continue;
    const effective = v * (1 + 0.08 * def.requiredLevel);
    rolledStats[k] = effective * (0.9 + rng.next() * 0.2);
  }

  const rolledPrimaryAffix = def.primaryAffix.baseValue * (0.9 + rng.next() * 0.2);

  const affixCount = AFFIX_COUNT[def.rarity] ?? 0;
  const shuffled = [...def.affixPool].sort(() => rng.next() - 0.5);
  const rolledAffixes: RolledAffix[] = shuffled.slice(0, affixCount).map((type) => ({
    type,
    value: 0.05 + rng.next() * 0.15,
  }));

  return {
    id: `item-${def.id}-${seed}`,
    defId: def.id,
    acquiredLevel: heroLevel,
    rolledStats,
    rolledPrimaryAffix,
    rolledAffixes,
    enhanceLevel: 0,
  };
}
