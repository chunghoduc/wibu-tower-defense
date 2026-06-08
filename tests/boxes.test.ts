import { describe, expect, it } from "vitest";
import { openBox, tierOfBox, boxOddsText } from "../src/core/boxes.ts";
import { boxIdForTier, boxRarityName, MATERIALS_MAP } from "../src/data/materials.ts";
import { processStageClear } from "../src/core/drops.ts";
import { boxTierForStage } from "../src/data/stage.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

describe("T15 — boss loot boxes", () => {
  it("maps stages to escalating box tiers", () => {
    expect(boxTierForStage("ch1-s1")).toBe(1);
    expect(boxTierForStage("ch1-s2")).toBe(1);
    expect(boxTierForStage("ch1-s3")).toBe(2);
    expect(boxTierForStage("ch1-s10")).toBe(5);
    expect(tierOfBox(boxIdForTier(4))).toBe(4);
  });

  it("a stage clear guarantees a boss chest of the stage's tier", () => {
    const save = createFreshSave();
    const r = processStageClear(save, "ch1-s5", "Normal", new Rng(1));
    const boxId = boxIdForTier(boxTierForStage("ch1-s5"));
    expect(r.materialsDropped[boxId]).toBe(1);
    expect(save.materials[boxId]).toBe(1);
  });

  it("opening a box consumes it and grants crystals + bless jewels", () => {
    const save = createFreshSave();
    const boxId = boxIdForTier(3);
    save.materials[boxId] = 1;
    const crystals0 = save.currency.gold;
    const r = openBox(save, boxId, new Rng(7));
    expect(r.opened).toBe(true);
    expect(save.materials[boxId]).toBe(0);
    expect(r.crystals).toBeGreaterThan(0);
    expect(save.currency.gold).toBe(crystals0 + r.crystals);
    expect((r.materials["bless-jewel"] ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("opening with no box returns opened:false and changes nothing", () => {
    const save = createFreshSave();
    const r = openBox(save, boxIdForTier(1), new Rng(1));
    expect(r.opened).toBe(false);
    expect(save.currency.gold).toBe(0);
  });

  it("higher tiers grant more crystals on average", () => {
    const avg = (tier: number) => {
      let total = 0;
      for (let s = 1; s <= 40; s++) {
        const save = createFreshSave();
        const id = boxIdForTier(tier);
        save.materials[id] = 1;
        total += openBox(save, id, new Rng(s)).crystals;
      }
      return total / 40;
    };
    expect(avg(5)).toBeGreaterThan(avg(1) * 2);
  });

  it("boxOddsText lists guaranteed + chance drops with rate percentages", () => {
    const text = boxOddsText(boxIdForTier(3));
    expect(text).toContain("Opening odds:");
    expect(text).toMatch(/Bless Jewel \(guaranteed\)/);
    expect(text).toMatch(/\d+% Soul Jewel/);
    expect(text).toMatch(/\d+% gear drop \(around lvl \d+\)/);
  });

  it("names each box tier by its rarity and tags the def with that rarity", () => {
    expect(boxRarityName(1)).toBe("Common");
    expect(boxRarityName(5)).toBe("Unique");
    for (let t = 1; t <= 5; t++) {
      const def = MATERIALS_MAP.get(boxIdForTier(t))!;
      expect(def.rarity).toBe(t);
      expect(def.name).toContain(boxRarityName(t));
    }
  });
});
