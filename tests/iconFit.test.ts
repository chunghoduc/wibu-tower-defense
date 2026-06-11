import { describe, expect, it } from "vitest";
import { iconFitScale } from "../src/scenes/itemIcon.ts";

/**
 * Item/reward icons must look the SAME size everywhere (inventory, shop, the
 * loot-box reveal, the post-battle reward panel). Every surface renders the one
 * 96×96 `item__<id>` texture; the only thing that drifted was the scale — some
 * call sites hand-rolled a tiny fixed `setDisplaySize(34)` so the same item
 * looked smaller/softer in loot popups than in the bag. `iconFitScale` is the
 * one sizing rule they now share: scale so the icon's LONGER edge equals `fit`,
 * preserving aspect ratio (matching ShopScene's existing 72/max(w,h)).
 */
describe("iconFitScale", () => {
  it("scales a square 96px icon so its edge equals the fit box", () => {
    expect(iconFitScale(96, 96, 48)).toBeCloseTo(0.5);
    expect(iconFitScale(96, 96, 52)).toBeCloseTo(52 / 96);
  });

  it("fits the LONGER edge for a non-square icon (no stretch)", () => {
    expect(iconFitScale(120, 96, 60)).toBeCloseTo(0.5); // 60/120
    expect(iconFitScale(96, 120, 60)).toBeCloseTo(0.5); // 60/120
  });

  it("guards against a zero/unknown native size (no NaN/Infinity)", () => {
    expect(iconFitScale(0, 0, 48)).toBe(1);
    expect(Number.isFinite(iconFitScale(0, 96, 48))).toBe(true);
  });
});
