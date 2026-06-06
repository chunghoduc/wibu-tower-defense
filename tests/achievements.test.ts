import { describe, expect, it } from "vitest";
import { checkAndGrantAchievements, ACHIEVEMENT_UNLOCKS } from "../src/core/achievements.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("ACHIEVEMENT_UNLOCKS", () => {
  it("has at least 2 entries", () => expect(ACHIEVEMENT_UNLOCKS.length).toBeGreaterThanOrEqual(2));
  it("each unlock has rewardCharacterId", () => {
    for (const a of ACHIEVEMENT_UNLOCKS) expect(a.rewardCharacterId.length).toBeGreaterThan(0);
  });
});

describe("checkAndGrantAchievements", () => {
  it("returns empty when no achievements met", () => {
    expect(checkAndGrantAchievements(createFreshSave())).toEqual([]);
  });

  it("grants character for stage-3 clear", () => {
    const save = createFreshSave();
    save.progress.stageClearMap["stage-3"] = { Normal: true, Hard: false, Nightmare: false };
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
    expect(save.collection[granted[0]]).toBeDefined();
  });

  it("does not grant same achievement twice", () => {
    const save = createFreshSave();
    save.progress.stageClearMap["stage-3"] = { Normal: true, Hard: false, Nightmare: false };
    checkAndGrantAchievements(save);
    expect(checkAndGrantAchievements(save)).toHaveLength(0);
  });

  it("grants tower-placement achievement at 50 total placed", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 50;
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
  });
});
