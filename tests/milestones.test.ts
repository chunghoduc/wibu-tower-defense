import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  metricValue,
  nextClaimableTier,
  claimMilestone,
  claimedTier,
  unlockedTitles,
  claimableMilestoneCount,
} from "../src/core/milestones.ts";
import { MILESTONES_MAP } from "../src/data/milestones.ts";

describe("F15 milestones", () => {
  it("resolves lifetime metrics from the save", () => {
    const s = createFreshSave();
    s.meta.profile.lifetimeKills = 600;
    expect(metricValue(s, "kills")).toBe(600);
    s.collection = { a: { stars: 1, copies: 0 }, b: { stars: 1, copies: 0 } };
    expect(metricValue(s, "collection")).toBe(2);
  });

  it("claims tiers sequentially as targets are met", () => {
    const s = createFreshSave();
    const def = MILESTONES_MAP.get("slayer")!;
    s.meta.profile.lifetimeKills = def.tiers[0].target;
    expect(nextClaimableTier(s, "slayer")).toBe(1);
    const r1 = claimMilestone(s, "slayer");
    expect(r1).not.toBeNull();
    expect(claimedTier(s, "slayer")).toBe(1);
    // Tier 2 not yet reachable.
    expect(nextClaimableTier(s, "slayer")).toBe(0);
    expect(claimMilestone(s, "slayer")).toBeNull();
  });

  it("only the next sequential tier is claimable even if a higher target is met", () => {
    const s = createFreshSave();
    const def = MILESTONES_MAP.get("slayer")!;
    s.meta.profile.lifetimeKills = def.tiers[2].target; // meets all three
    expect(nextClaimableTier(s, "slayer")).toBe(1);
    claimMilestone(s, "slayer");
    expect(nextClaimableTier(s, "slayer")).toBe(2);
  });

  it("claiming a titled tier unlocks the title", () => {
    const s = createFreshSave();
    const def = MILESTONES_MAP.get("conqueror")!;
    s.meta.profile.lifetimeClears = def.tiers[1].target;
    claimMilestone(s, "conqueror"); // tier 1
    claimMilestone(s, "conqueror"); // tier 2 (has title)
    expect(unlockedTitles(s)).toContain(def.tiers[1].title);
  });

  it("claimableMilestoneCount counts ready milestones", () => {
    const s = createFreshSave();
    s.meta.profile.lifetimeKills = 999999;
    s.meta.profile.lifetimeClears = 999999;
    expect(claimableMilestoneCount(s)).toBeGreaterThanOrEqual(2);
  });
});
