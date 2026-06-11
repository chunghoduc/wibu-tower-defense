/**
 * Item comparison — when a bag item is about to replace an equipped one, line up
 * their stats and affixes so the player sees exactly what changes.
 *
 * Convention (matches the in-game popup): each row shows the CURRENTLY EQUIPPED
 * item's value, plus the delta you'd gain by equipping the BAG item instead
 * (`bag - equipped`). A stat present on only one item counts as 0 on the other,
 * so e.g. bag 100 HP vs equipped (no HP) reads "HP 0 (+100)". Positive deltas are
 * an upgrade (green), negative a downgrade (red).
 *
 * Two unit families are kept separate because they can't be summed: base/intrinsic
 * stats are flat numbers (or %, for fractional stats), while affixes (primary +
 * additional) are percentage bonuses. The dialog renders them as two sections.
 */
import type { ItemDef } from "./schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";
import { enhanceBonus } from "../core/enhance.ts";
import { STAT_LABEL, FRACTION, fmtBaseValue, pctStr } from "./itemDisplay.ts";

export interface CompareRow {
  /** Display label for the stat/affix. */
  label: string;
  /** The equipped item's value, formatted (the number the player keeps if they don't swap). */
  equipped: string;
  /** The selected (bag) item's value, formatted (the number you'd gain by equipping it). */
  bag: string;
  /** Signed delta the swap would apply, formatted (e.g. "+100", "-2%", "0"). */
  delta: string;
  /** Colour hint: 1 = upgrade (green), -1 = downgrade (red), 0 = no change. */
  dir: -1 | 0 | 1;
}

export interface ItemComparison {
  /** Base/intrinsic stats (flat numbers, or % for fractional stats). */
  stats: CompareRow[];
  /** Primary + additional affixes (percentage bonuses), aggregated by type. */
  affixes: CompareRow[];
}

export interface ItemRef {
  inst: ItemInstanceSave;
  def: ItemDef;
}

// Canonical stat ordering so both items list rows the same way (offense → defense
// → resource → sustain → utility). Unknown keys fall to the end, alphabetical.
const STAT_ORDER = [
  "atk", "attackSpeed", "critRate", "critDamage", "range", "armorPen", "magicPen", "skillPower",
  "maxHp", "hpRegen", "armor", "magicResist", "damageReduction", "critDefense", "tenacity",
  "manaOnHit", "manaOnKill", "omnivamp", "moveSpeed", "goldFind",
];

/** Base/intrinsic stat totals (enhance-scaled), keyed by stat key. */
function baseStatTotals(inst: ItemInstanceSave): Record<string, number> {
  const mult = enhanceBonus(inst.enhanceLevel ?? 0);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(inst.rolledStats)) {
    if (typeof v === "number") out[k] = v * mult;
  }
  return out;
}

/**
 * Affix totals keyed by affix type. Enhancement scales the PRIMARY affix only
 * (mirrors itemDisplay/battle); additional affixes use their raw rolled value.
 * Two affixes of the same type are summed.
 */
function affixTotals(inst: ItemInstanceSave, def: ItemDef): Record<string, number> {
  const mult = enhanceBonus(inst.enhanceLevel ?? 0);
  const out: Record<string, number> = {};
  const pa = inst.rolledPrimaryAffix;
  if (typeof pa === "number") out[def.primaryAffix.type] = (out[def.primaryAffix.type] ?? 0) + pa * mult;
  for (const a of inst.rolledAffixes) out[a.type] = (out[a.type] ?? 0) + a.value;
  return out;
}

function orderKeys(keys: Iterable<string>): string[] {
  return [...new Set(keys)].sort((a, b) => {
    const ia = STAT_ORDER.indexOf(a), ib = STAT_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function row(label: string, key: string, eqV: number, bagV: number, asPct: boolean): CompareRow {
  const fmt = (n: number) => (asPct ? pctStr(n) : fmtBaseValue(key, n));
  const d = bagV - eqV;
  const mag = fmt(Math.abs(d));
  // Derive direction from the DISPLAYED magnitude so a sub-rounding diff that
  // shows as "0" isn't mis-coloured as a change.
  const zero = parseFloat(mag) === 0;
  return {
    label,
    equipped: fmt(eqV),
    bag: fmt(bagV),
    delta: zero ? "0" : (d > 0 ? "+" : "-") + mag,
    dir: zero ? 0 : d > 0 ? 1 : -1,
  };
}

/**
 * Compare a bag item against the equipped item it would replace.
 * `stats`/`affixes` cover the union of both items' keys (missing → 0).
 */
export function compareItems(bag: ItemRef, equipped: ItemRef): ItemComparison {
  const bagBase = baseStatTotals(bag.inst), eqBase = baseStatTotals(equipped.inst);
  const stats = orderKeys([...Object.keys(eqBase), ...Object.keys(bagBase)]).map((k) =>
    row(STAT_LABEL[k] ?? k, k, eqBase[k] ?? 0, bagBase[k] ?? 0, FRACTION.has(k)),
  );

  const bagAff = affixTotals(bag.inst, bag.def), eqAff = affixTotals(equipped.inst, equipped.def);
  const affixes = orderKeys([...Object.keys(eqAff), ...Object.keys(bagAff)]).map((k) =>
    row(STAT_LABEL[k] ?? k, k, eqAff[k] ?? 0, bagAff[k] ?? 0, true),
  );

  return { stats, affixes };
}
