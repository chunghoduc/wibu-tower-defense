import { describe, expect, it } from "vitest";
import { WEAPON_RANGE, heroRangeForWeapon } from "../src/data/weaponRange.ts";
import { WEAPON_TYPES } from "../src/data/schema.ts";

// The melee/ranged threshold the renderer uses (attackStyle.ts RANGED_MELEE).
const RANGED_MELEE = 120;

describe("weapon-family attack reach", () => {
  it("defines a positive range for every weapon family", () => {
    for (const w of WEAPON_TYPES) {
      expect(WEAPON_RANGE[w], w).toBeGreaterThan(0);
    }
  });

  it("melee families reach less than ranged families", () => {
    expect(WEAPON_RANGE.Sword).toBeLessThan(RANGED_MELEE);
    expect(WEAPON_RANGE.Bow).toBeGreaterThan(RANGED_MELEE);
    expect(WEAPON_RANGE.Gun).toBeGreaterThan(RANGED_MELEE);
    expect(WEAPON_RANGE.Staff).toBeGreaterThan(RANGED_MELEE);
    expect(WEAPON_RANGE.Tome).toBeGreaterThan(RANGED_MELEE);
    // Swords are the shortest reach of all; guns the longest.
    expect(WEAPON_RANGE.Sword).toBe(Math.min(...Object.values(WEAPON_RANGE)));
    expect(WEAPON_RANGE.Gun).toBe(Math.max(...Object.values(WEAPON_RANGE)));
  });

  it("unarmed defaults to the sword range", () => {
    expect(heroRangeForWeapon(null)).toBe(WEAPON_RANGE.Sword);
    expect(heroRangeForWeapon("Bow")).toBe(WEAPON_RANGE.Bow);
  });
});
