import { Rng } from "../core/rng.ts";
import {
  type ItemDef,
  type ItemInstance,
  type RolledAffix,
  type Stats,
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
  };
}
