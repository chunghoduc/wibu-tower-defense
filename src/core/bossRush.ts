/**
 * F12 — Boss Rush / Trial of Champions (weekly). A gauntlet of bosses back to
 * back; the furthest tier reached sets a weekly rank with escalating rewards.
 * Loop: Run. Bartle: Killer — a high-skill sink for a maxed roster.
 *
 * This module owns the weekly best-tier record and the tier reward table; the
 * battle wiring drives sequential boss waves and reports the tier reached.
 */
import type { HeroSave } from "./save.ts";
import { grantReward, type Reward } from "./rewards.ts";
import { AWAKENING_CRYSTAL, SUMMON_SCROLL } from "../data/materials.ts";
import { BOSS_BY_STAGE } from "../data/stage.ts";
import type { SpawnEntry, WaveDef } from "../data/schema.ts";

/** Number of bosses in the gauntlet. */
export const BOSS_RUSH_TIERS = 6;

/**
 * Spawn schedule for boss-rush tier `tier` (1-based, 1..BOSS_RUSH_TIERS). Each
 * tier is one boss pulled from the campaign roster — climbing the roster so the
 * gauntlet escalates — fronted by a little brute fodder to pressure the lane,
 * with a co-boss joining the back tiers. The run is otherwise a normal sim, so
 * difficulty + endlessMul + progression scaling stack on top of these spawns.
 *
 * This is the real gauntlet: clearing tier N means defeating N bosses, so the
 * reported tier (bosses defeated) maps 1:1 onto {@link bossRushReward} — you
 * cannot earn the top prize without actually beating all {@link BOSS_RUSH_TIERS}.
 */
export function bossRushWave(tier: number): WaveDef {
  const t = Math.max(1, Math.min(BOSS_RUSH_TIERS, Math.floor(tier)));
  const bossId = BOSS_BY_STAGE[(t - 1) % BOSS_BY_STAGE.length];
  const spawns: SpawnEntry[] = [
    { enemyId: "brute", count: Math.min(2 + t, 8), interval: 1.0, delay: 0 },
    { enemyId: bossId, count: 1 + Math.floor((t - 1) / 3), interval: 4, delay: 2 },
  ];
  return { spawns };
}

/** Cumulative reward for *reaching* a given tier (claimed once per week, highest). */
export function bossRushReward(tier: number): Reward {
  const t = Math.max(0, Math.min(BOSS_RUSH_TIERS, tier));
  const reward: Reward = { diamonds: t * 15 };
  if (t >= 3) reward.materials = { [SUMMON_SCROLL]: 1 };
  if (t >= BOSS_RUSH_TIERS) reward.materials = { [AWAKENING_CRYSTAL]: 2, [SUMMON_SCROLL]: 2 };
  return reward;
}

/** Reset the weekly best-tier when the ISO week changes. */
export function rolloverBossRush(save: HeroSave, weekKey: string): void {
  if (save.meta.bossRush.weekKey === weekKey) return;
  save.meta.bossRush.weekKey = weekKey;
  save.meta.bossRush.bestTier = 0;
}

export function bestBossRushTier(save: HeroSave): number {
  return save.meta.bossRush.bestTier;
}

/**
 * Record a boss-rush result for the current week. Returns the *additional* reward
 * earned for any newly-reached tiers (empty if no improvement), granting it.
 * Rolls the week over first.
 */
export function recordBossRushTier(save: HeroSave, weekKey: string, tier: number): Reward {
  rolloverBossRush(save, weekKey);
  const prev = save.meta.bossRush.bestTier;
  if (tier <= prev) return {};
  save.meta.bossRush.bestTier = Math.min(BOSS_RUSH_TIERS, tier);
  // Difference between the new cumulative reward and the previously-earned one.
  const before = bossRushReward(prev);
  const after = bossRushReward(save.meta.bossRush.bestTier);
  const diff = diffReward(before, after);
  grantReward(save, diff);
  return diff;
}

/** after − before for each reward field (clamped at 0). */
function diffReward(before: Reward, after: Reward): Reward {
  const out: Reward = {};
  const g = (after.diamonds ?? 0) - (before.diamonds ?? 0);
  if (g > 0) out.diamonds = g;
  const gold = (after.gold ?? 0) - (before.gold ?? 0);
  if (gold > 0) out.gold = gold;
  const mats: Record<string, number> = {};
  const ids = new Set([...Object.keys(before.materials ?? {}), ...Object.keys(after.materials ?? {})]);
  for (const id of ids) {
    const d = (after.materials?.[id] ?? 0) - (before.materials?.[id] ?? 0);
    if (d > 0) mats[id] = d;
  }
  if (Object.keys(mats).length) out.materials = mats;
  return out;
}
