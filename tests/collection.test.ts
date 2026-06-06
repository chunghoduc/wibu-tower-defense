import { describe, expect, it } from "vitest";
import {
  addTowerToCollection,
  addTowerDupe,
  isTowerOwned,
  getTowerStars,
} from "../src/core/collection.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("collection helpers", () => {
  it("isTowerOwned returns false for unowned tower", () => {
    const save = createFreshSave();
    expect(isTowerOwned(save, "zoran-thricedraw")).toBe(false);
  });

  it("addTowerToCollection sets stars to 1", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "zoran-thricedraw");
    expect(isTowerOwned(save, "zoran-thricedraw")).toBe(true);
    expect(getTowerStars(save, "zoran-thricedraw")).toBe(1);
  });

  it("addTowerToCollection on already-owned tower acts as dupe", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "zoran-thricedraw");
    addTowerToCollection(save, "zoran-thricedraw");
    expect(getTowerStars(save, "zoran-thricedraw")).toBe(2);
  });

  it("addTowerDupe increments stars", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    addTowerDupe(save, "t");
    expect(getTowerStars(save, "t")).toBe(2);
  });

  it("addTowerDupe caps at 5 stars", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    for (let i = 0; i < 10; i++) addTowerDupe(save, "t");
    expect(getTowerStars(save, "t")).toBe(5);
  });

  it("getTowerStars returns 0 for unowned tower", () => {
    const save = createFreshSave();
    expect(getTowerStars(save, "unknown")).toBe(0);
  });

  it("multiple towers tracked independently", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "a");
    addTowerToCollection(save, "b");
    addTowerDupe(save, "a");
    expect(getTowerStars(save, "a")).toBe(2);
    expect(getTowerStars(save, "b")).toBe(1);
  });
});
