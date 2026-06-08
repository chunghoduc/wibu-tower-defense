/**
 * F3 — Weekly Bounty tracker. Mirrors questTracker but on an ISO-week cadence.
 * incrementBountyEvent is called from the same battle event sites as quests.
 */
import { WEEKLY_BOUNTIES, WEEKLY_BOUNTIES_MAP, type BountyEvent } from "../data/bounties.ts";
import { grantReward } from "./rewards.ts";
import type { HeroSave } from "./save.ts";

/** Reset bounty progress/claims when the ISO week changes. No-op same week. */
export function rolloverBounties(save: HeroSave, weekKey: string): void {
  if (save.meta.bounties.weekKey === weekKey) return;
  save.meta.bounties.weekKey = weekKey;
  save.meta.bounties.progress = {};
  save.meta.bounties.claimed = [];
}

export function getBountyProgress(save: HeroSave, bountyId: string): number {
  return save.meta.bounties.progress[bountyId] ?? 0;
}

export function isBountyClaimable(save: HeroSave, bountyId: string): boolean {
  const def = WEEKLY_BOUNTIES_MAP.get(bountyId);
  if (!def) return false;
  return (save.meta.bounties.progress[bountyId] ?? 0) >= def.target && !save.meta.bounties.claimed.includes(bountyId);
}

/** How many bounty rewards are collectable right now (main-menu badge). */
export function claimableBountyCount(save: HeroSave): number {
  return WEEKLY_BOUNTIES.filter((b) => isBountyClaimable(save, b.id)).length;
}

/**
 * Advance every bounty listening to `event` by `amount`, rolling the week over
 * first if needed. Progress is capped at each bounty's target.
 */
export function incrementBountyEvent(save: HeroSave, event: BountyEvent, amount: number, weekKey: string): void {
  rolloverBounties(save, weekKey);
  for (const def of WEEKLY_BOUNTIES) {
    if (def.event !== event) continue;
    const current = save.meta.bounties.progress[def.id] ?? 0;
    save.meta.bounties.progress[def.id] = Math.min(def.target, current + amount);
  }
}

/** Claim a completed bounty. Returns false if incomplete or already claimed. */
export function claimBounty(save: HeroSave, bountyId: string): boolean {
  const def = WEEKLY_BOUNTIES_MAP.get(bountyId);
  if (!def) return false;
  if ((save.meta.bounties.progress[bountyId] ?? 0) < def.target) return false;
  if (save.meta.bounties.claimed.includes(bountyId)) return false;
  save.meta.bounties.claimed.push(bountyId);
  grantReward(save, def.reward);
  return true;
}
