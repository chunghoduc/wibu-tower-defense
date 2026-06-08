/**
 * Shared reward bundle + granter. Many addictive-feature systems (streak, spin,
 * bounties, challenge, endless, boss rush, milestones) hand out the same kinds of
 * loot, so they all express it as a Reward and grant it through one funnel.
 */
import type { HeroSave } from "./save.ts";
import { MATERIALS_MAP } from "../data/materials.ts";

export interface Reward {
  gold?: number;
  diamonds?: number;
  /** materialId → count. */
  materials?: Record<string, number>;
  /** Free summon scrolls is just a material; kept here for readability when needed. */
}

/** Apply a reward bundle to the save (mutates currency/materials). */
export function grantReward(save: HeroSave, reward: Reward): void {
  if (reward.gold) save.currency.gold += reward.gold;
  if (reward.diamonds) save.currency.diamonds += reward.diamonds;
  if (reward.materials) {
    for (const [id, n] of Object.entries(reward.materials)) {
      if (!n) continue;
      save.materials[id] = (save.materials[id] ?? 0) + n;
    }
  }
}

/** True if a reward grants nothing (used to guard "did anything happen"). */
export function isEmptyReward(reward: Reward): boolean {
  if (reward.gold || reward.diamonds) return false;
  if (reward.materials && Object.values(reward.materials).some((n) => n > 0)) return false;
  return true;
}

/** Short human-readable summary (`+300 🪙  ·  +2 Jewel of Soul`). */
export function rewardLabel(reward: Reward): string {
  const parts: string[] = [];
  if (reward.gold) parts.push(`+${reward.gold} 🪙`);
  if (reward.diamonds) parts.push(`+${reward.diamonds} 💎`);
  if (reward.materials) {
    for (const [id, n] of Object.entries(reward.materials)) {
      if (!n) continue;
      const name = MATERIALS_MAP.get(id)?.name ?? id;
      parts.push(`+${n} ${name}`);
    }
  }
  return parts.join("  ·  ");
}
