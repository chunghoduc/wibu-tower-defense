// src/core/combatLog.ts
//
// Opt-in damage-calculation logging for debugging. The battle sim emits a full
// formula breakdown for every instance of damage WHEN a sink is installed (off
// by default → zero cost: a single null check). Enable it in the browser with
// `window.__damageLog()` (see main.ts), which routes lines to the console + the
// runtime log file.
import type { DamageType } from "../data/schema.ts";

export interface DamageLog {
  src: string; // attacker label, e.g. "tower:7" / "hero" / "dot"
  target: string; // "<enemyId>#<uid>"
  kind: string; // basic | active | splash | chain | dot
  type: DamageType;
  raw: number; // pre-mitigation damage
  rawFormula: string; // how `raw` was computed (e.g. "atk 42 ×crit 1.50")
  crit?: { rate: number; roll: number; hit: boolean; mult: number };
  defRating: number; // armor or magic resist (0 for True)
  pen: number; // armorPen / magicPen applied (0 for True)
  effRating: number; // rating after penetration
  mitigationFrac: number;
  afterMitig: number;
  damageReduction: number;
  afterDR: number; // == mitigatedDamage
  shieldAbsorbed: number;
  hpDamage: number;
  targetHpAfter: number;
  targetHpMax: number;
}

type Sink = (line: string, data: DamageLog) => void;

let sink: Sink | null = null;

/** Install (or clear with null) the damage-log sink. */
export function setCombatLogSink(s: Sink | null): void {
  sink = s;
}

/** True when logging is active — guard expensive log-building at call sites. */
export function combatLogOn(): boolean {
  return sink !== null;
}

/** Emit one fully-formatted damage line (no-op when no sink is installed). */
export function emitDamageLog(d: DamageLog): void {
  if (sink) sink(formatDamageLog(d), d);
}

const pc = (f: number) => `${(f * 100).toFixed(1)}%`;

/** Render a damage breakdown as a single readable formula line. */
export function formatDamageLog(d: DamageLog): string {
  const crit = d.crit
    ? d.crit.hit
      ? ` CRIT(roll ${fmtRoll(d.crit.roll)}<${d.crit.rate.toFixed(3)} ×${d.crit.mult.toFixed(2)})`
      : ` no-crit(roll ${fmtRoll(d.crit.roll)}≥${d.crit.rate.toFixed(3)})`
    : "";
  const mit =
    d.type === "True"
      ? "True: ignores armor/resist"
      : `${d.type === "Physical" ? "armor" : "resist"} ${d.defRating.toFixed(0)}→${d.effRating.toFixed(1)} (pen ${pc(d.pen)}) mitig ${pc(d.mitigationFrac)}`;
  return (
    `[dmg] ${d.src}→${d.target} ${d.kind}/${d.type}: ${d.rawFormula} = ${d.raw.toFixed(1)}${crit}` +
    ` | ${mit} → ${d.afterMitig.toFixed(1)}` +
    ` | DR ${pc(d.damageReduction)} → ${d.afterDR.toFixed(1)}` +
    (d.shieldAbsorbed > 0 ? ` | shield -${d.shieldAbsorbed.toFixed(1)}` : "") +
    ` | HP -${d.hpDamage.toFixed(1)} (${d.targetHpAfter.toFixed(0)}/${d.targetHpMax.toFixed(0)})`
  );
}

function fmtRoll(r: number): string {
  return Number.isNaN(r) ? "—" : r.toFixed(3);
}
