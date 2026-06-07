/**
 * Value-rich skill descriptions. The static prose in passiveSkills.ts says WHAT
 * a skill does; this computes the exact numbers a specific tower produces from
 * its current stats + behavior (active burst damage, splash, chain, DoT totals,
 * slow/stun, support aura). Shown on skill hover in the battle info panel.
 *
 * Constants mirror src/core/battle.ts — keep in sync (centralized in T10 refactor).
 */
import type { CharacterDef, Stats } from "./schema.ts";
import { towerActiveInfo } from "./passiveSkills.ts";

const SPLASH_RADIUS = 60;   // battle.ts SPLASH_RADIUS
const ACTIVE_MULT = 2;      // battle.ts castActive: burst = effAtk * 2 * skillPower

const pct = (v: number) => `${Math.round(v * 100)}%`;
const n0 = (v: number) => `${Math.round(v)}`;

/** Detailed active-skill text with the burst damage this tower's stats produce. */
export function activeSkillDetail(def: CharacterDef, stats: Stats): string {
  if (!def.active) return "";
  const info = towerActiveInfo(def.active);
  const sp = Math.max(1, stats.skillPower);
  const burst = Math.round(stats.atk * ACTIVE_MULT * sp);
  const type = def.behavior?.activeType ?? def.damageType;
  const radius = def.behavior?.splashRadius ?? SPLASH_RADIUS;
  const role = roleEffectDetail(def, stats);
  return `${info.description}\n▸ Burst: ${burst} ${type} (atk ${n0(stats.atk)} ×${ACTIVE_MULT} × ${sp.toFixed(2)} skill power), ${radius}px AoE.`
    + (role ? `\n▸ ${role}` : "");
}

/** Exact on-hit role mechanic for this tower (splash/chain/DoT/control/aura). */
export function roleEffectDetail(def: CharacterDef, stats: Stats): string | null {
  const b = def.behavior;
  switch (def.role) {
    case "splash":
      return `Splash: ${n0(stats.atk)} ${def.damageType} in ${b?.splashRadius ?? SPLASH_RADIUS}px.`;
    case "chain": {
      const tg = b?.chainTargets ?? 2, f = b?.chainFalloff ?? 0.6;
      return `Chain: hits ${tg} extra foes, ${pct(f)} retained/bounce (≈${n0(stats.atk * f)} on the 2nd).`;
    }
    case "dot":
      if (!b?.dot) return null;
      return `DoT: ${n0(b.dot.dps)}/s ${b.dot.damageType ?? def.damageType} for ${b.dot.duration}s = ${Math.round(b.dot.dps * b.dot.duration)} total.`;
    case "debuff": {
      const parts: string[] = [];
      if (b?.slow) parts.push(`slow ${pct(b.slow.pct)} for ${b.slow.duration}s`);
      if (b?.stun) parts.push(`stun ${b.stun.duration}s (${pct(b.stun.chance)})`);
      return parts.length ? `Control: ${parts.join(", ")}.` : null;
    }
    case "support":
      if (!b?.buffAura) return null;
      {
        const a = b.buffAura, parts: string[] = [];
        if (a.atkPct) parts.push(`+${pct(a.atkPct)} atk`);
        if (a.attackSpeedPct) parts.push(`+${pct(a.attackSpeedPct)} atk spd`);
        return `Aura ${a.radius}px: ${parts.join(", ")} to allies.`;
      }
    default:
      return null;
  }
}
