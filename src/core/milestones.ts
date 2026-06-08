/**
 * F15 — Milestone core. Resolves lifetime metrics from the save, reports
 * claimable tiers, and pays out tier rewards. The claimed tier per milestone is
 * stored in save.meta.milestones (id → highest claimed tier index, 1-based).
 */
import { MILESTONES, MILESTONES_MAP, type MilestoneMetric } from "../data/milestones.ts";
import { grantReward, type Reward } from "./rewards.ts";
import type { HeroSave } from "./save.ts";

/** Current value of a lifetime metric. */
export function metricValue(save: HeroSave, metric: MilestoneMetric): number {
  switch (metric) {
    case "kills": return save.meta.profile.lifetimeKills;
    case "clears": return save.meta.profile.lifetimeClears;
    case "collection": return Object.keys(save.collection).length;
    case "endless": return Object.values(save.meta.endless.bestWave).reduce((m, w) => Math.max(m, w), 0);
    case "awakened": return Object.values(save.meta.awakening).reduce((s, r) => s + r, 0);
  }
}

/** Highest tier already claimed for a milestone (0 = none). */
export function claimedTier(save: HeroSave, milestoneId: string): number {
  return save.meta.milestones[milestoneId] ?? 0;
}

/** The next unclaimed tier index (1-based) that is currently complete, or 0 if none. */
export function nextClaimableTier(save: HeroSave, milestoneId: string): number {
  const def = MILESTONES_MAP.get(milestoneId);
  if (!def) return 0;
  const claimed = claimedTier(save, milestoneId);
  const value = metricValue(save, def.metric);
  // Claim tiers in order; only the next sequential tier can be claimed.
  if (claimed >= def.tiers.length) return 0;
  return value >= def.tiers[claimed].target ? claimed + 1 : 0;
}

/** Total number of milestone rewards collectable right now (main-menu badge). */
export function claimableMilestoneCount(save: HeroSave): number {
  return MILESTONES.filter((m) => nextClaimableTier(save, m.id) > 0).length;
}

/**
 * Claim the next available tier of a milestone. Returns the reward granted, or
 * null if nothing is claimable. Advances the claimed-tier pointer by one.
 */
export function claimMilestone(save: HeroSave, milestoneId: string): Reward | null {
  const def = MILESTONES_MAP.get(milestoneId);
  if (!def) return null;
  const tier = nextClaimableTier(save, milestoneId);
  if (tier <= 0) return null;
  save.meta.milestones[milestoneId] = tier;
  const reward = def.tiers[tier - 1].reward;
  grantReward(save, reward);
  return reward;
}

/** Titles unlocked via claimed milestone tiers. */
export function unlockedTitles(save: HeroSave): string[] {
  const titles: string[] = [];
  for (const def of MILESTONES) {
    const claimed = claimedTier(save, def.id);
    for (let i = 0; i < claimed; i++) {
      const t = def.tiers[i].title;
      if (t) titles.push(t);
    }
  }
  return titles;
}
