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

  it("hard pity guarantees Legendary+ at pull 90", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 5;
    save.currency.pityCount = HARD_PITY - 1;
    const result = performSummon(save, new Rng(1));
    expect(["Legendary", "Unique"]).toContain(result.rarity);
    expect(save.currency.pityCount).toBe(0); // resets on Legendary or Unique
  });

  it("pityCount resets on Legendary as well as Unique", () => {
    // Run until we get a Legendary and verify pityCount resets
    let legendaryResetSeen = false;
    for (let seed = 0; seed < 200 && !legendaryResetSeen; seed++) {
      const save = createFreshSave();
      save.currency.crystals = SINGLE_PULL_COST * 10;
      save.currency.pityCount = 5;
      const result = performSummon(save, new Rng(seed));
      if (result.rarity === "Legendary") {
        expect(save.currency.pityCount).toBe(0);
        legendaryResetSeen = true;
      }
    }
    expect(legendaryResetSeen).toBe(true);
  });

  it("pityCount increments on non-Legendary+ pull", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 10;
    save.currency.pityCount = 0;
    let nonLegPlusSeen = false;
    for (let i = 0; i < 20; i++) {
      const before = save.currency.pityCount;
      const result = performSummon(save, new Rng(i * 13 + 5));
      if (result.rarity !== "Legendary" && result.rarity !== "Unique") {
        expect(save.currency.pityCount).toBe(before + 1);
        nonLegPlusSeen = true;
        break;
      }
    }
    expect(nonLegPlusSeen).toBe(true);
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

describe("pity insurance pool", () => {
  it("when active, result is Legendary or Unique (never lower)", () => {
    for (let seed = 0; seed < 40; seed++) {
      const save = createFreshSave();
      save.currency.crystals = SINGLE_PULL_COST;
      save.currency.pityInsuranceActive = true;
      const result = performSummon(save, new Rng(seed));
      expect(["Legendary", "Unique"]).toContain(result.rarity);
    }
  });

  it("insurance flag is consumed after one pull", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    save.currency.pityInsuranceActive = true;
    performSummon(save, new Rng(1));
    expect(save.currency.pityInsuranceActive).toBe(false);
  });

  it("insurance result (Legendary or Unique) resets pityCount", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    save.currency.pityCount = 5;
    save.currency.pityInsuranceActive = true;
    const result = performSummon(save, new Rng(1));
    // Insurance always yields Legendary or Unique — both reset pity
    expect(["Legendary", "Unique"]).toContain(result.rarity);
    expect(save.currency.pityCount).toBe(0);
  });

  it("over 40 seeds, roughly 5% are Unique and 95% are Legendary", () => {
    let uniques = 0;
    const RUNS = 200;
    for (let seed = 0; seed < RUNS; seed++) {
      const save = createFreshSave();
      save.currency.crystals = SINGLE_PULL_COST;
      save.currency.pityInsuranceActive = true;
      const result = performSummon(save, new Rng(seed));
      if (result.rarity === "Unique") uniques++;
    }
    const uniqueRate = uniques / RUNS;
    // Allow wide tolerance (seeded RNG, small sample) but confirm it's near 5%
    expect(uniqueRate).toBeGreaterThanOrEqual(0.01);
    expect(uniqueRate).toBeLessThanOrEqual(0.15);
  });
});

describe("maxed towers are no longer pulled", () => {
  it("a 5★ tower never appears in pulls", () => {
    const save = createFreshSave();
    save.currency.crystals = 1_000_000;
    const maxed = TOWERS[0].id;
    save.collection[maxed] = { stars: 5, copies: 0 }; // fully ascended
    const rng = new Rng(123);
    for (let i = 0; i < 300; i++) {
      expect(performSummon(save, rng).characterId).not.toBe(maxed);
    }
  });
});
