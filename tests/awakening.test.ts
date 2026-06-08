import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { canAwaken, awaken, getAwakening, awakeningStatMul, awakeningCost, MAX_AWAKENING, AWAKENING_CRYSTAL_COST } from "../src/core/awakening.ts";
import { AWAKENING_CRYSTAL } from "../src/data/materials.ts";

const TID = "yamo";

describe("F7 awakening", () => {
  it("refuses a tower that isn't 5★", () => {
    const s = createFreshSave();
    s.collection[TID] = { stars: 4, copies: 0 };
    s.materials[AWAKENING_CRYSTAL] = 99;
    expect(canAwaken(s, TID).ok).toBe(false);
    expect(awaken(s, TID)).toBe(-1);
  });

  it("refuses without enough crystals", () => {
    const s = createFreshSave();
    s.collection[TID] = { stars: 5, copies: 0 };
    s.materials[AWAKENING_CRYSTAL] = 0;
    expect(canAwaken(s, TID).ok).toBe(false);
    expect(awaken(s, TID)).toBe(-1);
  });

  it("awakens a 5★ tower, spending crystals and raising the rank", () => {
    const s = createFreshSave();
    s.collection[TID] = { stars: 5, copies: 0 };
    s.materials[AWAKENING_CRYSTAL] = AWAKENING_CRYSTAL_COST[1];
    expect(awaken(s, TID)).toBe(1);
    expect(getAwakening(s, TID)).toBe(1);
    expect(s.materials[AWAKENING_CRYSTAL]).toBe(0);
  });

  it("caps at MAX_AWAKENING and grants +10% per rank", () => {
    const s = createFreshSave();
    s.collection[TID] = { stars: 5, copies: 0 };
    s.materials[AWAKENING_CRYSTAL] = 999;
    for (let i = 0; i < MAX_AWAKENING; i++) awaken(s, TID);
    expect(getAwakening(s, TID)).toBe(MAX_AWAKENING);
    expect(awaken(s, TID)).toBe(-1); // can't exceed
    expect(awakeningCost(MAX_AWAKENING)).toBeNull();
    expect(awakeningStatMul(MAX_AWAKENING)).toBeCloseTo(1.3, 5);
  });
});
