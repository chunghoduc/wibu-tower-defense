import { describe, expect, it } from "vitest";
import {
  addTowerToCollection,
  addTowerDupe,
  isTowerOwned,
  isTowerMaxStar,
  getTowerStars,
  getTowerCopies,
  starUpCost,
  upgradeTowerStar,
  MAX_STARS,
} from "../src/core/collection.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("collection helpers", () => {
  it("isTowerOwned returns false for unowned tower", () => {
    const save = createFreshSave();
    expect(isTowerOwned(save, "zoran-thricedraw")).toBe(false);
  });

  it("addTowerToCollection sets stars 1 with no copies", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "zoran-thricedraw");
    expect(getTowerStars(save, "zoran-thricedraw")).toBe(1);
    expect(getTowerCopies(save, "zoran-thricedraw")).toBe(0);
  });

  it("a duplicate banks a copy instead of raising the star", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    addTowerToCollection(save, "t"); // dupe
    addTowerDupe(save, "t");
    expect(getTowerStars(save, "t")).toBe(1);
    expect(getTowerCopies(save, "t")).toBe(2);
  });

  it("getTowerStars returns 0 for unowned tower", () => {
    const save = createFreshSave();
    expect(getTowerStars(save, "unknown")).toBe(0);
  });
});

describe("star ascension", () => {
  it("cost rises with the current star: 1, 3, 7, 15 copies, null at max", () => {
    expect(starUpCost(1)?.copies).toBe(1);
    expect(starUpCost(2)?.copies).toBe(3);
    expect(starUpCost(3)?.copies).toBe(7);
    expect(starUpCost(4)?.copies).toBe(15);
    expect(starUpCost(MAX_STARS)).toBeNull();
  });

  it("the crystal cost rises with rarity (copies stay the same)", () => {
    const common = starUpCost(2, "Common")!;
    const rare = starUpCost(2, "Rare")!;
    const unique = starUpCost(2, "Unique")!;
    expect(rare.crystals).toBeGreaterThan(common.crystals);
    expect(unique.crystals).toBeGreaterThan(rare.crystals);
    expect(rare.copies).toBe(common.copies); // copies depend on star only
    // and it still rises with the current star (base cost grows)
    expect(starUpCost(3, "Rare")!.crystals).toBeGreaterThan(starUpCost(2, "Rare")!.crystals);
  });

  it("upgrade spends copies + crystals and raises the star", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    save.collection["t"].copies = 1;
    save.currency.gold = 9999;
    const before = save.currency.gold;
    const r = upgradeTowerStar(save, "t");
    expect(r.success).toBe(true);
    expect(getTowerStars(save, "t")).toBe(2);
    expect(getTowerCopies(save, "t")).toBe(0);
    expect(save.currency.gold).toBeLessThan(before);
  });

  it("fails without enough copies or crystals", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    save.currency.gold = 9999;
    expect(upgradeTowerStar(save, "t").success).toBe(false); // 0 copies
    save.collection["t"].copies = 1;
    save.currency.gold = 0;
    expect(upgradeTowerStar(save, "t").success).toBe(false); // no crystals
  });

  it("can be fully ascended to 5★, then dupes are ignored and cost is null", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    save.currency.gold = 1_000_000;
    save.collection["t"].copies = 1 + 3 + 7 + 15; // exactly enough for four upgrades
    for (let s = 1; s < MAX_STARS; s++) expect(upgradeTowerStar(save, "t").success).toBe(true);
    expect(getTowerStars(save, "t")).toBe(MAX_STARS);
    expect(getTowerCopies(save, "t")).toBe(0);
    expect(isTowerMaxStar(save, "t")).toBe(true);
    addTowerDupe(save, "t"); // maxed → no more banking
    expect(getTowerCopies(save, "t")).toBe(0);
    expect(upgradeTowerStar(save, "t").success).toBe(false);
  });
});
