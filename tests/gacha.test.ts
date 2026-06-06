import { describe, expect, it } from "vitest";
import {
  performSummon,
  performMultiSummon,
  canAffordSummon,
  SINGLE_PULL_COST,
  MULTI_PULL_COST,
  HARD_PITY,
} from "../src/core/gacha.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";
import { TOWERS } from "../src/data/towers.ts";

describe("canAffordSummon", () => {
  it("returns false when crystals < single pull cost", () => {
    const save = createFreshSave();
    save.currency.crystals = 0;
    expect(canAffordSummon(save, 1)).toBe(false);
  });
  it("returns true when crystals >= single pull cost", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    expect(canAffordSummon(save, 1)).toBe(true);
  });
});

describe("performSummon", () => {
  it("deducts crystal cost", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    performSummon(save, new Rng(1));
    expect(save.currency.crystals).toBe(0);
  });

  it("returns a valid characterId from the catalog", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 100;
    const catalogIds = new Set(TOWERS.map((t) => t.id));
    for (let i = 0; i < 50; i++) {
      const result = performSummon(save, new Rng(i * 7 + 3));
      expect(catalogIds.has(result.characterId)).toBe(true);
    }
  });

  it("adds pulled tower to collection", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    const result = performSummon(save, new Rng(1));
    expect(save.collection[result.characterId]).toBeDefined();
  });

  it("isNew is true on first pull of that character", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    const result = performSummon(save, new Rng(1));
    expect(result.isNew).toBe(true);
  });

  it("hard pity guarantees Unique at pull 90", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 5;
    save.currency.pityCount = HARD_PITY - 1;
    const result = performSummon(save, new Rng(1));
    expect(result.rarity).toBe("Unique");
    expect(save.currency.pityCount).toBe(0);
  });

  it("pityCount increments on non-Unique pull", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 10;
    save.currency.pityCount = 0;
    let nonUniqueSeen = false;
    for (let i = 0; i < 10; i++) {
      const before = save.currency.pityCount;
      const result = performSummon(save, new Rng(i * 13 + 5));
      if (result.rarity !== "Unique") {
        expect(save.currency.pityCount).toBe(before + 1);
        nonUniqueSeen = true;
        break;
      }
    }
    expect(nonUniqueSeen).toBe(true);
  });
});

describe("performMultiSummon", () => {
  it("returns 10 results and deducts multi cost", () => {
    const save = createFreshSave();
    save.currency.crystals = MULTI_PULL_COST;
    const results = performMultiSummon(save, new Rng(1), 10);
    expect(results).toHaveLength(10);
    expect(save.currency.crystals).toBe(0);
  });
});
