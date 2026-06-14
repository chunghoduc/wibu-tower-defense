import { describe, it, expect } from "vitest";
import {
  wingRarityFilters,
  filterWingItems,
  autoWingSelection,
  trayWindow,
  type WingItemLike,
} from "../src/core/wingTray.ts";

const mk = (id: string, rarity: WingItemLike["rarity"]): WingItemLike => ({ id, rarity });

describe("wingRarityFilters", () => {
  it("returns distinct present rarities in ladder order", () => {
    const items = [mk("a", "Rare"), mk("b", "Common"), mk("c", "Rare"), mk("d", "Legendary")];
    expect(wingRarityFilters(items)).toEqual(["Common", "Rare", "Legendary"]);
  });
  it("empty for no items", () => {
    expect(wingRarityFilters([])).toEqual([]);
  });
});

describe("filterWingItems", () => {
  const items = [mk("a", "Common"), mk("b", "Rare"), mk("c", "Common")];
  it("all -> unchanged order", () => {
    expect(filterWingItems(items, "all").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("single rarity, order preserved", () => {
    expect(filterWingItems(items, "Common").map((i) => i.id)).toEqual(["a", "c"]);
  });
  it("no match -> empty", () => {
    expect(filterWingItems(items, "Unique")).toEqual([]);
  });
});

describe("autoWingSelection", () => {
  const items = [
    mk("leg", "Legendary"),
    mk("c1", "Common"),
    mk("r1", "Rare"),
    mk("c2", "Common"),
    mk("m1", "Magic"),
    mk("c3", "Common"),
  ];
  it("picks the lowest-rarity `need` items, stable tie-break by input order", () => {
    const r = autoWingSelection(items, {
      need: 3,
      jewelCap: 4,
      feathersOwned: 1,
      selected: new Set(),
    });
    expect(r.ids).toEqual(["c1", "c2", "c3"]);
    expect(r.jewels).toBe(1);
    expect(r.feather).toBe(true);
  });
  it("skips already-selected items and tops up", () => {
    const r = autoWingSelection(items, {
      need: 2,
      jewelCap: 4,
      feathersOwned: 1,
      selected: new Set(["c1", "c2"]),
    });
    expect(r.ids).toEqual(["c3", "m1"]);
  });
  it("jewels capped at 1; 0 when none owned; feather false when none owned", () => {
    const r = autoWingSelection(items, {
      need: 1,
      jewelCap: 0,
      feathersOwned: 0,
      selected: new Set(),
    });
    expect(r.jewels).toBe(0);
    expect(r.feather).toBe(false);
  });
  it("returns fewer ids than need when the pool is too small", () => {
    const r = autoWingSelection([mk("x", "Common")], {
      need: 5,
      jewelCap: 4,
      feathersOwned: 1,
      selected: new Set(),
    });
    expect(r.ids).toEqual(["x"]);
  });
});

describe("trayWindow", () => {
  it("computes rows, maxOffset and the visible slice", () => {
    const w = trayWindow(30, 12, 2, 0);
    expect(w.rows).toBe(3);
    expect(w.maxOffset).toBe(1);
    expect(w.startRow).toBe(0);
    expect(w.visibleCount).toBe(24);
  });
  it("clamps offset to maxOffset and windows the tail", () => {
    const w = trayWindow(30, 12, 2, 9);
    expect(w.startRow).toBe(1);
    expect(w.visibleCount).toBe(30 - 12);
  });
  it("fewer than one page -> maxOffset 0, all visible", () => {
    const w = trayWindow(5, 12, 2, 3);
    expect(w.maxOffset).toBe(0);
    expect(w.startRow).toBe(0);
    expect(w.visibleCount).toBe(5);
  });
});
