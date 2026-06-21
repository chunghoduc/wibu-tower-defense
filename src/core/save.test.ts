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
    expect(out.meta.expedition.freeRerollsLeft).toBe(5);
    expect(out.meta.expedition.rerollDay).toBe("");
  });
});

describe("save v13 → v14 expedition dispatch cap", () => {
  it("bumps to v14 and backfills the daily dispatch allowance", () => {
    const v13 = {
      version: 13,
      meta: {
        expedition: {
          quests: [],
          lastRerollDay: "",
          nextQuestSeq: 0,
          freeRerollsLeft: 5,
          rerollDay: "",
        },
      },
    } as unknown;
    const out = loadAndMigrate(v13);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(out.meta.expedition.dispatchesLeft).toBe(5);
    expect(out.meta.expedition.dispatchDay).toBe("");
  });
});

describe("save v14 → v15 Pants slot", () => {
  it("adds the Pants slot without disturbing the equipped loadout (slot starts empty)", () => {
    const v14 = {
      version: 14,
      inventory: { items: [], equipped: { Weapon: "w1", Boots: "b1" } },
    } as unknown;
    const out = loadAndMigrate(v14);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(out.inventory.equipped.Weapon).toBe("w1");
    expect(out.inventory.equipped.Pants).toBeUndefined();
  });
});

describe("save v15 → v16 per-box levels", () => {
  it("stubs in an empty boxLevels map while keeping existing box counts", () => {
    const v15 = {
      version: 15,
      materials: { "boss-box-t3": 2 },
    } as unknown;
    const out = loadAndMigrate(v15);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(out.boxLevels).toEqual({}); // no per-box level recorded yet
    expect(out.materials["boss-box-t3"]).toBe(2); // counts untouched
  });
});
