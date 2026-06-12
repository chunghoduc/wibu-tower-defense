import { describe, it, expect } from "vitest";
import { DIFFICULTIES, DIFFICULTY_SCALING } from "../src/data/schema.ts";

describe("boss tankiness", () => {
  it("bossHpMult is strictly increasing across tiers", () => {
    const mults = DIFFICULTIES.map((d) => DIFFICULTY_SCALING[d].bossHpMult);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]);
    }
  });

  it("Normal bossHpMult is no longer a no-op (bosses are tankier than equal-base trash)", () => {
    // Was 1.0 — the lever did nothing on the tier most players live in.
    expect(DIFFICULTY_SCALING.Normal.bossHpMult).toBeGreaterThanOrEqual(1.5);
  });

  it("effective boss HP factor (hpMult x bossHpMult) is strictly increasing — monotonic law holds at boss level", () => {
    const factor = (d: (typeof DIFFICULTIES)[number]) =>
      DIFFICULTY_SCALING[d].hpMult * DIFFICULTY_SCALING[d].bossHpMult;
    const factors = DIFFICULTIES.map(factor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThan(factors[i - 1]);
    }
  });
});
