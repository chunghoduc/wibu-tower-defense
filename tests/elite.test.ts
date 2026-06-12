import { describe, expect, it } from "vitest";
import { applyEliteBoost, rollEliteBoxTier, ELITE_MULT } from "../src/core/elite.ts";
import { Rng } from "../src/core/rng.ts";
import { defaultStats } from "../src/data/schema.ts";

describe("elite enemies", () => {
  it("applyEliteBoost multiplies survival/offense stats and is non-mutating", () => {
    const base = {
      ...defaultStats(),
      maxHp: 100,
      atk: 10,
      armor: 5,
      magicResist: 4,
      moveSpeed: 30,
      attackSpeed: 1,
    };
    const boosted = applyEliteBoost(base);
    expect(boosted.maxHp).toBe(100 * ELITE_MULT.maxHp);
    expect(boosted.atk).toBeCloseTo(10 * ELITE_MULT.atk);
    expect(boosted.armor).toBeCloseTo(5 * ELITE_MULT.armor);
    expect(boosted.moveSpeed).toBeCloseTo(30 * ELITE_MULT.moveSpeed);
    // Original untouched.
    expect(base.maxHp).toBe(100);
  });

  it("rollEliteBoxTier always returns a valid 1..5 tier", () => {
    const rng = new Rng(123);
    for (let i = 0; i < 2000; i++) {
      const t = rollEliteBoxTier(rng);
      expect(t).toBeGreaterThanOrEqual(1);
      expect(t).toBeLessThanOrEqual(5);
    }
  });

  it("rollEliteBoxTier is skewed toward Common, Unique is rare", () => {
    const rng = new Rng(7);
    const counts = [0, 0, 0, 0, 0, 0];
    const N = 20000;
    for (let i = 0; i < N; i++) counts[rollEliteBoxTier(rng)]++;
    // Common (t1) is by far the most common; Unique (t5) is the rarest.
    expect(counts[1]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBeGreaterThan(counts[3]);
    expect(counts[5]).toBeLessThan(counts[4]);
    // ~1% Unique — allow a generous band for RNG noise.
    expect(counts[5] / N).toBeLessThan(0.03);
    expect(counts[1] / N).toBeGreaterThan(0.5);
  });
});
