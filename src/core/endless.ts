/**
 * F11 — Endless Survival. On a cleared stage you fight an UNBOUNDED stream of
 * procedurally-generated waves whose enemies compound in strength every wave, so
 * the run is mathematically un-winnable in the limit — the score is the wave you
 * fall on. Every {@link ENDLESS_BOSS_EVERY}th wave is a boss wave that drops a
 * loot chest; every {@link ENDLESS_MILESTONE_EVERY}th wave pays gems. Personal
 * best per stage is saved and rewards are granted only for newly-reached depth
 * (farm-resistant, mirroring boss rush). Loop: Run. Bartle: Killer/Achiever —
 * "one more wave."
 *
 * The battle sim (battleWaves.ts) reads {@link endlessEnemyMul}(wave) to scale
 * each spawned enemy and {@link endlessWave}(wave) to schedule the next wave.
 * This module owns the curve, the wave generator, the best-wave record and payouts.
 */
import type { HeroSave } from "./save.ts";
import { type Reward, grantReward } from "./rewards.ts";
import { AWAKENING_CRYSTAL, boxIdForTier } from "../data/materials.ts";
import { BOSS_BY_STAGE } from "../data/stage.ts";
import type { SpawnEntry, WaveDef } from "../data/schema.ts";

/** Enemy stat multiplier at a given endless wave (exponential ramp). */
export function endlessEnemyMul(wave: number): number {
  // +12% compounding per wave — a wall always arrives, but gradually. Exponential
  // (not linear) is what guarantees eventual impossibility no matter how strong the
  // squad: player power grows polynomially with investment, enemy HP grows geometrically.
  return Math.pow(1.12, Math.max(0, wave - 1));
}

export const ENDLESS_MILESTONE_EVERY = 5;
export const ENDLESS_BOSS_EVERY = 10;

/** Reward for reaching a single milestone wave (every ENDLESS_MILESTONE_EVERY waves). */
export function endlessMilestoneReward(wave: number): Reward | null {
  if (wave <= 0 || wave % ENDLESS_MILESTONE_EVERY !== 0) return null;
  const tier = wave / ENDLESS_MILESTONE_EVERY;
  // Diamonds scale with depth; a crystal every 4th milestone (wave 20, 40, …).
  const reward: Reward = { diamonds: 10 + tier * 2 };
  if (tier % 4 === 0) reward.materials = { [AWAKENING_CRYSTAL]: 1 };
  return reward;
}

/** True when `wave` is a boss wave (a boss appears and a chest drops on clear). */
export function isEndlessBossWave(wave: number): boolean {
  return wave > 0 && wave % ENDLESS_BOSS_EVERY === 0;
}

/** Boss id for an endless boss wave — rotates the campaign roster as depth climbs. */
export function endlessBossId(wave: number): string {
  const n = Math.floor(wave / ENDLESS_BOSS_EVERY) - 1; // wave 10 → index 0
  return BOSS_BY_STAGE[((n % BOSS_BY_STAGE.length) + BOSS_BY_STAGE.length) % BOSS_BY_STAGE.length];
}

/** Boss-chest tier (1..5) dropped by the boss wave at `wave` — deeper = better. */
export function endlessBoxTier(wave: number): number {
  return Math.max(1, Math.min(5, Math.ceil(wave / 20)));
}

const sp = (enemyId: string, count: number, interval: number, delay: number): SpawnEntry => ({
  enemyId,
  count,
  interval,
  delay,
});
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));

/**
 * Procedurally build the spawn schedule for endless wave `wave` (1-based).
 *
 * Counts grow linearly (and are capped, so the entity budget stays sane — the
 * exponential {@link endlessEnemyMul} carries the real difficulty, not raw numbers).
 * The archetype mix deepens with the wave: fodder first, then flyers, bruisers,
 * stealth, immune walls and priority-kill supports. Every 10th wave is a boss wave.
 */
export function endlessWave(wave: number): WaveDef {
  if (isEndlessBossWave(wave)) {
    const bn = wave / ENDLESS_BOSS_EVERY; // boss number: 1,2,3,…
    const spawns: SpawnEntry[] = [
      sp("grunt", clamp(6 + bn * 2, 6, 20), 0.5, 0),
      sp("brute", clamp(2 + bn, 2, 8), 1.2, 2),
    ];
    if (wave >= 30) spawns.push(sp("stormflyer", clamp(1 + bn / 2, 1, 5), 1.2, 3));
    // Co-bosses arrive every 5th boss wave (wave 50, 100, …) to break stalls.
    spawns.push(sp(endlessBossId(wave), 1 + Math.floor(bn / 5), 3, 6));
    return { spawns };
  }

  const spawns: SpawnEntry[] = [];
  // Fodder spine — alternates grunt/runner, tightens cadence past wave 10.
  spawns.push(sp(wave % 2 ? "grunt" : "runner", clamp(6 + wave, 6, 40), wave >= 10 ? 0.4 : 0.6, 0));
  if (wave >= 2) spawns.push(sp("gargoyle", clamp(1 + wave / 4, 1, 10), 1.0, 2)); // flyers
  if (wave >= 3)
    spawns.push(
      sp(["brute", "bulwark", "slime", "raider"][wave % 4], clamp(2 + wave / 3, 2, 14), 0.9, 1),
    );
  if (wave >= 5) spawns.push(sp("phantom", clamp(wave / 4, 1, 8), 1.1, 3)); // stealth
  if (wave >= 6)
    spawns.push(sp(wave % 2 ? "golem" : "monolith", clamp(1 + wave / 8, 1, 5), 2.0, 4)); // immune walls
  if (wave >= 7) spawns.push(sp(["herald", "mender", "summoner", "hexer"][wave % 4], 1, 1, 5)); // priority-kill support
  if (wave >= 8) spawns.push(sp("regenerator", clamp(wave / 6, 1, 6), 1.5, 3));
  return { spawns };
}

/**
 * Cumulative reward for clearing endless waves in the band (fromExclusive, toInclusive]
 * — milestone gems every 5 + a depth-scaled boss chest every 10. Granting only the
 * *new* band (vs the player's prior best) keeps the mode from being farmed.
 */
export function endlessRunReward(fromExclusive: number, toInclusive: number): Reward {
  const reward: Reward = {};
  const addGems = (n: number) => {
    reward.diamonds = (reward.diamonds ?? 0) + n;
  };
  const addMat = (id: string, n: number) => {
    (reward.materials ??= {})[id] = (reward.materials[id] ?? 0) + n;
  };
  for (let w = Math.max(1, Math.floor(fromExclusive) + 1); w <= toInclusive; w++) {
    const m = endlessMilestoneReward(w);
    if (m) {
      if (m.diamonds) addGems(m.diamonds);
      if (m.materials) for (const [id, n] of Object.entries(m.materials)) addMat(id, n);
    }
    if (isEndlessBossWave(w)) addMat(boxIdForTier(endlessBoxTier(w)), 1);
  }
  return reward;
}

export function bestEndlessWave(save: HeroSave, stageId: string): number {
  return save.meta.endless.bestWave[stageId] ?? 0;
}

// ── Entry cost ───────────────────────────────────────────────────────────────
// Endless pays diamonds + chests, never gold, so it is a pure gold *sink* funded
// by campaign/expedition/login income. The fee scales with your best wave so it
// stays *felt* at every tier (a flat fee is pocket change to a deep, gold-rich
// player and the sink dies). Linear — not exponential — because the reward is
// already farm-resistant; exploding the cost too would double-punish the grind.
export const ENDLESS_ENTRY_BASE = 150; // cheap first taste (best 0)
export const ENDLESS_ENTRY_PER_WAVE = 35; // ≈ one Nightmare clear (1000g) at best 20
export const ENDLESS_ENTRY_CAP = 4000; // anti-lockout: never wall a player out of unlocked content

/** Gold to start an endless run, scaled to the player's best wave (round-10, capped). */
export function endlessEntryCost(bestWave: number): number {
  const raw = ENDLESS_ENTRY_BASE + ENDLESS_ENTRY_PER_WAVE * Math.max(0, bestWave);
  return Math.min(ENDLESS_ENTRY_CAP, Math.round(raw / 10) * 10);
}

/** Spend the entry fee for an endless run on `stageId`. Returns the gold paid, or -1 if unaffordable. */
export function payEndlessEntry(save: HeroSave, stageId: string): number {
  const cost = endlessEntryCost(bestEndlessWave(save, stageId));
  if (save.currency.gold < cost) return -1;
  save.currency.gold -= cost;
  return cost;
}

/** Record an endless result; returns true if it's a new personal best. */
export function recordEndlessWave(save: HeroSave, stageId: string, wave: number): boolean {
  if (wave > bestEndlessWave(save, stageId)) {
    save.meta.endless.bestWave[stageId] = wave;
    return true;
  }
  return false;
}

/**
 * Settle an endless run: grant rewards for any depth newly reached beyond the
 * player's prior best on this stage, record the new best, and return what was paid.
 */
export function claimEndlessRun(
  save: HeroSave,
  stageId: string,
  wavesReached: number,
): { reward: Reward; isBest: boolean } {
  const prev = bestEndlessWave(save, stageId);
  if (wavesReached <= prev) return { reward: {}, isBest: false };
  const reward = endlessRunReward(prev, wavesReached);
  grantReward(save, reward);
  save.meta.endless.bestWave[stageId] = wavesReached;
  return { reward, isBest: true };
}
