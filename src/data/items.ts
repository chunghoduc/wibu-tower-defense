import { Rng } from "../core/rng.ts";
import { loreFor } from "./itemLore.ts";
import { archetypeFor, type ItemArchetype } from "./itemArchetype.ts";
import { EXPANSION_LINES } from "./itemsExpansion.ts";
import { BASE_ITEM_LINES } from "./itemLines.ts";
import {
  type ItemDef,
  type ItemDefSlot,
  type ItemInstance,
  type Rarity,
  type RolledAffix,
  type Stats,
  type WeaponType,
  FRACTIONAL_STAT_KEYS,
  validateItemDef,
} from "./schema.ts";

// Per-affix roll range [min, max]. Crit affixes apply FLAT, so they're kept
// modest (a few % each) — without this they'd roll the generic 5–20% and stack
// to absurd crit chance. Everything else uses the default increased%/flat range.
const DEFAULT_AFFIX_RANGE: [number, number] = [0.05, 0.2];
const AFFIX_RANGE: Partial<Record<string, [number, number]>> = {
  critRate: [0.02, 0.05], // +2–5% crit chance per affix
  critDamage: [0.05, 0.15], // +5–15% crit damage per affix
};

function i(def: ItemDef): ItemDef {
  return validateItemDef(def);
}

export const AFFIX_COUNT: Record<string, number> = {
  Common: 0,
  Magic: 1,
  Rare: 2,
  Legendary: 3,
  Unique: 3,
};

/**
 * Roll a fresh set of secondary affixes for `def`: shuffle its pool, take the
 * rarity's affix count, and roll each value in its range (×apexMult). Shared by
 * the initial drop (rollItem) and the Reforge re-roll so the two can't drift.
 */
export function rollAffixes(def: ItemDef, rng: Rng, apexMult = 1): RolledAffix[] {
  const affixCount = AFFIX_COUNT[def.rarity] ?? 0;
  const shuffled = [...def.affixPool].sort(() => rng.next() - 0.5);
  return shuffled.slice(0, affixCount).map((type) => {
    const [lo, hi] = AFFIX_RANGE[type] ?? DEFAULT_AFFIX_RANGE;
    return { type, value: (lo + rng.next() * (hi - lo)) * apexMult };
  });
}

export const ITEM_CATALOG: ItemDef[] = [
  i({
    id: "iron-sword",
    name: "Iron Sword",
    slot: "Weapon",
    weaponType: "Sword",
    rarity: "Common",
    requiredLevel: 1,
    baseStats: { atk: 18 },
    primaryAffix: { type: "physicalDamage", baseValue: 0.08 },
    affixPool: ["critRate", "armorPen"],
    artRef: "placeholder",
  }),
  i({
    id: "elven-bow",
    name: "Elven Bow",
    slot: "Weapon",
    weaponType: "Bow",
    rarity: "Magic",
    requiredLevel: 10,
    baseStats: { atk: 22, attackSpeed: 0.3 },
    primaryAffix: { type: "attackSpeed", baseValue: 0.12 },
    affixPool: ["critRate", "critDamage", "range"],
    artRef: "placeholder",
  }),
  i({
    id: "arcane-staff",
    name: "Arcane Staff",
    slot: "Weapon",
    weaponType: "Staff",
    rarity: "Rare",
    requiredLevel: 20,
    baseStats: { atk: 14, skillPower: 0.25 },
    primaryAffix: { type: "magicDamage", baseValue: 0.18 },
    affixPool: ["skillPower", "magicPen", "manaOnHit"],
    artRef: "placeholder",
  }),
  i({
    id: "thunder-cannon",
    name: "Thunder Cannon",
    slot: "Weapon",
    weaponType: "Gun",
    rarity: "Legendary",
    requiredLevel: 40,
    baseStats: { atk: 38, armorPen: 0.2 },
    primaryAffix: { type: "physicalDamage", baseValue: 0.25 },
    affixPool: ["critRate", "critDamage", "armorPen", "attackSpeed"],
    artRef: "placeholder",
  }),
  i({
    id: "leather-cap",
    name: "Leather Cap",
    slot: "Helmet",
    rarity: "Common",
    requiredLevel: 1,
    baseStats: { maxHp: 60 },
    primaryAffix: { type: "maxHp", baseValue: 0.06 },
    affixPool: ["armor", "hpRegen"],
    artRef: "placeholder",
  }),
  i({
    id: "iron-helm",
    name: "Iron Helm",
    slot: "Helmet",
    rarity: "Rare",
    requiredLevel: 15,
    baseStats: { maxHp: 120, armor: 8 },
    primaryAffix: { type: "maxHp", baseValue: 0.12 },
    affixPool: ["armor", "magicResist", "hpRegen", "tenacity"],
    artRef: "placeholder",
  }),
  i({
    id: "cloth-robe",
    name: "Cloth Robe",
    slot: "BodyArmor",
    rarity: "Common",
    requiredLevel: 1,
    baseStats: { maxHp: 80, magicResist: 5 },
    primaryAffix: { type: "armor", baseValue: 0.06 },
    affixPool: ["magicResist", "hpRegen"],
    artRef: "placeholder",
  }),
  i({
    id: "scale-mail",
    name: "Scale Mail",
    slot: "BodyArmor",
    rarity: "Rare",
    requiredLevel: 18,
    baseStats: { maxHp: 150, armor: 12, magicResist: 8 },
    primaryAffix: { type: "armor", baseValue: 0.15 },
    affixPool: ["maxHp", "magicResist", "damageReduction"],
    artRef: "placeholder",
  }),
  i({
    id: "worn-gloves",
    name: "Worn Gloves",
    slot: "Gloves",
    rarity: "Common",
    requiredLevel: 1,
    baseStats: { critRate: 0.03 },
    primaryAffix: { type: "critRate", baseValue: 0.04 },
    affixPool: ["critDamage", "atk"],
    artRef: "placeholder",
  }),
  i({
    id: "assassin-gloves",
    name: "Assassin Gloves",
    slot: "Gloves",
    rarity: "Legendary",
    requiredLevel: 35,
    baseStats: { critRate: 0.12, critDamage: 0.3, atk: 10 },
    primaryAffix: { type: "critDamage", baseValue: 0.3 },
    affixPool: ["critRate", "atk", "armorPen", "attackSpeed"],
    artRef: "placeholder",
  }),
  i({
    id: "worn-boots",
    name: "Worn Boots",
    slot: "Boots",
    rarity: "Common",
    requiredLevel: 1,
    baseStats: { moveSpeed: 15 },
    primaryAffix: { type: "moveSpeed", baseValue: 0.08 },
    affixPool: ["tenacity", "hpRegen"],
    artRef: "placeholder",
  }),
  i({
    id: "swift-boots",
    name: "Swift Boots",
    slot: "Boots",
    rarity: "Rare",
    requiredLevel: 12,
    baseStats: { moveSpeed: 28, tenacity: 0.1 },
    primaryAffix: { type: "moveSpeed", baseValue: 0.18 },
    affixPool: ["tenacity", "maxHp", "armor"],
    artRef: "placeholder",
  }),
  i({
    id: "mana-pendant",
    name: "Mana Pendant",
    slot: "Amulet",
    rarity: "Magic",
    requiredLevel: 8,
    baseStats: { manaOnHit: 4, skillPower: 0.08 },
    primaryAffix: { type: "skillPower", baseValue: 0.1 },
    affixPool: ["manaOnHit", "magicPen", "skillPower"],
    artRef: "placeholder",
  }),
  i({
    id: "copper-ring",
    name: "Copper Ring",
    slot: "Ring",
    rarity: "Common",
    requiredLevel: 1,
    baseStats: { manaOnHit: 3 },
    primaryAffix: { type: "manaOnHit", baseValue: 3 },
    affixPool: ["manaOnHit", "manaOnKill"],
    artRef: "placeholder",
  }),
  i({
    id: "resonance-ring",
    name: "Resonance Ring",
    slot: "Ring",
    rarity: "Rare",
    requiredLevel: 22,
    baseStats: { manaOnHit: 6 },
    primaryAffix: { type: "manaOnHit", baseValue: 6 },
    affixPool: ["manaOnKill", "skillPower", "manaOnHit"],
    artRef: "placeholder",
  }),
  i({
    id: "coin-sprite",
    name: "Coin Sprite",
    slot: "Pet",
    rarity: "Common",
    requiredLevel: 1,
    baseStats: { goldFind: 0.05 },
    primaryAffix: { type: "goldFind", baseValue: 0.05 },
    affixPool: ["goldFind"],
    petUtility: { goldPerSec: 2, goldFind: 0.05 },
    artRef: "placeholder",
  }),
  i({
    id: "fortune-fox",
    name: "Fortune Fox",
    slot: "Pet",
    rarity: "Legendary",
    requiredLevel: 30,
    baseStats: { goldFind: 0.2 },
    primaryAffix: { type: "goldFind", baseValue: 0.2 },
    affixPool: ["goldFind", "maxHp"],
    petUtility: { goldPerSec: 8, goldFind: 0.2 },
    artRef: "placeholder",
  }),
  i({
    id: "fledgling-wings",
    name: "Fledgling Wings",
    slot: "Wing",
    appearanceRef: "item__fledgling-wings",
    rarity: "Common",
    requiredLevel: 5,
    baseStats: { moveSpeed: 20 },
    primaryAffix: { type: "moveSpeed", baseValue: 0.15 },
    affixPool: ["moveSpeed", "tenacity"],
    artRef: "placeholder",
  }),
  i({
    id: "tempest-wings",
    name: "Tempest Wings",
    slot: "Wing",
    appearanceRef: "item__tempest-wings",
    rarity: "Legendary",
    requiredLevel: 50,
    baseStats: { moveSpeed: 50, tenacity: 0.15 },
    primaryAffix: { type: "moveSpeed", baseValue: 0.35 },
    affixPool: ["moveSpeed", "tenacity", "attackSpeed"],
    wingPassive: "tempest-gale",
    artRef: "placeholder",
  }),
  // ── Signature loot batch — memorable hand-tuned top-end pieces ──────────────
  i({
    id: "dawnbreaker",
    name: "Dawnbreaker",
    slot: "Weapon",
    weaponType: "Sword",
    rarity: "Unique",
    requiredLevel: 60,
    baseStats: { atk: 42, critDamage: 0.25 },
    primaryAffix: { type: "physicalDamage", baseValue: 0.3 },
    affixPool: ["critRate", "critDamage", "armorPen", "atk"],
    artRef: "placeholder",
  }),
  i({
    id: "void-render",
    name: "Void Render",
    slot: "Weapon",
    weaponType: "Gun",
    rarity: "Legendary",
    requiredLevel: 45,
    baseStats: { atk: 36, armorPen: 0.18 },
    primaryAffix: { type: "armorPen", baseValue: 0.2 },
    affixPool: ["critRate", "armorPen", "attackSpeed"],
    artRef: "placeholder",
  }),
  i({
    id: "aegis-of-dawn",
    name: "Aegis of Dawn",
    slot: "BodyArmor",
    rarity: "Unique",
    requiredLevel: 60,
    baseStats: { maxHp: 220, armor: 18, magicResist: 14, damageReduction: 0.06 },
    primaryAffix: { type: "damageReduction", baseValue: 0.1 },
    affixPool: ["maxHp", "armor", "magicResist", "tenacity"],
    artRef: "placeholder",
  }),
  i({
    id: "seers-eye",
    name: "Seer's Eye",
    slot: "Amulet",
    rarity: "Rare",
    requiredLevel: 24,
    baseStats: { skillPower: 0.14, magicPen: 0.06 },
    primaryAffix: { type: "skillPower", baseValue: 0.16 },
    affixPool: ["skillPower", "magicPen", "manaOnHit"],
    artRef: "placeholder",
  }),
  i({
    id: "midas-paw",
    name: "Midas Paw",
    slot: "Pet",
    rarity: "Unique",
    requiredLevel: 55,
    baseStats: { goldFind: 0.25 },
    primaryAffix: { type: "goldFind", baseValue: 0.25 },
    affixPool: ["goldFind", "maxHp"],
    petUtility: { goldPerSec: 10, goldFind: 0.25 },
    artRef: "placeholder",
  }),
];

// ---------------------------------------------------------------------------
// Procedurally generated item lines (T10): 26 themed lines × 5 rarities = 130
// extra items, spanning every slot/weapon type with varied PRIMARY affixes.
// ---------------------------------------------------------------------------
export interface ItemLine {
  id: string;
  base: string;
  slot: ItemDefSlot;
  weaponType?: WeaponType;
  primary: string; // primary affix type (a stat label)
  primaryBase: number; // primary affix base value at Common tier
  stats: Partial<Stats>; // base stats at Common tier
  affixPool: string[];
  pet?: boolean;
  /** Build archetype stamped onto every rarity tier (else derived from primary). */
  archetype?: ItemArchetype;
}

const RARITY_TIERS: {
  rarity: Rarity;
  lvl: number;
  statMult: number;
  primMult: number;
  prefix: string;
}[] = [
  { rarity: "Common", lvl: 1, statMult: 1, primMult: 1, prefix: "Worn" },
  { rarity: "Magic", lvl: 10, statMult: 1.35, primMult: 1.5, prefix: "Fine" },
  { rarity: "Rare", lvl: 22, statMult: 1.8, primMult: 2.1, prefix: "Masterwork" },
  { rarity: "Legendary", lvl: 40, statMult: 2.4, primMult: 2.9, prefix: "Heroic" },
  { rarity: "Unique", lvl: 60, statMult: 3.0, primMult: 3.7, prefix: "Mythic" },
];

// The base themed lines live in itemLines.ts (split out for file size); order
// here is load-bearing for the generated catalog, so keep base before expansion.
const ITEM_LINES: ItemLine[] = [...BASE_ITEM_LINES];

// The 200-item homage expansion (40 lines × 5 rarities) lives in its own module
// to keep this file focused; appended here so the generation loop covers it too.
ITEM_LINES.push(...EXPANSION_LINES);

const r2 = (n: number) => Math.round(n * 1000) / 1000;
// Crit is a flat-added chance/multiplier, so it shouldn't scale up with rarity
// as steeply as scalar stats — otherwise top-tier crit gear reaches absurd crit.
// Halve the rarity bonus above Common for crit stats only.
const CRIT_KEYS = new Set(["critRate", "critDamage"]);
const critDamp = (m: number) => 1 + (m - 1) * 0.5;
const generatedItems: ItemDef[] = [];
for (const line of ITEM_LINES) {
  for (const tier of RARITY_TIERS) {
    const stats: Partial<Stats> = {};
    for (const [k, v] of Object.entries(line.stats) as [keyof Stats, number][]) {
      const mult = CRIT_KEYS.has(k) ? critDamp(tier.statMult) : tier.statMult;
      const scaled = v * mult;
      stats[k] = v >= 1 ? Math.round(scaled) : r2(scaled);
    }
    const primMult = CRIT_KEYS.has(line.primary) ? critDamp(tier.primMult) : tier.primMult;
    generatedItems.push(
      i({
        id: `${tier.prefix.toLowerCase()}-${line.id}`,
        name: line.base,
        slot: line.slot,
        ...(line.weaponType ? { weaponType: line.weaponType } : {}),
        rarity: tier.rarity,
        requiredLevel: tier.lvl,
        baseStats: stats,
        primaryAffix: { type: line.primary, baseValue: r2(line.primaryBase * primMult) },
        affixPool: line.affixPool,
        archetype: line.archetype ?? archetypeFor({ primaryAffix: { type: line.primary } }),
        ...(line.pet
          ? {
              petUtility: {
                goldPerSec: r2(0.4 * tier.statMult),
                goldFind: r2(0.04 * tier.statMult),
              },
            }
          : {}),
        artRef: "placeholder",
      }),
    );
  }
}
ITEM_CATALOG.push(...generatedItems);

// Merge homage names + visual/flavour metadata from itemLore.ts. Ids stay the
// save-key / PNG-filename anchors; only the display NAME is overridden, and the
// appearance/homage/specialty/lore fields are attached. Generated tiers inherit
// their line's homage (name = "<Rarity prefix> <homage base>").
for (const def of ITEM_CATALOG) {
  const lore = loreFor(def.id);
  if (!lore) continue;
  if (lore.name) {
    def.name = lore.name;
  } else if (lore.base) {
    def.name = lore.base;
  }
  def.appearance = lore.appearance;
  def.homage = lore.homage;
  def.specialty = lore.specialty;
  def.lore = lore.lore;
}

export const ITEM_CATALOG_MAP = new Map<string, ItemDef>(ITEM_CATALOG.map((i) => [i.id, i]));

/**
 * The pool eligible to DROP as loot — every item except Wings. Wings are no
 * longer lootable from battle kills, stage clears, or boss boxes; they remain a
 * real equip slot (and shop stock), just never roll as a random drop. All loot
 * rollers (per-kill drops, stage-clear rewards, box opens) filter through this
 * instead of ITEM_CATALOG so the exclusion lives in exactly one place.
 */
export const LOOTABLE_CATALOG: ItemDef[] = ITEM_CATALOG.filter((d) => d.slot !== "Wing");

/** Hard cap on an item's rolled required level. Items at the cap are Apex. */
export const MAX_ITEM_REQ_LEVEL = 90;
export const APEX_REQ_LEVEL = 90;
/** Apex (level-90) special effect: +25% to every rolled stat, primary & affix. */
export const APEX_STAT_MULT = 1.25;

/** The effective required level for a copy — its rolled value, or the def floor
 *  for legacy instances that predate per-instance required levels. */
export function instanceReqLevel(inst: { requiredLevel?: number }, def: ItemDef): number {
  return inst.requiredLevel ?? def.requiredLevel;
}

/**
 * Roll a concrete copy of `def`. `reqLevel` is the desired required level for
 * this copy — it is clamped to [def floor, 90]. Base (scalar) stats scale with
 * the resulting required level, so the SAME named item is stronger when it drops
 * at a higher required level. A copy that lands at level 90 gains the Apex
 * effect: every rolled stat/affix gets an extra +25%.
 *
 * `opts.ignoreFloor` decouples level from rarity: the copy clamps to [1, 90]
 * instead of [def floor, 90], so any rarity can roll at any level (e.g. a
 * level-1 Unique). Rarity stays the quality axis (stat multiplier + affix
 * count); level is purely the scalar-scaling axis. Used by context-driven rolls
 * (boss boxes) where the level should track the hero, not the item's rarity.
 */
export function rollItem(
  def: ItemDef,
  heroLevel: number,
  seed: number,
  reqLevel?: number,
  opts?: { ignoreFloor?: boolean },
): ItemInstance {
  const rng = new Rng(seed);

  const floor = opts?.ignoreFloor ? 1 : def.requiredLevel;
  const required = Math.min(
    MAX_ITEM_REQ_LEVEL,
    Math.max(floor, Math.round(reqLevel ?? def.requiredLevel)),
  );
  const apex = required >= APEX_REQ_LEVEL;
  const apexMult = apex ? APEX_STAT_MULT : 1;

  const rolledStats: Partial<Stats> = {};
  for (const [k, v] of Object.entries(def.baseStats) as [keyof Stats, number][]) {
    if (v === undefined) continue;
    // Fractional stats (crit, pen, %) DON'T scale with item level — only scalar
    // stats (atk/hp) do — so a high-level item can't balloon a crit base.
    const effective = FRACTIONAL_STAT_KEYS.has(k) ? v : v * (1 + 0.08 * required);
    rolledStats[k] = effective * (0.9 + rng.next() * 0.2) * apexMult;
  }

  const rolledPrimaryAffix = def.primaryAffix.baseValue * (0.9 + rng.next() * 0.2) * apexMult;

  const rolledAffixes = rollAffixes(def, rng, apexMult);

  return {
    id: `item-${def.id}-${seed}`,
    defId: def.id,
    acquiredLevel: heroLevel,
    requiredLevel: required,
    ...(apex ? { apex: true } : {}),
    rolledStats,
    rolledPrimaryAffix,
    rolledAffixes,
    enhanceLevel: 0,
  };
}

/** Crystal value of an item by rarity, scaled gently with its required level. */
const RARITY_BASE_PRICE: Record<Rarity, number> = {
  Common: 120,
  Magic: 300,
  Rare: 700,
  Legendary: 1600,
  Unique: 3600,
};
export function itemValue(def: ItemDef): number {
  return Math.round((RARITY_BASE_PRICE[def.rarity] ?? 120) * (1 + 0.02 * def.requiredLevel));
}
