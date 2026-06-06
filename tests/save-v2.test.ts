import { describe, expect, it } from "vitest";
import { createFreshSave, loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("HeroSave v2 — collection field", () => {
  it("createFreshSave has empty collection", () => {
    const save = createFreshSave();
    expect(save.collection).toBeDefined();
    expect(Object.keys(save.collection)).toHaveLength(0);
  });

  it("CURRENT_SAVE_VERSION is at least 2", () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(2);
  });

  it("migrate v1 (no collection) to v2 adds empty collection", () => {
    const v1: any = {
      version: 1,
      heroId: "h1",
      hero: { level: 5, totalXp: 1000, skillPoints: 4, unlockedNodes: [], obtainedSkills: [], equippedSkillId: null },
      inventory: { items: [], equipped: {} },
      lastSavedAt: 0,
    };
    const migrated = loadAndMigrate(v1);
    expect(migrated.version).toBeGreaterThanOrEqual(2);
    expect(migrated.collection).toEqual({});
    expect(migrated.hero.level).toBe(5);
  });
});
