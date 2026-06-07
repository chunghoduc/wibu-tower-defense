/**
 * Item tooltip rows — turns a rolled ItemInstance into colour-coded rows:
 *   - source: base stat (white) · primary affix (blue) · additional affix (purple)
 *   - quality: each rolled value vs its expected base — better (green) / worse
 *     (red) / on-par (white).
 *
 * Base/primary stats render as `label  value` (label = source colour, value =
 * quality colour). Affixes render as a full sentence with the value embedded,
 * split into before/value/after so the value keeps its quality colour inside the
 * source-coloured sentence (e.g. blue "Ignores " + green "7%" + blue " of Armor").
 */
import type { ItemDef, Stats } from "./schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";
import { enhanceBonus } from "../core/enhance.ts";

export type StatSource = "base" | "primary" | "affix";
export type Quality = "base" | "better" | "worse";

export interface ItemStatRow {
  source: StatSource;
  quality: Quality;
  /** Text before the value (base stat: the stat label; affix: sentence prefix). */
  before: string;
  /** The formatted value — base stats show the enhance-scaled TOTAL. */
  value: string;
  /** Text after the value (base stat: empty; affix: sentence suffix). */
  after: string;
  /** Enhance bonus portion for a base stat, e.g. "(+6)" — only when enhanced. */
  bonus?: string;
}

export const SOURCE_COLOR: Record<StatSource, string> = {
  base: "#ffffff",     // primary/base stat
  primary: "#5fa8ff",  // primary affix
  affix: "#c98bff",    // additional affix
};
export const QUALITY_COLOR: Record<Quality, string> = {
  base: "#ffffff",     // on-par with base roll
  better: "#6ee06e",   // rolled above base
  worse: "#ff7a7a",    // rolled below base
};

const STAT_LABEL: Record<string, string> = {
  atk: "ATK", maxHp: "HP", range: "Range", attackSpeed: "Atk Spd", critRate: "Crit",
  critDamage: "Crit Dmg", armor: "Armor", magicResist: "M.Resist", moveSpeed: "Move",
  hpRegen: "HP Regen", skillPower: "Skill Pwr", omnivamp: "Omnivamp", goldFind: "Gold",
  armorPen: "Armor Pen", magicPen: "Magic Pen", damageReduction: "Dmg Reduc",
  critDefense: "Crit Def", tenacity: "Tenacity", maxMana: "Mana", manaRegen: "Mana Regen",
  manaOnHit: "Mana/Hit", manaOnKill: "Mana/Kill", manaCostReduction: "Cost Reduc",
  physicalDamage: "Phys Dmg", magicDamage: "Magic Dmg",
};

/** Full-sentence wording for an affix: [prefix, suffix] around the value. */
const AFFIX_PHRASE: Record<string, [string, string]> = {
  atk: ["+", " Attack"],
  attackSpeed: ["+", " Attack Speed"],
  critRate: ["+", " Critical Chance"],
  critDamage: ["+", " Critical Damage"],
  range: ["+", " Attack Range"],
  maxHp: ["+", " Max Health"],
  armor: ["+", " Armor"],
  magicResist: ["+", " Magic Resist"],
  hpRegen: ["+", " Health Regen"],
  maxMana: ["+", " Max Mana"],
  manaRegen: ["+", " Mana Regen"],
  manaOnHit: ["+", " Mana on Hit"],
  manaOnKill: ["+", " Mana on Kill"],
  moveSpeed: ["+", " Move Speed"],
  skillPower: ["+", " Skill Power"],
  goldFind: ["+", " Gold Found"],
  omnivamp: ["Heals ", " of damage dealt"],
  armorPen: ["Ignores ", " of enemy Armor"],
  magicPen: ["Ignores ", " of Magic Resist"],
  damageReduction: ["Reduces damage taken by ", ""],
  critDefense: ["Reduces crit damage taken by ", ""],
  tenacity: ["Reduces crowd-control by ", ""],
  manaCostReduction: ["Reduces skill cost by ", ""],
  physicalDamage: ["+", " Physical Damage"],
  magicDamage: ["+", " Magic Damage"],
};

// Stat keys whose value is a small fraction shown as a percentage.
const FRACTION = new Set<keyof Stats | string>([
  "critRate", "critDamage", "armorPen", "magicPen", "damageReduction", "critDefense",
  "tenacity", "omnivamp", "goldFind", "skillPower", "manaCostReduction", "attackSpeed",
]);

function label(key: string): string {
  return STAT_LABEL[key] ?? key;
}

/** A positive bonus must never read as 0 — show one decimal for tiny rolls. */
function pctStr(v: number): string {
  const p = v * 100;
  return p > 0 && Math.round(p) === 0 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

/** Base/intrinsic stats: fractional stats as %, scalar stats as a flat number. */
function fmtBaseValue(key: string, v: number): string {
  if (FRACTION.has(key) || key === "physicalDamage" || key === "magicDamage") return pctStr(v);
  return v > 0 && Math.round(v) === 0 ? v.toFixed(1) : `${Math.round(v)}`;
}

/**
 * Every affix (primary + additional) is a PERCENTAGE bonus: fractional stats add
 * their fraction directly, scalar stats apply as an increase % (see affixStats),
 * physical/magic damage are % too. So all affix values render as a percentage —
 * which also means a beneficial roll never shows as a flat "+0".
 */
function fmtAffixValue(_key: string, v: number): string {
  return pctStr(v);
}

/** Compare a rolled value to its expected base (±2% dead-zone = on par). */
function quality(rolled: number, base: number): Quality {
  if (base <= 0) return "base";
  if (rolled > base * 1.02) return "better";
  if (rolled < base * 0.98) return "worse";
  return "base";
}

/** Midpoint of the random-affix roll range (items.ts rolls value in [0.05, 0.20]). */
const AFFIX_ROLL_MID = 0.125;

function affixRow(type: string, v: number, source: StatSource, q: Quality): ItemStatRow {
  const phrase = AFFIX_PHRASE[type] ?? ["+", ` ${label(type)}`];
  return { source, quality: q, before: phrase[0], value: fmtAffixValue(type, v), after: phrase[1] };
}

export function itemStatRows(inst: ItemInstanceSave, def: ItemDef): ItemStatRow[] {
  const rows: ItemStatRow[] = [];
  const lvlScale = 1 + 0.08 * def.requiredLevel; // matches rollItem's base-stat scaling

  // Base / primary stats (white): label + value. When enhanced, the item's base
  // stats are multiplied by the enhance bonus (this is what battle applies), so
  // show the enhanced TOTAL plus the bonus portion, e.g. "Armor  24 (+4)". Roll
  // quality still compares the raw rolled value to its base.
  const level = inst.enhanceLevel ?? 0;
  const mult = enhanceBonus(level);
  for (const [k, v] of Object.entries(inst.rolledStats)) {
    if (typeof v !== "number") continue;
    const base = (def.baseStats[k as keyof Stats] ?? 0) * lvlScale;
    const total = v * mult;
    const row: ItemStatRow = { source: "base", quality: quality(v, base), before: label(k), value: fmtBaseValue(k, total), after: "" };
    if (level > 0) row.bonus = `(+${fmtBaseValue(k, total - v)})`;
    rows.push(row);
  }

  // Primary affix (blue): full sentence.
  rows.push(affixRow(def.primaryAffix.type, inst.rolledPrimaryAffix, "primary",
    quality(inst.rolledPrimaryAffix, def.primaryAffix.baseValue)));

  // Additional affixes (purple): full sentences.
  for (const a of inst.rolledAffixes) {
    rows.push(affixRow(a.type, a.value, "affix", quality(a.value, AFFIX_ROLL_MID)));
  }
  return rows;
}
