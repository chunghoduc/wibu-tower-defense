import { describe, it, expect } from "vitest";
import { loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("expedition save migration v10→v11", () => {
  it("bumps a legacy idle-expedition save to a fresh empty board", () => {
    const legacy = {
      version: 10,
      meta: {
        expedition: { startedAt: 123, towerIds: ["a", "b"], lastCollectAt: 99 },
      },
    };
    const save = loadAndMigrate(legacy);
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    expect(save.meta.expedition.quests).toEqual([]);
    expect(save.meta.expedition.lastRerollDay).toBe("");
    expect(save.meta.expedition.nextQuestSeq).toBe(0);
  });

  it("a fresh save already has the board shape", () => {
    const save = loadAndMigrate(undefined);
    expect(Array.isArray(save.meta.expedition.quests)).toBe(true);
    expect(save.meta.expedition.nextQuestSeq).toBe(0);
  });
});
