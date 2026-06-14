import { describe, expect, test } from "vitest";
import {
  alchemyRecipeVMs,
  awakeningVMs,
  copyExchangeVMs,
  sparkVM,
  stationPreview,
  forgeGridLayout,
  type ForgeRecipeVM,
} from "../src/core/forgeStations.ts";
import { ALCHEMY_RECIPES, COPIES_PER_CRYSTAL } from "../src/data/alchemy.ts";
import { awakeningCost, MAX_AWAKENING } from "../src/core/awakening.ts";

describe("alchemyRecipeVMs", () => {
  test("gates craftability on owned inputs and carries qty/outputs", () => {
    const r0 = ALCHEMY_RECIPES[0];
    const inKey = Object.keys(r0.inputs)[0];
    const need = r0.inputs[inKey];
    const short = alchemyRecipeVMs({ [inKey]: need - 1 });
    expect(short[0].canCraft).toBe(false);
    const ok = alchemyRecipeVMs({ [inKey]: need });
    expect(ok[0].canCraft).toBe(true);
    expect(ok[0].inputs[0].qty).toBe(need);
    expect(ok[0].inputs[0].have).toBe(need);
    expect(ok[0].outputs.length).toBeGreaterThan(0);
  });
});

describe("awakeningVMs", () => {
  test("input cost comes from awakeningCost and gates on crystals", () => {
    const cost = awakeningCost(0);
    const [vm] = awakeningVMs([{ id: "t", name: "T", rank: 0, crystalsHave: cost }]);
    expect(vm.canCraft).toBe(true);
    expect(vm.inputs[0].qty).toBe(cost);
    const [poor] = awakeningVMs([{ id: "t", name: "T", rank: 0, crystalsHave: cost - 1 }]);
    expect(poor.canCraft).toBe(false);
  });
  test("max rank is not craftable and has no inputs", () => {
    const [vm] = awakeningVMs([{ id: "t", name: "T", rank: MAX_AWAKENING, crystalsHave: 999 }]);
    expect(vm.canCraft).toBe(false);
    expect(vm.inputs.length).toBe(0);
    expect(vm.note ?? "").toContain("Awakened");
  });
});

describe("copyExchangeVMs", () => {
  test("includes only towers at/above the copy threshold", () => {
    const vms = copyExchangeVMs([
      { id: "a", name: "A", copies: COPIES_PER_CRYSTAL },
      { id: "b", name: "B", copies: COPIES_PER_CRYSTAL - 1 },
    ]);
    expect(vms.length).toBe(1);
    expect(vms[0].id).toBe("a");
    expect(vms[0].inputs[0].qty).toBe(COPIES_PER_CRYSTAL);
    expect(vms[0].outputs[0].qty).toBe(1);
  });
});

describe("sparkVM", () => {
  test("gates on the pity count and reports the shortfall", () => {
    expect(sparkVM(200, 200, "u", "U").canCraft).toBe(true);
    const s = sparkVM(150, 200, "u", "U");
    expect(s.canCraft).toBe(false);
    expect(s.note ?? "").toContain("50");
  });
});

describe("stationPreview", () => {
  const mk = (emoji: string, craft: boolean): ForgeRecipeVM => ({
    id: emoji,
    label: emoji,
    inputs: [{ iconKey: "", emoji, color: 0, qty: 1 }],
    outputs: [{ iconKey: "", emoji: "o", color: 0, qty: 1 }],
    canCraft: craft,
  });
  test("prefers a craftable recipe, returns null for empty", () => {
    expect(stationPreview([mk("a", false), mk("b", true)])?.input.emoji).toBe("b");
    expect(stationPreview([])).toBeNull();
  });
});

describe("forgeGridLayout", () => {
  test("2 columns, in-bounds, rows stack down", () => {
    const rects = forgeGridLayout(5, 960, 80);
    expect(rects.length).toBe(5);
    expect(rects[1].x).toBeGreaterThan(rects[0].x);
    expect(rects[2].y).toBeGreaterThan(rects[0].y);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(960);
    }
  });
});
