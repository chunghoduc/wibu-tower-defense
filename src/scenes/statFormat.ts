/**
 * Pure stat-row formatting for the battle info panel — number formatters, the
 * hero/tower stat-key tables, and the aura-buffed tower-row builder. Phaser-free
 * (the `StatRow` import is type-only and erased) so it is unit-testable in node.
 */
import type { StatRow } from "./battleInfoPanel.ts";
import { effectiveTowerCombat } from "../core/towerCombatStats.ts";

export const n0 = (v: number) => `${Math.round(v)}`;
export const n1 = (v: number) => v.toFixed(1);
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const mult = (v: number) => `${v.toFixed(1)}×`;

export function statRows(
  s: Record<string, number>,
  keys: [string, (v: number) => string][],
): StatRow[] {
  const out: StatRow[] = [];
  for (const [key, fmt] of keys) {
    const v = s[key];
    if (v === undefined || v === 0) continue;
    out.push({ key, value: fmt(v) });
  }
  return out;
}

export const HERO_STAT_KEYS: [string, (v: number) => string][] = [
  ["atk", n0],
  ["range", n0],
  ["attackSpeed", n1],
  ["critRate", pct],
  ["critDamage", mult],
  ["armor", n0],
  ["magicResist", n0],
  ["moveSpeed", n0],
  ["hpRegen", n0],
  ["skillPower", mult],
  ["omnivamp", pct],
  ["goldFind", pct],
];

export const TOWER_STAT_KEYS: [string, (v: number) => string][] = [
  ["atk", n0],
  ["range", n0],
  ["attackSpeed", n1],
  ["critRate", pct],
  ["critDamage", mult],
  ["armorPen", pct],
  ["magicPen", pct],
  ["skillPower", mult],
  ["armor", n0],
  ["magicResist", n0],
  ["hpRegen", n0],
  ["damageReduction", pct],
  ["critDefense", pct],
  ["tenacity", pct],
  ["omnivamp", pct],
];

/** Aquamarine — matches the support-aura range ring; tints aura-buffed stats. */
export const AURA_BUFF_COLOR = 0x66ffcc;

/**
 * Tower stat rows with the support-aura buff folded into the displayed atk /
 * attack-speed, so a tower standing in an aura SHOWS its boosted numbers (tinted
 * aura-color with a ▲). `buffAtkPct` / `buffAsPct` are the live runtime buffs the
 * sim recomputes each tick in recomputeTowerBuffs().
 */
export function towerStatRows(
  stats: Record<string, number>,
  buffAtkPct: number,
  buffAsPct: number,
): StatRow[] {
  const rows = statRows(stats, TOWER_STAT_KEYS);
  const eff = effectiveTowerCombat(stats.atk ?? 0, stats.attackSpeed ?? 0, buffAtkPct, buffAsPct);
  for (const r of rows) {
    if (r.key === "atk" && eff.atkBuffed) {
      r.value = `${n0(eff.atk)} ▲`;
      r.buffColor = AURA_BUFF_COLOR;
    } else if (r.key === "attackSpeed" && eff.asBuffed) {
      r.value = `${n1(eff.attackSpeed)} ▲`;
      r.buffColor = AURA_BUFF_COLOR;
    }
  }
  return rows;
}
