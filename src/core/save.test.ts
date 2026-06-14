import { describe, it, expect } from "vitest";
import { loadAndMigrate, CURRENT_SAVE_VERSION } from "./save.ts";

describe("save v12 → v13 expedition reroll fields", () => {
  it("backfills freeRerollsLeft and rerollDay", () => {
    const v12 = {
      version: 12,
      meta: { expedition: { quests: [], lastRerollDay: "", nextQuestSeq: 0 } },
    } as unknown;
    const out = loadAndMigrate(v12);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(CURRENT_SAVE_VERSION).toBe(13);
    expect(out.meta.expedition.freeRerollsLeft).toBe(5);
    expect(out.meta.expedition.rerollDay).toBe("");
  });
});
