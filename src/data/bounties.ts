/**
 * F3 — Weekly Bounty Board catalog.
 *
 * Bigger targets than dailies, reset each ISO week (Monday). Rewards lean premium
 * (diamonds, Awakening Crystal, Soul jewels). Bounties listen to the same battle
 * events as quests via incrementBountyEvent.
 */
import type { Reward } from "../core/rewards.ts";
import { SOUL_JEWEL, AWAKENING_CRYSTAL, SUMMON_SCROLL } from "./materials.ts";

/** Semantic battle events bounties can track. */
export type BountyEvent = "kill" | "clear" | "summon" | "enhance";

export interface BountyDef {
  id: string;
  event: BountyEvent;
  label: string;
  description: string;
  target: number;
  reward: Reward;
}

export const WEEKLY_BOUNTIES: BountyDef[] = [
  {
    id: "bounty-kills", event: "kill",
    label: "Cull the Horde", description: "Kill 300 enemies this week.",
    target: 300, reward: { diamonds: 40 },
  },
  {
    id: "bounty-clears", event: "clear",
    label: "Campaign Push", description: "Clear 20 stages this week.",
    target: 20, reward: { materials: { [AWAKENING_CRYSTAL]: 1 } },
  },
  {
    id: "bounty-summons", event: "summon",
    label: "Call the Heroes", description: "Summon 20 times this week.",
    target: 20, reward: { diamonds: 60, materials: { [SUMMON_SCROLL]: 2 } },
  },
  {
    id: "bounty-enhance", event: "enhance",
    label: "Master Smith", description: "Enhance items 15 times this week.",
    target: 15, reward: { diamonds: 20, materials: { [SOUL_JEWEL]: 3 } },
  },
];

export const WEEKLY_BOUNTIES_MAP = new Map<string, BountyDef>(WEEKLY_BOUNTIES.map((b) => [b.id, b]));
