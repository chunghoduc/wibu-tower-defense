import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  addMasteryXp,
  getMasteryLevel,
  masteryLevelFromXp,
  masteryStatMul,
  masteryXpForLevel,
  MASTERY_MAX_LEVEL,
} from "../src/core/mastery.ts";

describe("F6 tower mastery", () => {
  it("a fresh tower is level 1 with no bonus", () => {
    const s = createFreshSave();
    expect(getMasteryLevel(s, "yamo")).toBe(1);
    expect(masteryStatMul(1)).toBe(1);
  });

  it("XP curve is monotonic increasing", () => {
    for (let l = 2; l <= MASTERY_MAX_LEVEL; l++) {
      expect(masteryXpForLevel(l)).toBeGreaterThan(masteryXpForLevel(l - 1));
    }
  });

  it("accumulating XP raises the level and caps at MASTERY_MAX_LEVEL", () => {
    const s = createFreshSave();
    addMasteryXp(s, "yamo", masteryXpForLevel(3));
    expect(getMasteryLevel(s, "yamo")).toBe(3);
    addMasteryXp(s, "yamo", 10_000_000);
    expect(getMasteryLevel(s, "yamo")).toBe(MASTERY_MAX_LEVEL);
  });

  it("level up is reported when crossing a threshold", () => {
    const s = createFreshSave();
    const gain = addMasteryXp(s, "yamo", masteryXpForLevel(2));
    expect(gain.leveledUp).toBe(true);
    expect(gain.level).toBe(2);
    const again = addMasteryXp(s, "yamo", 1);
    expect(again.leveledUp).toBe(false);
  });

  it("max level grants ~+18% (2% per level over 9 levels)", () => {
    expect(masteryStatMul(MASTERY_MAX_LEVEL)).toBeCloseTo(1 + 0.02 * (MASTERY_MAX_LEVEL - 1), 5);
  });

  it("masteryLevelFromXp matches the threshold table", () => {
    expect(masteryLevelFromXp(0)).toBe(1);
    expect(masteryLevelFromXp(masteryXpForLevel(5))).toBe(5);
    expect(masteryLevelFromXp(masteryXpForLevel(5) - 1)).toBe(4);
  });
});
