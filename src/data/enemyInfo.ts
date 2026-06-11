/**
 * Player-facing enemy intel for the stage-select compendium. Pure data/helpers
 * derived from the enemy catalog so the UI can list every foe and its specialty.
 */
import type { EnemyArchetype, EnemyDef, Immunity } from "./schema.ts";

/** One-line specialty per archetype. */
export const ARCHETYPE_INFO: Record<EnemyArchetype, string> = {
  Rusher: "Fast and fragile — rushes the castle in swarms.",
  Brute: "Heavily armored — shrugs off light hits; use armor pen.",
  Bulwark: "Carries a shield and ignores splash — use single-target or chain.",
  Mender: "Heals nearby allies — focus it down first.",
  Regenerator: "Regenerates health — burst it before it recovers.",
  Splitter: "Splits into smaller foes when killed.",
  Gargoyle: "Flying — needs anti-air towers or the hero.",
  StormFlyer: "Fast flying caster — slips past ground defenses.",
  Sapper: "Stops to demolish your towers — protect your line.",
  Phantom: "Stealthed — only the hero can strike it.",
  Summoner: "Endlessly spawns minions — prioritize the summoner.",
  Raider: "Berserker that smashes towers on its way in.",
  Courier: "Flees carrying gold — catch it quickly.",
  Juggernaut: "Slow, halves all damage and is immune to one type — answer with the other type, True, or penetration.",
  Herald: "Rallies nearby allies (speed + toughness) — kill it first.",
  Hexer: "Heals and armors allies and slows your towers — a priority kill.",
  Berserker: "Frenzies when wounded — gets faster and deadlier; burst it down before it snaps.",
  Adapter: "Alternates immunity between Physical and Magic — bring both types, True damage, or penetration.",
  Burster: "Detonates on death, damaging nearby towers — kill it at range or spread your towers.",
  Dreadnought: "Armored flyer that bombards your towers — needs heavy, dedicated anti-air.",
  Disruptor: "Periodically silences nearby towers — kill it first or spread your defenses.",
  Boss: "Boss — enrages, summons, or disables your towers.",
};

const IMMUNITY_TAG: Record<Immunity, string> = {
  Physical: "Immune: Physical",
  Magic: "Immune: Magic",
  CC: "Immune: CC",
  AoE: "Immune: Splash",
};

/** Short tags (flying / immunity / boss mechanics) for an enemy. */
export function enemyTags(def: EnemyDef): string[] {
  const tags: string[] = [];
  if (def.flying) tags.push("Flying");
  if (def.immunity) tags.push(IMMUNITY_TAG[def.immunity]);
  if (def.special?.shieldHp) tags.push("Shielded");
  if (def.special?.healAura) tags.push("Healer");
  if (def.special?.splitInto) tags.push("Splits");
  if (def.special?.summon) tags.push("Summons");
  if (def.baseStats.damageReduction >= 0.5) tags.push("Halves damage");
  if (def.special?.supportAura) {
    tags.push(def.special.supportAura.healPerSec ? "Heals allies" : "Buffs allies");
    if (def.special.supportAura.towerAttackSpeedMult) tags.push("Slows towers");
  }
  if (def.boss?.enrage) tags.push("Enrages");
  if (def.boss?.towerDisable) tags.push("Disables towers");
  if (def.baseStats.hpRegen >= 10) tags.push("Regenerates");
  if (def.special?.frenzy) tags.push("Frenzies");
  if (def.special?.adaptiveImmunity) tags.push("Adaptive immunity");
  if (def.special?.deathNova) tags.push("Death nova");
  if (def.special?.towerDisablePulse) tags.push("Disables towers");
  return tags;
}

/** Full specialty line for an enemy: archetype text. */
export function enemySpecialty(def: EnemyDef): string {
  return ARCHETYPE_INFO[def.archetype];
}
