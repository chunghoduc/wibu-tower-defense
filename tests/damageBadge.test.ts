import { describe, it, expect } from "vitest";
import { ATTACK_DAMAGE_TYPES } from "../src/data/schemaEnums.ts";
import {
  DAMAGE_BADGE_COLOR,
  damageBadgeOnCard,
  damageGlyphPoints,
} from "../src/scenes/damageBadge.ts";

describe("DAMAGE_BADGE_COLOR", () => {
  it("is total over the damage types with two distinct colors", () => {
    for (const dt of ATTACK_DAMAGE_TYPES) {
      expect(typeof DAMAGE_BADGE_COLOR[dt]).toBe("number");
    }
    expect(DAMAGE_BADGE_COLOR.Physical).not.toBe(DAMAGE_BADGE_COLOR.Magic);
  });
});

describe("damageBadgeOnCard", () => {
  it("pins the badge to the card's upper-left, inside the half-width", () => {
    const w = 66;
    const g = damageBadgeOnCard(w);
    expect(g.x).toBeLessThan(0); // left of center
    expect(g.y).toBeLessThan(0); // above center
    expect(g.x).toBeGreaterThan(-w / 2); // still inside the card
    expect(g.diameter).toBeGreaterThan(0);
  });
  it("scales diameter monotonically with card width", () => {
    expect(damageBadgeOnCard(80).diameter).toBeGreaterThan(damageBadgeOnCard(40).diameter);
  });
});

describe("damageGlyphPoints", () => {
  it("returns in-bounds, non-empty outlines that differ per damage type", () => {
    const phys = damageGlyphPoints("Physical");
    const magic = damageGlyphPoints("Magic");
    expect(phys.length).toBeGreaterThan(2);
    expect(magic.length).toBeGreaterThan(2);
    for (const p of [...phys, ...magic]) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
    }
    // Distinct silhouettes (blade vs spark have different point counts here).
    expect(phys.length).not.toBe(magic.length);
  });
});
