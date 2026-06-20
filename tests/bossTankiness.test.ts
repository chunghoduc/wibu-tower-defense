import { describe, it, expect } from "vitest";
import { DIFFICULTIES, DIFFICULTY_SCALING } from "../src/data/schema.ts";

describe("boss tankiness", () => {
  it("bossHpMult is strictly increasing across tiers", () => {
    const mults = DIFFICULTIES.map((d) => DIFFICULTY_SCALING[d].bossHpMult);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]);
    }
  });

  it("Normal bossHpMult stays a real lever, but no longer the whole wall", () => {
    // 2026-06-15 rebalance: cut 1.6→1.1 so the lifted trash floor (hpMult 2.1)
    // doesn't inflate bosses. Bosses still scale >1x on the difficulty axis and
    // lean on authored base HP + mechanics for the wall, not this multiplier.
    expect(DIFFICULTY_SCALING.Normal.bossHpMult).toBeGreaterThanOrEqual(1.05);
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
