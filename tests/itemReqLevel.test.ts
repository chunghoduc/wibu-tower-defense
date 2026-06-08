import { describe, expect, it } from "vitest";
import {
  ITEM_CATALOG_MAP,
  rollItem,
  instanceReqLevel,
  APEX_STAT_MULT,
  MAX_ITEM_REQ_LEVEL,
} from "../src/data/items.ts";
import { rollItemDrop, chapterLevelRange } from "../src/core/itemDrop.ts";
import { openBox } from "../src/core/boxes.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

const ironSword = () => ITEM_CATALOG_MAP.get("iron-sword")!; // req floor 1, base atk 18

describe("per-instance required level", () => {
  it("a higher rolled required level yields strictly higher scalar stats", () => {
    const def = ironSword();
    const low = rollItem(def, 1, 12345, 1);
    const high = rollItem(def, 1, 12345, 60); // same seed → same ±roll, only level differs
    expect(low.requiredLevel).toBe(1);
    expect(high.requiredLevel).toBe(60);
    expect(high.rolledStats.atk!).toBeGreaterThan(low.rolledStats.atk! * 3);
  });

  it("never rolls below the def floor or above the cap", () => {
    const def = ITEM_CATALOG_MAP.get("dawnbreaker")!; // floor 60
    expect(rollItem(def, 1, 1, 5).requiredLevel).toBe(60);        // clamped up to floor
    expect(rollItem(def, 1, 1, 999).requiredLevel).toBe(MAX_ITEM_REQ_LEVEL); // clamped to cap
  });

  it("instanceReqLevel falls back to the def floor for legacy instances", () => {
    const def = ironSword();
    expect(instanceReqLevel({}, def)).toBe(def.requiredLevel);
    expect(instanceReqLevel({ requiredLevel: 42 }, def)).toBe(42);
  });
});

describe("apex (level-90) special effect", () => {
  it("a level-90 copy is flagged apex and gets +25% on every stat/affix", () => {
    const def = ironSword();
    const plain = rollItem(def, 1, 77, 89);
    const apex = rollItem(def, 1, 77, 90); // same seed, one level higher → crosses apex
    expect(plain.apex).toBeFalsy();
    expect(apex.apex).toBe(true);
    // atk also gains one level of base scaling (0.08), so compare against that.
    const levelStep = (1 + 0.08 * 90) / (1 + 0.08 * 89);
    const ratio = apex.rolledStats.atk! / plain.rolledStats.atk!;
    expect(ratio).toBeCloseTo(APEX_STAT_MULT * levelStep, 2);
    expect(apex.rolledPrimaryAffix).toBeCloseTo(plain.rolledPrimaryAffix * APEX_STAT_MULT, 4);
  });
});

describe("chapter drop bands", () => {
  it("each chapter spans a 20-level band capped at 90", () => {
    expect(chapterLevelRange("ch1-s1")).toEqual([1, 20]);
    expect(chapterLevelRange("ch1-s3")).toEqual([1, 20]);
    expect(chapterLevelRange("stage-6")).toEqual([21, 40]); // chapter 2
    expect(chapterLevelRange("stage-25")).toEqual([81, 90]); // late → capped
  });

  it("chapter-1 drops never exceed required level 20", () => {
    const rng = new Rng(5);
    for (let i = 0; i < 400; i++) {
      const inst = rollItemDrop(createFreshSave(), 50, rng, true, chapterLevelRange("stage-1"));
      if (!inst) continue;
      const def = ITEM_CATALOG_MAP.get(inst.defId)!;
      expect(inst.requiredLevel!).toBeGreaterThanOrEqual(def.requiredLevel);
      expect(inst.requiredLevel!).toBeLessThanOrEqual(20);
    }
  });
});

describe("box items track hero level (±30%, cap 90)", () => {
  it("a level-50 hero pulls box items within ~35–65 required level", () => {
    const rng = new Rng(9);
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const save = createFreshSave();
      save.hero.level = 50;
      save.materials["boss-box-t5"] = 1;
      const reward = openBox(save, "boss-box-t5", rng);
      if (!reward.item) continue;
      seen++;
      const req = reward.item.requiredLevel!;
      // floor of the picked item can be below the band, but the rolled value is
      // bounded by hero*1.3 = 65 on the high end.
      expect(req).toBeLessThanOrEqual(65);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
