/**
 * Pure stat selection + formatting for the Inventory hero total-stats panel.
 * Kept Phaser-free so it can be unit-tested without a browser environment;
 * `heroStatsPanel.ts` renders these rows.
 */
import type { Stats } from "../data/schema.ts";

const n0 = (v: number) => `${Math.round(v)}`;
const n1 = (v: number) => v.toFixed(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const mult = (v: number) => `${v.toFixed(1)}×`;

// The hero stats worth surfacing, in display order, with a formatter.
const HERO_STAT_ROWS: [keyof Stats, string, (v: number) => string][] = [
  ["atk", "ATK", n0],
  ["attackSpeed", "Atk Spd", n1],
  ["range", "Range", n0],
  ["critRate", "Crit", pct],
  ["critDamage", "Crit Dmg", mult],
  ["maxHp", "HP", n0],
  ["hpRegen", "HP Regen", n1],
  ["armor", "Armor", n0],
  ["magicResist", "M.Resist", n0],
  ["skillPower", "Skill Pwr", mult],
  ["omnivamp", "Omnivamp", pct],
  ["moveSpeed", "Move Spd", n0],
];

/** Selected hero stats as display-ready { label, value } rows. Pure. */
export function heroStatRows(stats: Stats): { label: string; value: string }[] {
  return HERO_STAT_ROWS.map(([k, label, fmt]) => ({ label, value: fmt(stats[k] ?? 0) }));
}
