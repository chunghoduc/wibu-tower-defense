import { describe, expect, it } from "vitest";
import {
  rollBoxLevel,
  rollItemLevelFromBox,
  boxLevelQtyMul,
  boxItemLevelBounds,
  BOX_LEVEL_BAND,
  ITEM_LEVEL_BAND,
  MAX_BOX_LEVEL,
} from "../src/core/boxLevel.ts";
import { MAX_ITEM_REQ_LEVEL } from "../src/data/items.ts";
import { Rng } from "../src/core/rng.ts";

describe("box level", () => {
  it("rolls a box level within ±BOX_LEVEL_BAND of the hero level", () => {
    const h = 60;
    const lo = Math.round(h * (1 - BOX_LEVEL_BAND));
    const hi = Math.round(h * (1 + BOX_LEVEL_BAND));
    const seen = new Set<number>();
    for (let s = 1; s <= 400; s++) {
      const lvl = rollBoxLevel(h, new Rng(s));
      expect(lvl).toBeGreaterThanOrEqual(lo);
      expect(lvl).toBeLessThanOrEqual(hi);
      seen.add(lvl);
    }
    expect(seen.size).toBeGreaterThan(1); // it's a RANGE, not a fixed number
  });

  it("clamps a box level to [1, MAX_BOX_LEVEL]", () => {
    for (let s = 1; s <= 50; s++) {
      expect(rollBoxLevel(1, new Rng(s))).toBeGreaterThanOrEqual(1);
      expect(rollBoxLevel(999, new Rng(s))).toBeLessThanOrEqual(MAX_BOX_LEVEL);
    }
  });

  it("rolls a gear level within ±ITEM_LEVEL_BAND of the BOX level", () => {
    const box = 50;
    const lo = Math.round(box * (1 - ITEM_LEVEL_BAND));
    const hi = Math.round(box * (1 + ITEM_LEVEL_BAND));
    for (let s = 1; s <= 400; s++) {
      const lvl = rollItemLevelFromBox(box, new Rng(s));
      expect(lvl).toBeGreaterThanOrEqual(lo);
      expect(lvl).toBeLessThanOrEqual(hi);
    }
  });

  it("clamps a gear level to [1, MAX_ITEM_REQ_LEVEL]", () => {
    for (let s = 1; s <= 50; s++) {
      expect(rollItemLevelFromBox(1, new Rng(s))).toBeGreaterThanOrEqual(1);
      expect(rollItemLevelFromBox(999, new Rng(s))).toBeLessThanOrEqual(MAX_ITEM_REQ_LEVEL);
    }
  });

  it("boxItemLevelBounds is a true superset of the compounded hero→box→item roll", () => {
    for (const h of [8, 30, 50, 75, 100]) {
      const [lo, hi] = boxItemLevelBounds(h);
      for (let s = 1; s <= 600; s++) {
        const rng = new Rng(s * 7 + h);
        const box = rollBoxLevel(h, rng);
        const item = rollItemLevelFromBox(box, rng);
        expect(item, `hero ${h}: item ${item} outside [${lo},${hi}]`).toBeGreaterThanOrEqual(lo);
        expect(item, `hero ${h}: item ${item} outside [${lo},${hi}]`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("compounds two ranges into a WIDER spread than a single ±band", () => {
    // Two stacked ±bands must reach further than one band alone — that is the
    // whole point of the box-as-intermediary design.
    const [lo, hi] = boxItemLevelBounds(60);
    expect(lo).toBeLessThan(Math.round(60 * (1 - ITEM_LEVEL_BAND)));
    expect(hi).toBeGreaterThan(Math.round(60 * (1 + ITEM_LEVEL_BAND)));
  });

  it("a higher hero level yields higher box levels on average (centered on hero)", () => {
    const avgBox = (h: number) => {
      let total = 0;
      for (let s = 1; s <= 300; s++) total += rollBoxLevel(h, new Rng(s));
      return total / 300;
    };
    const a = avgBox(20),
      b = avgBox(70);
    expect(b).toBeGreaterThan(a);
    expect(avgBox(50)).toBeGreaterThan(50 * 0.95); // unbiased: averages near the hero level
    expect(avgBox(50)).toBeLessThan(50 * 1.05);
  });

  it("the material-quantity multiplier is 1.0 at level 1 and rises with level", () => {
    expect(boxLevelQtyMul(1)).toBe(1);
    expect(boxLevelQtyMul(0)).toBe(1); // clamped — never below the base payout
    expect(boxLevelQtyMul(50)).toBeGreaterThan(1);
    expect(boxLevelQtyMul(100)).toBeGreaterThan(boxLevelQtyMul(50));
    // A maxed box pours meaningfully more than a level-1 box (≈2.5×), but not absurdly.
    expect(boxLevelQtyMul(MAX_BOX_LEVEL)).toBeGreaterThan(2);
    expect(boxLevelQtyMul(MAX_BOX_LEVEL)).toBeLessThan(4);
  });
});
