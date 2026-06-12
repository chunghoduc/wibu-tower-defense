import { type Rarity, type Stats, RARITIES } from "./schema.ts";

/**
 * A skill jewel — a stat bag the player sockets into an allocated jewel-socket
 * node on the passive tree. Bonuses ride the existing hero stat pipeline:
 *   final = (base + Σflat) × (1 + Σincreased%) × Π(1 + more%)
 * so a jewel is just another {flat, increased, more} contributor (and its power
 * reaches towers via the 60% hero→tower share). No per-instance variance — a
 * jewel's mods are fixed by its def, which keeps them discrete and readable.
 *
 * Stat-bag convention (mirrors passive nodes / item affixes):
 *  - scalar stats (atk, maxHp, attackSpeed, moveSpeed, range) go in `increased` (%),
 *  - fractional stats (crit, pen, %reductions, skillPower, omnivamp, goldFind…)
 *    and raw point stats (maxMana, manaRegen, armor, hpRegen…) go in `flat`,
 *  - `more` (multiplicative) is reserved for Unique jewels only.
 */
export interface JewelDef {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  flat?: Partial<Stats>;
  increased?: Partial<Stats>;
  more?: Partial<Stats>;
  artRef: string;
}

function j(def: JewelDef): JewelDef {
  if (!def.id.trim()) throw new Error("jewel: missing id");
  if (!def.name.trim()) throw new Error(`jewel ${def.id}: missing name`);
  if (!(RARITIES as readonly string[]).includes(def.rarity))
    throw new Error(`jewel ${def.id}: bad rarity`);
  const bags =
    Object.keys(def.flat ?? {}).length +
    Object.keys(def.increased ?? {}).length +
    Object.keys(def.more ?? {}).length;
  if (bags === 0) throw new Error(`jewel ${def.id}: must carry at least one stat`);
  return def;
}

export const JEWEL_CATALOG: JewelDef[] = [
  // ── Common — one modest mod (24) ──────────────────────────────────────────
  j({
    id: "crimson-shard",
    name: "Crimson Shard",
    rarity: "Common",
    description: "+8% ATK.",
    increased: { atk: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "honed-edge",
    name: "Honed Edge",
    rarity: "Common",
    description: "+6% crit rate.",
    flat: { critRate: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "verdant-stone",
    name: "Verdant Stone",
    rarity: "Common",
    description: "+8% max HP.",
    increased: { maxHp: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "ironbark-core",
    name: "Ironbark Core",
    rarity: "Common",
    description: "+8 armor.",
    flat: { armor: 8 },
    artRef: "placeholder",
  }),
  j({
    id: "fang-sliver",
    name: "Fang Sliver",
    rarity: "Common",
    description: "+6% armor penetration.",
    flat: { armorPen: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "quickdraw-gem",
    name: "Quickdraw Gem",
    rarity: "Common",
    description: "+6% attack speed.",
    increased: { attackSpeed: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "coin-facet",
    name: "Coin Facet",
    rarity: "Common",
    description: "+10% gold find.",
    flat: { goldFind: 0.1 },
    artRef: "placeholder",
  }),
  j({
    id: "azure-spark",
    name: "Azure Spark",
    rarity: "Common",
    description: "+8% skill power.",
    flat: { skillPower: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "mana-wellstone",
    name: "Mana Wellstone",
    rarity: "Common",
    description: "+4 mana on hit.",
    flat: { manaOnHit: 4 },
    artRef: "placeholder",
  }),
  j({
    id: "shadow-sliver",
    name: "Shadow Sliver",
    rarity: "Common",
    description: "+6% crit rate.",
    flat: { critRate: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "vital-chip",
    name: "Vital Chip",
    rarity: "Common",
    description: "+6% max HP.",
    increased: { maxHp: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "keen-chip",
    name: "Keen Chip",
    rarity: "Common",
    description: "+5% crit rate.",
    flat: { critRate: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "warding-chip",
    name: "Warding Chip",
    rarity: "Common",
    description: "+8 magic resist.",
    flat: { magicResist: 8 },
    artRef: "placeholder",
  }),
  j({
    id: "swift-chip",
    name: "Swift Chip",
    rarity: "Common",
    description: "+6% move speed.",
    increased: { moveSpeed: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "regen-stone",
    name: "Regen Stone",
    rarity: "Common",
    description: "+5 HP regen.",
    flat: { hpRegen: 5 },
    artRef: "placeholder",
  }),
  j({
    id: "piercing-chip",
    name: "Piercing Chip",
    rarity: "Common",
    description: "+5% armor penetration.",
    flat: { armorPen: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "focus-chip",
    name: "Focus Chip",
    rarity: "Common",
    description: "+6% skill power.",
    flat: { skillPower: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "tenacity-stone",
    name: "Tenacity Stone",
    rarity: "Common",
    description: "+8% tenacity.",
    flat: { tenacity: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "conduit-chip",
    name: "Conduit Chip",
    rarity: "Common",
    description: "+3 mana on hit.",
    flat: { manaOnHit: 3 },
    artRef: "placeholder",
  }),
  j({
    id: "bulwark-chip",
    name: "Bulwark Chip",
    rarity: "Common",
    description: "+4% damage reduction.",
    flat: { damageReduction: 0.04 },
    artRef: "placeholder",
  }),
  j({
    id: "hunters-chip",
    name: "Hunter's Chip",
    rarity: "Common",
    description: "+6% magic penetration.",
    flat: { magicPen: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "ranging-lens",
    name: "Ranging Lens",
    rarity: "Common",
    description: "+8% range.",
    increased: { range: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "grit-stone",
    name: "Grit Stone",
    rarity: "Common",
    description: "+8% crit defense.",
    flat: { critDefense: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "vampiric-chip",
    name: "Vampiric Chip",
    rarity: "Common",
    description: "+3% omnivamp.",
    flat: { omnivamp: 0.03 },
    artRef: "placeholder",
  }),

  // ── Magic — two mods (14) ─────────────────────────────────────────────────
  j({
    id: "brutal-facet",
    name: "Brutal Facet",
    rarity: "Magic",
    description: "+6% ATK, +5% crit rate.",
    increased: { atk: 0.06 },
    flat: { critRate: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "bloodlust-gem",
    name: "Bloodlust Gem",
    rarity: "Magic",
    description: "+10% crit damage, +5% ATK.",
    increased: { atk: 0.05 },
    flat: { critDamage: 0.1 },
    artRef: "placeholder",
  }),
  j({
    id: "spellforged-prism",
    name: "Spellforged Prism",
    rarity: "Magic",
    description: "+8% skill power, +6% magic pen.",
    flat: { skillPower: 0.08, magicPen: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "bulwark-facet",
    name: "Bulwark Facet",
    rarity: "Magic",
    description: "+8% max HP, +5% damage reduction.",
    increased: { maxHp: 0.08 },
    flat: { damageReduction: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "hunters-mark",
    name: "Hunter's Mark",
    rarity: "Magic",
    description: "+6% attack speed, +5% armor pen.",
    increased: { attackSpeed: 0.06 },
    flat: { armorPen: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "phantom-veil",
    name: "Phantom Veil",
    rarity: "Magic",
    description: "+8% crit defense, +6% tenacity.",
    flat: { critDefense: 0.08, tenacity: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "surge-crystal",
    name: "Surge Crystal",
    rarity: "Magic",
    description: "+8% skill power, +4 mana on hit.",
    flat: { skillPower: 0.08, manaOnHit: 4 },
    artRef: "placeholder",
  }),
  j({
    id: "vampiric-shard",
    name: "Vampiric Shard",
    rarity: "Magic",
    description: "+4% omnivamp, +5% ATK.",
    increased: { atk: 0.05 },
    flat: { omnivamp: 0.04 },
    artRef: "placeholder",
  }),
  j({
    id: "warlords-gem",
    name: "Warlord's Gem",
    rarity: "Magic",
    description: "+6% ATK, +6% max HP.",
    increased: { atk: 0.06, maxHp: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "mystic-gem",
    name: "Mystic Gem",
    rarity: "Magic",
    description: "+6% skill power, +3 mana on hit.",
    flat: { skillPower: 0.06, manaOnHit: 3 },
    artRef: "placeholder",
  }),
  j({
    id: "duelist-gem",
    name: "Duelist Gem",
    rarity: "Magic",
    description: "+6% attack speed, +5% crit rate.",
    increased: { attackSpeed: 0.06 },
    flat: { critRate: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "merchants-eye",
    name: "Merchant's Eye",
    rarity: "Magic",
    description: "+12% gold find, +5% ATK.",
    increased: { atk: 0.05 },
    flat: { goldFind: 0.12 },
    artRef: "placeholder",
  }),
  j({
    id: "sentinel-facet",
    name: "Sentinel Facet",
    rarity: "Magic",
    description: "+6% max HP, +8 armor.",
    increased: { maxHp: 0.06 },
    flat: { armor: 8 },
    artRef: "placeholder",
  }),
  j({
    id: "arcane-facet",
    name: "Arcane Facet",
    rarity: "Magic",
    description: "+8% skill power, +5% magic pen.",
    flat: { skillPower: 0.08, magicPen: 0.05 },
    artRef: "placeholder",
  }),

  // ── Rare — three mods (7) ─────────────────────────────────────────────────
  j({
    id: "executioners-eye",
    name: "Executioner's Eye",
    rarity: "Rare",
    description: "+8% ATK, +5% crit rate, +12% crit damage.",
    increased: { atk: 0.08 },
    flat: { critRate: 0.05, critDamage: 0.12 },
    artRef: "placeholder",
  }),
  j({
    id: "sentinels-aegis",
    name: "Sentinel's Aegis",
    rarity: "Rare",
    description: "+10% max HP, +8 armor, +6 magic resist.",
    increased: { maxHp: 0.1 },
    flat: { armor: 8, magicResist: 6 },
    artRef: "placeholder",
  }),
  j({
    id: "apex-predator",
    name: "Apex Predator",
    rarity: "Rare",
    description: "+8% attack speed, +6% ATK, +6% armor pen.",
    increased: { attackSpeed: 0.08, atk: 0.06 },
    flat: { armorPen: 0.06 },
    artRef: "placeholder",
  }),
  j({
    id: "archmage-sigil",
    name: "Archmage Sigil",
    rarity: "Rare",
    description: "+10% skill power, +6% magic pen, +4 mana on hit.",
    flat: { skillPower: 0.1, magicPen: 0.06, manaOnHit: 4 },
    artRef: "placeholder",
  }),
  j({
    id: "golden-touch",
    name: "Golden Touch",
    rarity: "Rare",
    description: "+15% gold find, +8% max HP, +5% move speed.",
    increased: { maxHp: 0.08, moveSpeed: 0.05 },
    flat: { goldFind: 0.15 },
    artRef: "placeholder",
  }),
  j({
    id: "titan-gem",
    name: "Titan Gem",
    rarity: "Rare",
    description: "+10% max HP, +10 armor, +8% tenacity.",
    increased: { maxHp: 0.1 },
    flat: { armor: 10, tenacity: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "nightstalker",
    name: "Nightstalker",
    rarity: "Rare",
    description: "+6% crit rate, +10% crit damage, +6% attack speed.",
    increased: { attackSpeed: 0.06 },
    flat: { critRate: 0.06, critDamage: 0.1 },
    artRef: "placeholder",
  }),

  // ── Unique — named, `more` multipliers (5) ────────────────────────────────
  j({
    id: "berserkers-heart",
    name: "Berserker's Heart",
    rarity: "Unique",
    description: "8% MORE ATK — multiplicative.",
    more: { atk: 0.08 },
    artRef: "placeholder",
  }),
  j({
    id: "unbreakable",
    name: "Unbreakable",
    rarity: "Unique",
    description: "6% MORE max HP, +5% damage reduction.",
    more: { maxHp: 0.06 },
    flat: { damageReduction: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "ascendant-core",
    name: "Ascendant Core",
    rarity: "Unique",
    description: "5% MORE ATK and 5% MORE max HP.",
    more: { atk: 0.05, maxHp: 0.05 },
    artRef: "placeholder",
  }),
  j({
    id: "font-of-power",
    name: "Font of Power",
    rarity: "Unique",
    description: "6% MORE skill power, +4 mana on hit.",
    more: { skillPower: 0.06 },
    flat: { manaOnHit: 4 },
    artRef: "placeholder",
  }),
  j({
    id: "worldsoul-diamond",
    name: "Worldsoul Diamond",
    rarity: "Unique",
    description: "5% MORE ATK, skill power and max HP — the generalist capstone.",
    more: { atk: 0.05, skillPower: 0.05, maxHp: 0.05 },
    artRef: "placeholder",
  }),
];

export const JEWEL_CATALOG_MAP = new Map<string, JewelDef>(JEWEL_CATALOG.map((jw) => [jw.id, jw]));

/** The flat/increased/more bags for a jewel def id, or null if unknown. */
export function jewelStatBag(defId: string): Pick<JewelDef, "flat" | "increased" | "more"> | null {
  const def = JEWEL_CATALOG_MAP.get(defId);
  if (!def) return null;
  return { flat: def.flat, increased: def.increased, more: def.more };
}
