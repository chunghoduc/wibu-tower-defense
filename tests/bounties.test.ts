import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  incrementBountyEvent, claimBounty, isBountyClaimable, rolloverBounties, claimableBountyCount,
} from "../src/core/bounties.ts";
import { WEEKLY_BOUNTIES_MAP } from "../src/data/bounties.ts";

const WK = "2026-W24";

describe("F3 weekly bounties", () => {
  it("increments progress for the matching event, capped at target", () => {
    const s = createFreshSave();
    const def = WEEKLY_BOUNTIES_MAP.get("bounty-kills")!;
    incrementBountyEvent(s, "kill", def.target + 50, WK);
    expect(s.meta.bounties.progress["bounty-kills"]).toBe(def.target);
    expect(isBountyClaimable(s, "bounty-kills")).toBe(true);
  });

  it("does not affect bounties of a different event", () => {
    const s = createFreshSave();
    incrementBountyEvent(s, "kill", 10, WK);
    expect(s.meta.bounties.progress["bounty-clears"] ?? 0).toBe(0);
  });

  it("claim grants the reward once, then is no longer claimable", () => {
    const s = createFreshSave();
    const def = WEEKLY_BOUNTIES_MAP.get("bounty-summons")!;
    incrementBountyEvent(s, "summon", def.target, WK);
    const diamonds0 = s.currency.diamonds;
    expect(claimBounty(s, "bounty-summons")).toBe(true);
    expect(s.currency.diamonds).toBe(diamonds0 + (def.reward.diamonds ?? 0));
    expect(claimBounty(s, "bounty-summons")).toBe(false);
  });

  it("claim refuses an incomplete bounty", () => {
    const s = createFreshSave();
    incrementBountyEvent(s, "enhance", 1, WK);
    expect(claimBounty(s, "bounty-enhance")).toBe(false);
  });

  it("rolls over progress when the ISO week changes", () => {
    const s = createFreshSave();
    incrementBountyEvent(s, "kill", 100, WK);
    rolloverBounties(s, "2026-W25");
    expect(s.meta.bounties.progress["bounty-kills"] ?? 0).toBe(0);
    expect(s.meta.bounties.claimed).toEqual([]);
  });

  it("claimableBountyCount reflects completed-unclaimed bounties", () => {
    const s = createFreshSave();
    incrementBountyEvent(s, "kill", 9999, WK);
    expect(claimableBountyCount(s)).toBe(1);
  });
});
