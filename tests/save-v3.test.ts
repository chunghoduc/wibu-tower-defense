import { describe, expect, it } from "vitest";
import { createFreshSave, loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("HeroSave v3", () => {
  it("CURRENT_SAVE_VERSION is 4", () => {
    expect(CURRENT_SAVE_VERSION).toBe(4);
  });

  it("createFreshSave has currency with 0 crystals", () => {
    const save = createFreshSave();
    expect(save.currency.crystals).toBe(0);
    expect(save.currency.pityCount).toBe(0);
    expect(save.currency.lastDailyLoginDate).toBe("");
  });

  it("createFreshSave has empty progress", () => {
    const save = createFreshSave();
    expect(Object.keys(save.progress.stageClearMap)).toHaveLength(0);
    expect(Object.keys(save.progress.achievementFlags)).toHaveLength(0);
    expect(save.progress.totalTowersPlaced).toBe(0);
  });

  it("migrate v1 to v3 (two hops)", () => {
    const v1: any = {
      version: 1,
      heroId: "h1",
      hero: { level: 1, totalXp: 0, skillPoints: 0, unlockedNodes: [], obtainedSkills: [], equippedSkillId: null },
      inventory: { items: [], equipped: {} },
      lastSavedAt: 0,
    };
    const migrated = loadAndMigrate(v1);
    expect(migrated.version).toBe(4);
    expect(migrated.collection).toEqual({});
    expect(migrated.currency.crystals).toBe(0);
    expect(migrated.progress.totalTowersPlaced).toBe(0);
  });

  it("migrate v2 to v3 preserves collection", () => {
    const v2: any = {
      version: 2,
      heroId: "h2",
      hero: { level: 10, totalXp: 5000, skillPoints: 9, unlockedNodes: [], obtainedSkills: [], equippedSkillId: null },
      inventory: { items: [], equipped: {} },
      collection: { "zoran-thricedraw": { stars: 3 } },
      lastSavedAt: 0,
    };
    const migrated = loadAndMigrate(v2);
    expect(migrated.version).toBe(4);
    expect(migrated.collection["zoran-thricedraw"].stars).toBe(3);
    expect(migrated.currency.crystals).toBe(0);
  });
});
