import { describe, expect, it } from "vitest";
import {
  attemptEnhance, enhanceBonus, enhanceChance, jewelForLevel, scaleStatsByEnhance,
  MAX_ENHANCE, BLESS_JEWEL, SOUL_JEWEL,
} from "../src/core/enhance.ts";
import { createFreshSave, type HeroSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

function saveWithItem(level: number): HeroSave {
  const s = createFreshSave();
  s.inventory.items.push({
    id: "it1", defId: "x", acquiredLevel: 1, rolledStats: { atk: 100 },
    rolledPrimaryAffix: 10, rolledAffixes: [], enhanceLevel: level,
  });
  return s;
}

describe("T13 — item enhancement", () => {
  it("chance is 100% below +6 (bless) and falls 10%/level after (soul)", () => {
    expect(enhanceChance(0)).toBe(1);
    expect(enhanceChance(5)).toBe(1);
    expect(enhanceChance(6)).toBeCloseTo(0.9, 5);
    expect(enhanceChance(7)).toBeCloseTo(0.8, 5);
    expect(enhanceChance(14)).toBeCloseTo(0.1, 5);
    expect(enhanceChance(20)).toBe(0.05); // floored
  });

  it("uses bless jewel below +6, soul jewel at/after +6", () => {
    expect(jewelForLevel(0)).toBe(BLESS_JEWEL);
    expect(jewelForLevel(5)).toBe(BLESS_JEWEL);
    expect(jewelForLevel(6)).toBe(SOUL_JEWEL);
  });

  it("each level adds +8% to stats", () => {
    expect(enhanceBonus(0)).toBe(1);
    expect(enhanceBonus(5)).toBeCloseTo(1.4, 5);
    const scaled = scaleStatsByEnhance({ atk: 100, maxHp: 50 }, 5);
    expect(scaled.atk).toBeCloseTo(140, 5);
    expect(scaled.maxHp).toBeCloseTo(70, 5);
  });

  it("bless enhance always succeeds and consumes a bless jewel", () => {
    const s = saveWithItem(0);
    s.materials[BLESS_JEWEL] = 1;
    const r = attemptEnhance(s, "it1", new Rng(1));
    expect(r.ok).toBe(true);
    expect(r.success).toBe(true);
    expect(r.to).toBe(1);
    expect(s.materials[BLESS_JEWEL]).toBe(0);
  });

  it("fails when no jewel available", () => {
    const s = saveWithItem(0);
    const r = attemptEnhance(s, "it1", new Rng(1));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-jewel");
    expect(s.inventory.items[0].enhanceLevel).toBe(0);
  });

  it("a failed soul enhance drops the level by 1–5 and consumes the soul jewel", () => {
    // Find a seed that fails the ~80% chance at +7. Try several rngs.
    let dropped = false;
    for (let seed = 1; seed < 200 && !dropped; seed++) {
      const s = saveWithItem(7);
      s.materials[SOUL_JEWEL] = 1;
      const r = attemptEnhance(s, "it1", new Rng(seed));
      expect(s.materials[SOUL_JEWEL]).toBe(0); // always consumed
      if (r.success === false) {
        expect(r.to!).toBeLessThan(7);
        expect(r.to!).toBeGreaterThanOrEqual(2); // 7 - (1..5)
        dropped = true;
      }
    }
    expect(dropped).toBe(true);
  });

  it("cannot enhance past the cap", () => {
    const s = saveWithItem(MAX_ENHANCE);
    s.materials[SOUL_JEWEL] = 5;
    const r = attemptEnhance(s, "it1", new Rng(1));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("maxed");
  });
});
