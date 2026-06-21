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
import { instanceReqLevel, APEX_STAT_MULT } from "../data/items.ts";
import { uniquePowerFor } from "./uniquePowers.ts";
import { rollTrigger } from "./uniqueTriggers.ts";

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
  base: "#ffffff", // primary/base stat
  primary: "#5fa8ff", // primary affix
  affix: "#c98bff", // additional affix
};
export const QUALITY_COLOR: Record<Quality, string> = {
  base: "#ffffff", // on-par with base roll
  better: "#6ee06e", // rolled above base
  worse: "#ff7a7a", // rolled below base
};

export const STAT_LABEL: Record<string, string> = {
  atk: "ATK",
  maxHp: "HP",
  range: "Range",
  attackSpeed: "Atk Spd",
  critRate: "Crit",
  critDamage: "Crit Dmg",
  armor: "Armor",
  magicResist: "M.Resist",
  moveSpeed: "Move",
  hpRegen: "HP Regen",
  skillPower: "Skill Pwr",
  omnivamp: "Omnivamp",
  goldFind: "Gold",
  armorPen: "Armor Pen",
  magicPen: "Magic Pen",
  damageReduction: "Dmg Reduc",
  critDefense: "Crit Def",
  tenacity: "Tenacity",
  manaOnHit: "Mana/Hit",
  manaOnKill: "Mana/Kill",
  physicalDamage: "Phys Dmg",
  magicDamage: "Magic Dmg",
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
  manaOnHit: ["+", " Mana on Hit"],
  manaOnKill: ["+", " Mana on Kill"],
  moveSpeed: ["+", " Move Speed"],
  skillPower: ["+", " Skill Power (Magic/True skill damage)"],
  goldFind: ["+", " Gold Found"],
  omnivamp: ["Heals ", " of damage dealt"],
  armorPen: ["Ignores ", " of enemy Armor"],
  magicPen: ["Ignores ", " of Magic Resist"],
  damageReduction: ["Reduces damage taken by ", ""],
  critDefense: ["Reduces crit damage taken by ", ""],
  tenacity: ["Reduces crowd-control by ", ""],
  physicalDamage: ["+", " Physical Damage"],
  magicDamage: ["+", " Magic Damage"],
};

// Stat keys whose value is a small fraction shown as a percentage.
export const FRACTION = new Set<keyof Stats | string>([
  "critRate",
  "critDamage",
  "armorPen",
  "magicPen",
  "damageReduction",
  "critDefense",
  "tenacity",
  "omnivamp",
  "goldFind",
  "skillPower",
  "attackSpeed",
]);

function label(key: string): string {
  return STAT_LABEL[key] ?? key;
}

/** A positive bonus must never read as 0 — show one decimal for tiny rolls. */
export function pctStr(v: number): string {
  const p = v * 100;
  return p > 0 && Math.round(p) === 0 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

/** Base/intrinsic stats: fractional stats as %, scalar stats as a flat number. */
export function fmtBaseValue(key: string, v: number): string {
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

/** One stat's value at the current vs the next enhance level. */
export interface EnhancePreviewRow {
  label: string;
  before: string;
  after: string;
}

/**
 * Per-stat before/after for enhancing from `fromLevel` to `toLevel`. Enhancement
 * scales the item's base stats (rolledStats) AND its PRIMARY affix — but not its
 * additional affixes — so those are exactly the rows shown. Values are the
 * displayed TOTALS (no ×mult). The primary-affix row is a percentage bonus and
 * is suffixed " (affix)" so it reads distinctly from a same-named base stat.
 */
export function enhancePreviewRows(
  inst: ItemInstanceSave,
  def: ItemDef,
  fromLevel: number,
  toLevel: number,
): EnhancePreviewRow[] {
  const mFrom = enhanceBonus(fromLevel);
  const mTo = enhanceBonus(toLevel);
  const rows: EnhancePreviewRow[] = [];
  for (const [k, v] of Object.entries(inst.rolledStats)) {
    if (typeof v !== "number") continue;
    rows.push({
      label: label(k),
      before: fmtBaseValue(k, v * mFrom),
      after: fmtBaseValue(k, v * mTo),
    });
  }
  // Primary affix (a percentage bonus) scales with enhancement too.
  const pa = inst.rolledPrimaryAffix;
  if (typeof pa === "number") {
    rows.push({
      label: `${label(def.primaryAffix.type)} (affix)`,
      before: pctStr(pa * mFrom),
      after: pctStr(pa * mTo),
    });
  }
  return rows;
}

/** Gold-line color for the Unique-Power tooltip row. */
export const UNIQUE_POWER_COLOR = "#ffd24a";

/**
 * The Unique Power line for an item's tooltip, or null for non-Unique items.
 * Static-context (`uniqueCount: 1`) describe — the count-scaled wording in
 * battle reads from the live loadout; the tooltip shows the per-item baseline.
 *
 * Procedural Uniques roll their power PER INSTANCE (seeded by the copy's id, the
 * same way the battle stat pipeline resolves it in uniquePowerStats.ts), so pass
 * the instance id to show the power THIS copy actually grants — without it the
 * tooltip would advertise a different power than the equipped item provides.
 */
export function uniquePowerLine(
  def: ItemDef,
  instanceId?: string,
): { name: string; desc: string } | null {
  const power = uniquePowerFor(def, instanceId);
  if (!power) return null;
  return { name: power.name, desc: power.describe({ uniqueCount: 1 }) };
}

/**
 * The triggered-effect (combat BEHAVIOUR) line for a specific Unique COPY, or null
 * when the item has no trigger. Each instance rolls its own behaviour from a pool
 * suitable for the item (seeded by instance id), so pass the instance id to show
 * that copy's actual proc. Shown beneath the Unique Power as a "⚡ …" row.
 */
export function uniqueTriggerLine(def: ItemDef, instanceId?: string): string | null {
  const trig = rollTrigger(def, instanceId);
  return trig ? `⚡ ${trig.describe()}` : null;
}

export function itemStatRows(inst: ItemInstanceSave, def: ItemDef): ItemStatRow[] {
  const rows: ItemStatRow[] = [];
  // Match rollItem's scaling so the quality baseline is fair: base stats scale
  // with the COPY's required level, and an Apex copy's expected values include
  // the +25% Apex bonus.
  const apexMult = inst.apex ? APEX_STAT_MULT : 1;
  const lvlScale = (1 + 0.08 * instanceReqLevel(inst, def)) * apexMult;

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
    const row: ItemStatRow = {
      source: "base",
      quality: quality(v, base),
      before: label(k),
      value: fmtBaseValue(k, total),
      after: "",
    };
    if (level > 0) row.bonus = `(+${fmtBaseValue(k, total - v)})`;
    rows.push(row);
  }

  // Primary affix (blue): full sentence. Enhancement scales the primary affix
  // too (see affixStats), so show the enhanced TOTAL; quality still compares the
  // raw rolled value to its base. Apex copies expect +25% here too.
  rows.push(
    affixRow(
      def.primaryAffix.type,
      inst.rolledPrimaryAffix * mult,
      "primary",
      quality(inst.rolledPrimaryAffix, def.primaryAffix.baseValue * apexMult),
    ),
  );

  // Additional affixes (purple): full sentences.
  for (const a of inst.rolledAffixes) {
    rows.push(affixRow(a.type, a.value, "affix", quality(a.value, AFFIX_ROLL_MID * apexMult)));
  }
  return rows;
}
