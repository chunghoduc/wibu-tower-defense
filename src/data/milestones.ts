/**
 * F15 — Milestone achievements (tiered). A broad completion track over lifetime
 * metrics; each milestone has tiers (I/II/III) granting rewards and, sometimes, a
 * cosmetic title (F16). Loop: Meta. Bartle: Achiever — the long-term goal engine.
 *
 * Metric values are resolved in core/milestones.ts (which can read the save); the
 * data here is pure: which metric, the tier targets, and the rewards/titles.
 */
import type { Reward } from "../core/rewards.ts";
import { AWAKENING_CRYSTAL, SUMMON_SCROLL } from "./materials.ts";

/** Lifetime metric a milestone tracks. Resolved by core/milestones.ts. */
export type MilestoneMetric = "kills" | "clears" | "collection" | "endless" | "awakened";

export interface MilestoneTier {
  target: number;
  reward: Reward;
  /** Optional title unlocked at this tier (equippable on the profile). */
  title?: string;
}

export interface MilestoneDef {
  id: string;
  name: string;
  metric: MilestoneMetric;
  description: string;
  tiers: MilestoneTier[]; // ascending targets
}

export const MILESTONES: MilestoneDef[] = [
  {
    id: "slayer", name: "Slayer", metric: "kills", description: "Defeat enemies across all battles.",
    tiers: [
      { target: 500, reward: { diamonds: 20 } },
      { target: 5000, reward: { diamonds: 50 }, title: "the Relentless" },
      { target: 25000, reward: { diamonds: 100, materials: { [AWAKENING_CRYSTAL]: 2 } }, title: "Worldender" },
    ],
  },
  {
    id: "conqueror", name: "Conqueror", metric: "clears", description: "Clear stages on any difficulty.",
    tiers: [
      { target: 25, reward: { diamonds: 20 } },
      { target: 100, reward: { diamonds: 50 }, title: "Conqueror" },
      { target: 300, reward: { diamonds: 120, materials: { [SUMMON_SCROLL]: 3 } }, title: "Grand Marshal" },
    ],
  },
  {
    id: "collector", name: "Collector", metric: "collection", description: "Recruit unique heroes.",
    tiers: [
      { target: 10, reward: { diamonds: 30 } },
      { target: 20, reward: { diamonds: 60 }, title: "Curator" },
      { target: 32, reward: { diamonds: 160, materials: { [AWAKENING_CRYSTAL]: 3 } }, title: "Completionist" },
    ],
  },
  {
    id: "survivor", name: "Survivor", metric: "endless", description: "Reach deep endless waves.",
    tiers: [
      { target: 10, reward: { diamonds: 25 } },
      { target: 25, reward: { diamonds: 60 }, title: "the Unyielding" },
      { target: 50, reward: { diamonds: 150, materials: { [AWAKENING_CRYSTAL]: 2 } }, title: "Eternal" },
    ],
  },
  {
    id: "ascendant", name: "Ascendant", metric: "awakened", description: "Awaken your heroes' true potential.",
    tiers: [
      { target: 1, reward: { diamonds: 30 } },
      { target: 5, reward: { diamonds: 80 }, title: "Awakener" },
      { target: 12, reward: { diamonds: 200 }, title: "Ascendant" },
    ],
  },
];

export const MILESTONES_MAP = new Map<string, MilestoneDef>(MILESTONES.map((m) => [m.id, m]));

/** Every title that exists in the milestone tree (for the profile title picker). */
export const ALL_MILESTONE_TITLES: { id: string; from: string }[] = MILESTONES.flatMap((m) =>
  m.tiers.filter((t) => t.title).map((t) => ({ id: t.title!, from: m.id })),
);
