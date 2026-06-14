import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  CATEGORY_ORDER,
  achievementRewardLabel,
} from "../src/data/achievements.ts";
import { isEmptyReward } from "../src/core/rewards.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("ACHIEVEMENTS catalog", () => {
  it("has 20 achievements", () => {
    expect(ACHIEVEMENTS).toHaveLength(20);
  });

  it("has unique ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every achievement is well-formed", () => {
    const save = createFreshSave();
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(CATEGORY_ORDER).toContain(a.category);
      const p = a.progress(save);
      expect(p.target).toBeGreaterThan(0);
      expect(p.current).toBeGreaterThanOrEqual(0);
      // a reward must give something: a bundle or a tower.
      expect(isEmptyReward(a.reward) && !a.reward.characterId).toBe(false);
    }
  });

  it("preserves the two legacy tower achievements", () => {
    const legacy = ACHIEVEMENTS.filter((a) => a.reward.characterId);
    expect(legacy.map((a) => a.id).sort()).toEqual(
      ["clear-stage-3", "place-50-towers"].sort(),
    );
  });

  it("progress reflects save state for place-50-towers", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 30;
    const def = ACHIEVEMENTS.find((a) => a.id === "place-50-towers")!;
    expect(def.progress(save)).toEqual({ current: 30, target: 50 });
  });

  it("achievementRewardLabel renders tower and bundle rewards", () => {
    expect(achievementRewardLabel({ characterId: "tobi-skipstone" })).toContain("Hero");
    expect(achievementRewardLabel({ gold: 500 })).toContain("500");
  });
});
