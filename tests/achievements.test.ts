import { describe, expect, it } from "vitest";
import { checkAndGrantAchievements } from "../src/core/achievements.ts";
import { ACHIEVEMENTS } from "../src/data/achievements.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("checkAndGrantAchievements", () => {
  it("returns empty when no achievements met", () => {
    expect(checkAndGrantAchievements(createFreshSave())).toEqual([]);
  });

  it("grants the legacy tower for a stage-3 clear", () => {
    const save = createFreshSave();
    save.progress.stageClearMap["stage-3"] = { Normal: true, Hard: false, Nightmare: false };
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
    expect(save.collection["tobi-skipstone"]).toBeDefined();
    expect(save.progress.achievementFlags["clear-stage-3"]).toBe(true);
  });

  it("does not grant the same achievement twice", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 50;
    checkAndGrantAchievements(save);
    expect(checkAndGrantAchievements(save)).toHaveLength(0);
  });

  it("grants a resource bundle achievement and applies the reward", () => {
    const save = createFreshSave();
    const goldBefore = save.currency.gold;
    save.hero.level = 10; // unlocks hero-level-10 → +2000 gold
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
    expect(save.currency.gold).toBe(goldBefore + 2000);
    expect(save.progress.achievementFlags["hero-level-10"]).toBe(true);
  });

  it("covers the deterministic catalog ids with a flag once unlocked", () => {
    const save = createFreshSave();
    save.hero.level = 50;
    save.meta.profile.lifetimeKills = 100000;
    save.meta.endless.bestWave["endless"] = 50;
    save.progress.totalTowersPlaced = 5000;
    for (const id of ["stage-3", "stage-10", "stage-20"]) {
      save.progress.stageClearMap[id] = { Normal: true, Hard: false, Nightmare: true };
    }
    checkAndGrantAchievements(save);
    for (const id of [
      "clear-stage-3",
      "hero-level-50",
      "kills-100000",
      "endless-wave-50",
      "place-5000-towers",
      "win-nightmare",
    ]) {
      expect(save.progress.achievementFlags[id]).toBe(true);
    }
    expect(ACHIEVEMENTS.length).toBe(20);
  });
});
