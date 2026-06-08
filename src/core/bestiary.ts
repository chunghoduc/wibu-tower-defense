/**
 * F9 — Bestiary. Tracks lifetime kills per enemy archetype; crossing thresholds
 * grants a permanent "+% damage vs this archetype" bonus (a damage-research
 * mastery). Loop: Meta (earned in Run). Bartle: Killer/Explorer.
 *
 * The damage bonus is consumed by the battle sim's damage step (applied when the
 * attacker hits an enemy of that archetype). Counts also feed F16 lifetime kills.
 */
import type { EnemyArchetype } from "../data/schema.ts";
import type { HeroSave } from "./save.ts";

/** Kill thresholds and the cumulative damage bonus they unlock (vs that archetype). */
export const BESTIARY_TIERS: { kills: number; bonus: number }[] = [
  { kills: 50, bonus: 0.03 },
  { kills: 250, bonus: 0.06 }, // cumulative +6%
  { kills: 1000, bonus: 0.10 }, // cumulative +10%
];

/** Record one kill of `archetype` and bump the profile lifetime-kill tally. */
export function recordKill(save: HeroSave, archetype: EnemyArchetype): void {
  save.meta.bestiary[archetype] = (save.meta.bestiary[archetype] ?? 0) + 1;
  save.meta.profile.lifetimeKills += 1;
}

/** Kill count recorded for an archetype. */
export function bestiaryKills(save: HeroSave, archetype: EnemyArchetype): number {
  return save.meta.bestiary[archetype] ?? 0;
}

/** Permanent damage multiplier vs `archetype` from bestiary mastery (1.0 = none). */
export function bestiaryDamageMul(save: HeroSave, archetype: EnemyArchetype): number {
  const kills = bestiaryKills(save, archetype);
  let bonus = 0;
  for (const tier of BESTIARY_TIERS) {
    if (kills >= tier.kills) bonus = tier.bonus;
  }
  return 1 + bonus;
}

/** Highest unlocked tier index (0 = none) for an archetype — for UI display. */
export function bestiaryTier(save: HeroSave, archetype: EnemyArchetype): number {
  const kills = bestiaryKills(save, archetype);
  let tier = 0;
  for (let i = 0; i < BESTIARY_TIERS.length; i++) {
    if (kills >= BESTIARY_TIERS[i].kills) tier = i + 1;
  }
  return tier;
}
