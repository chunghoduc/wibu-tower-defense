import { describe, expect, it } from "vitest";
import {
  absorbWithShield,
  ccDuration,
  slowedSpeed,
  tickDots,
  dotMaxHpDps,
  DOT_MAXHP_FRAC,
  DOT_BOSS_FRAC_MULT,
  type Dot,
} from "../src/core/effects.ts";

describe("ccDuration", () => {
  it("reduces duration by tenacity", () => {
    expect(ccDuration(2, 0)).toBe(2);
    expect(ccDuration(2, 0.5)).toBe(1);
    expect(ccDuration(2, 1)).toBe(0);
  });
  it("clamps tenacity to [0,1]", () => {
    expect(ccDuration(2, -1)).toBe(2);
    expect(ccDuration(2, 5)).toBe(0);
  });
});

describe("absorbWithShield", () => {
  it("absorbs fully when shield covers the hit", () => {
    expect(absorbWithShield(100, 30)).toEqual({ shield: 70, overflow: 0 });
  });
  it("overflows when the hit exceeds the shield", () => {
    expect(absorbWithShield(100, 150)).toEqual({ shield: 0, overflow: 50 });
  });
  it("passes through with no shield", () => {
    expect(absorbWithShield(0, 40)).toEqual({ shield: 0, overflow: 40 });
  });
});

describe("slowedSpeed", () => {
  it("scales speed by the slow fraction", () => {
    expect(slowedSpeed(100, 0.4)).toBeCloseTo(60);
    expect(slowedSpeed(100, 0)).toBe(100);
    expect(slowedSpeed(100, 1)).toBe(0);
  });
});

describe("dotMaxHpDps", () => {
  it("burns a small fraction of the target's max HP per second", () => {
    expect(dotMaxHpDps(1000, false)).toBeCloseTo(1000 * DOT_MAXHP_FRAC);
  });

  it("reduces the burn on bosses by the boss multiplier", () => {
    expect(dotMaxHpDps(1000, true)).toBeCloseTo(1000 * DOT_MAXHP_FRAC * DOT_BOSS_FRAC_MULT);
    expect(dotMaxHpDps(1000, true)).toBeLessThan(dotMaxHpDps(1000, false));
  });

  it("scales linearly with max HP so it stays relevant vs high-HP tanks", () => {
    expect(dotMaxHpDps(8000, false)).toBeCloseTo(8 * dotMaxHpDps(1000, false));
  });

  it("accepts explicit frac/boss-mult overrides and never goes negative", () => {
    expect(dotMaxHpDps(500, false, 0.05)).toBeCloseTo(25);
    expect(dotMaxHpDps(-50, false)).toBe(0);
  });

  it("uses a small fraction reduced further on bosses (sane defaults)", () => {
    expect(DOT_MAXHP_FRAC).toBeGreaterThan(0);
    expect(DOT_MAXHP_FRAC).toBeLessThanOrEqual(0.05);
    expect(DOT_BOSS_FRAC_MULT).toBeGreaterThan(0);
    expect(DOT_BOSS_FRAC_MULT).toBeLessThan(1);
  });
});

describe("tickDots", () => {
  it("accumulates damage and decrements timers", () => {
    const dots: Dot[] = [{ dps: 10, remaining: 1, type: "True", armorPen: 0, magicPen: 0 }];
    const r1 = tickDots(dots, 0.5);
    expect(r1.total).toBeCloseTo(5);
    expect(r1.remaining).toHaveLength(1);
    expect(r1.remaining[0].remaining).toBeCloseTo(0.5);
  });

  it("caps the final partial tick and drops expired dots", () => {
    const dots: Dot[] = [{ dps: 10, remaining: 1, type: "True", armorPen: 0, magicPen: 0 }];
    const r = tickDots(dots, 2);
    expect(r.total).toBeCloseTo(10); // only 1s of damage left
    expect(r.remaining).toHaveLength(0);
  });
});
