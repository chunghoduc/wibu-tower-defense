import { describe, expect, it } from "vitest";
import { createFreshSave, loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("save v6 — jewels", () => {
  it("CURRENT_SAVE_VERSION is at least 6", () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(6);
  });

  it("a fresh save has empty jewel inventory + sockets", () => {
    const s = createFreshSave();
    expect(s.hero.jewels).toEqual([]);
    expect(s.hero.socketedJewels).toEqual({});
  });

  it("migrates a v5 save by backfilling jewels + socketedJewels", () => {
    const v5 = {
      ...createFreshSave(),
      version: 5,
    };
    // Simulate a pre-jewel save: strip the new fields.
    delete (v5.hero as unknown as Record<string, unknown>).jewels;
    delete (v5.hero as unknown as Record<string, unknown>).socketedJewels;

    const migrated = loadAndMigrate(v5);
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.hero.jewels).toEqual([]);
    expect(migrated.hero.socketedJewels).toEqual({});
  });

  it("preserves existing jewels through a re-migration", () => {
    const s = createFreshSave();
    s.hero.jewels = [{ id: "j1", defId: "crimson-shard" }];
    s.hero.socketedJewels = { "brawler-jewel-1": "j1" };
    const migrated = loadAndMigrate(s);
    expect(migrated.hero.jewels).toEqual([{ id: "j1", defId: "crimson-shard" }]);
    expect(migrated.hero.socketedJewels).toEqual({ "brawler-jewel-1": "j1" });
  });
});
