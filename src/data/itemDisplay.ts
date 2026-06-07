/**
 * Item tooltip rows — turns a rolled ItemInstance into labelled, colour-coded
 * stat rows for the inventory tooltip:
 *   - source: base stat (white) · primary affix (blue) · additional affix (purple)
 *   - quality: each rolled value vs its expected base — better (green) / worse
 *     (red) / on-par (white) — so players can read roll quality at a glance.
 */
import type { ItemDef, Stats } from "./schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";

export type StatSource = "base" | "primary" | "affix";
export type Quality = "base" | "better" | "worse";

export interface ItemStatRow {
  label: string;
  value: string;
  source: StatSource;
  quality: Quality;
}

/** Hex colours for the two coordinated schemes. */
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

// Stat keys whose value is a small fraction shown as a percentage.
const FRACTION = new Set<keyof Stats | string>([
  "critRate", "critDamage", "armorPen", "magicPen", "damageReduction", "critDefense",
  "tenacity", "omnivamp", "goldFind", "skillPower", "manaCostReduction", "attackSpeed",
]);

function label(key: string): string {
  return STAT_LABEL[key] ?? key;
}

function fmtValue(key: string, v: number, affix: boolean): string {
  const sign = affix && v >= 0 ? "+" : "";
  if (key === "physicalDamage" || key === "magicDamage") return `+${Math.round(v * 100)}%`;
  if (FRACTION.has(key)) return `${sign}${Math.round(v * 100)}%`;
  return `${sign}${Math.round(v)}`;
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

export function itemStatRows(inst: ItemInstanceSave, def: ItemDef): ItemStatRow[] {
  const rows: ItemStatRow[] = [];
  const lvlScale = 1 + 0.08 * def.requiredLevel; // matches rollItem's base-stat scaling

  // Base / primary stats (white).
  for (const [k, v] of Object.entries(inst.rolledStats)) {
    if (typeof v !== "number") continue;
    const base = (def.baseStats[k as keyof Stats] ?? 0) * lvlScale;
    rows.push({ label: label(k), value: fmtValue(k, v, false), source: "base", quality: quality(v, base) });
  }

  // Primary affix (blue).
  const pt = def.primaryAffix.type;
  rows.push({
    label: label(pt), value: fmtValue(pt, inst.rolledPrimaryAffix, true),
    source: "primary", quality: quality(inst.rolledPrimaryAffix, def.primaryAffix.baseValue),
  });

  // Additional affixes (purple).
  for (const a of inst.rolledAffixes) {
    rows.push({
      label: label(a.type), value: fmtValue(a.type, a.value, true),
      source: "affix", quality: quality(a.value, AFFIX_ROLL_MID),
    });
  }
  return rows;
}
