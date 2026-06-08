/**
 * F11 — Endless Survival. On a cleared stage, waves scale until the player falls;
 * the score is the wave reached. Personal best per stage is saved, and every 5th
 * wave pays a milestone reward. Loop: Run. Bartle: Killer/Achiever — "one more wave."
 *
 * The battle sim reads endlessEnemyMul(wave) to scale spawned enemies. This module
 * owns the curve, the best-wave record, and milestone payouts.
 */
import type { HeroSave } from "./save.ts";
import type { Reward } from "./rewards.ts";
import { AWAKENING_CRYSTAL } from "../data/materials.ts";

/** Enemy stat multiplier at a given endless wave (exponential ramp). */
export function endlessEnemyMul(wave: number): number {
  // +12% compounding per wave — a wall arrives, but gradually.
  return Math.pow(1.12, Math.max(0, wave - 1));
}

export const ENDLESS_MILESTONE_EVERY = 5;

/** Reward for reaching a milestone wave (every ENDLESS_MILESTONE_EVERY waves). */
export function endlessMilestoneReward(wave: number): Reward | null {
  if (wave <= 0 || wave % ENDLESS_MILESTONE_EVERY !== 0) return null;
  const tier = wave / ENDLESS_MILESTONE_EVERY;
  // Diamonds scale with depth; a crystal every 4th milestone (wave 20, 40, …).
  const reward: Reward = { diamonds: 10 + tier * 2 };
  if (tier % 4 === 0) reward.materials = { [AWAKENING_CRYSTAL]: 1 };
  return reward;
}

export function bestEndlessWave(save: HeroSave, stageId: string): number {
  return save.meta.endless.bestWave[stageId] ?? 0;
}

/** Record an endless result; returns true if it's a new personal best. */
export function recordEndlessWave(save: HeroSave, stageId: string, wave: number): boolean {
  if (wave > bestEndlessWave(save, stageId)) {
    save.meta.endless.bestWave[stageId] = wave;
    return true;
  }
  return false;
}
