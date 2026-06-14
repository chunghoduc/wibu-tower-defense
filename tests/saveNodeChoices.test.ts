import { describe, it, expect } from "vitest";
import { createFreshSave, loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("nodeChoices save field", () => {
  it("a fresh save starts with an empty nodeChoices map", () => {
    const save = createFreshSave();
    expect(save.hero.nodeChoices).toEqual({});
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
  });

  it("migrates an old save (no nodeChoices) without crashing and backfills the map", () => {
    const fresh = createFreshSave();
    const legacy = JSON.parse(JSON.stringify(fresh)) as Record<string, any>;
    delete legacy.hero.nodeChoices;
    legacy.version = 11;
    const migrated = loadAndMigrate(legacy);
    expect(migrated.hero.nodeChoices).toEqual({});
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
  });
});
