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
import type { HeroSave } from "../core/save.ts";
import { skillEffectiveAoe } from "../core/hero.ts";
import { heroSkillDamage } from "../core/skillDamage.ts";
import { ACTIVE_SKILLS_MAP } from "./skills.ts";
import { SUMMON_MAP } from "./summons.ts";
import { defaultHeroStats } from "./stage.ts";

const SPLASH_RADIUS = 60; // battle.ts SPLASH_RADIUS
const ACTIVE_MULT = 2; // battle.ts castActive: burst = effAtk * 2 * skillPower

const pct = (v: number) => `${Math.round(v * 100)}%`;
const n0 = (v: number) => `${Math.round(v)}`;

/** Detailed active-skill text with the burst damage this tower's stats produce. */
export function activeSkillDetail(def: CharacterDef, stats: Stats): string {
  if (!def.active) return "";
  const info = towerActiveInfo(def.active);
  const sp = Math.max(1, stats.skillPower);
  const ds = def.behavior?.defenseScale;
  const defBonus = ds
    ? stats.armor * (ds.armor ?? 0) +
      stats.magicResist * (ds.magicResist ?? 0) +
      stats.maxHp * (ds.maxHp ?? 0)
    : 0;
  const burst = Math.round(stats.atk * ACTIVE_MULT * sp + defBonus);
  const type = def.behavior?.activeType ?? def.damageType;
  const radius = def.behavior?.splashRadius ?? SPLASH_RADIUS;
  const defNote = ds ? ` + ${n0(defBonus)} from defenses` : "";
  const role = roleEffectDetail(def, stats);
  const stun = def.behavior?.stun;
  const stunNote = stun ? `\n▸ Stuns its single target for ${stun.duration}s.` : "";
  return (
    `${info.description}\n▸ Burst: ${burst} ${type} (atk ${n0(stats.atk)} ×${ACTIVE_MULT} × ${sp.toFixed(2)} skill power${defNote}), ${radius}px AoE.` +
    stunNote +
    (role ? `\n▸ ${role}` : "")
  );
}

/**
 * Full, value-rich detail for a HERO active skill — the complete picture shown in
 * the in-battle hero info panel (no longer just the one-line flavour). Every number
 * comes from the SAME functions the sim uses (`heroSkillDamage` + `skillEffectiveAoe`),
 * so the tooltip equals what the cast actually does for THIS hero at THIS skill level.
 */
export function heroActiveSkillDetail(
  save: HeroSave,
  skillId: string,
  base: Stats = defaultHeroStats(),
): string {
  const def = ACTIVE_SKILLS_MAP.get(skillId);
  if (!def) return "";
  const level = save.hero.obtainedSkills.find((e) => e.skillId === skillId)?.level ?? 0;
  const dmg = heroSkillDamage(save, skillId, base);
  const aoe = Math.round(skillEffectiveAoe(def.baseAoe, level));
  const weapon = def.requiresWeapon
    ? `Requires a ${def.requiresWeapon}`
    : def.weaponClass
      ? `Requires a ${def.weaponClass} weapon`
      : "Any weapon";

  const lines = [
    def.description,
    `▸ ${def.rarity} · ${def.damageType} · Lv ${level}`,
    `▸ Burst: ≈${n0(dmg.burst)} ${def.damageType} (atk ${n0(dmg.atk)} ×${dmg.mult.toFixed(2)} × ${dmg.skillPower.toFixed(2)} skill power).`,
    `▸ ${aoe}px area of effect — its cast VFX fills exactly this zone.`,
    `▸ ${weapon}.`,
  ];

  if (def.summon) {
    const sd = SUMMON_MAP.get(def.summon.defId);
    if (sd) {
      const count = def.summon.count ?? sd.count;
      const life = def.summon.lifespan ?? sd.lifespan;
      const matk = n0(dmg.atk * sd.atkFrac);
      const slow = sd.slow ? `, slow ${pct(sd.slow.pct)}` : "";
      lines.push(`▸ Summons ${count}× ${sd.name} for ${life}s (≈${matk} atk each${slow}).`);
    }
  }
  return lines.join("\n");
}

/** Exact on-hit role mechanic for this tower (splash/chain/DoT/control/aura). */
export function roleEffectDetail(def: CharacterDef, stats: Stats): string | null {
  const b = def.behavior;
  switch (def.role) {
    case "splash":
      return `Splash: ${n0(stats.atk)} ${def.damageType} in ${b?.splashRadius ?? SPLASH_RADIUS}px.`;
    case "chain": {
      const tg = b?.chainTargets ?? 2,
        f = b?.chainFalloff ?? 0.6;
      return `Chain: hits ${tg} extra foes, ${pct(f)} retained/bounce (≈${n0(stats.atk * f)} on the 2nd).`;
    }
    case "dot":
      if (!b?.dot) return null;
      return `DoT: ${n0(b.dot.dps)}/s ${b.dot.damageType ?? def.damageType} for ${b.dot.duration}s = ${Math.round(b.dot.dps * b.dot.duration)} total.`;
    case "debuff": {
      // Slow is the on-hit control; stun is the active skill (see activeSkillDetail).
      if (!b?.slow) return null;
      return `Control: slow ${pct(b.slow.pct)} for ${b.slow.duration}s.`;
    }
    case "support":
      if (!b?.buffAura) return null;
      {
        const a = b.buffAura,
          parts: string[] = [];
        if (a.atkPct) parts.push(`+${pct(a.atkPct)} atk`);
        if (a.attackSpeedPct) parts.push(`+${pct(a.attackSpeedPct)} atk spd`);
        return `Aura ${a.radius}px: ${parts.join(", ")} to allies.`;
      }
    case "tanker": {
      const d = b?.defenseScale;
      if (!d) return null;
      const parts: string[] = [];
      if (d.armor) parts.push(`${d.armor}× armor (${n0(stats.armor * d.armor)})`);
      if (d.magicResist)
        parts.push(`${d.magicResist}× resist (${n0(stats.magicResist * d.magicResist)})`);
      if (d.maxHp) parts.push(`${pct(d.maxHp)} max HP (${n0(stats.maxHp * d.maxHp)})`);
      return `Fortress: its cast adds ${parts.join(" + ")} as damage.`;
    }
    default:
      return null;
  }
}
