import { describe, expect, it } from "vitest";
import { procCoefficient, PROC_REF_SPEED, PROC_MIN } from "../src/data/procCoefficient.ts";

describe("procCoefficient", () => {
  it("is 1 at or below the reference speed", () => {
    expect(procCoefficient(PROC_REF_SPEED)).toBe(1);
    expect(procCoefficient(0.5)).toBe(1);
    expect(procCoefficient(1)).toBe(1);
  });

  it("falls off above the reference speed (per-second parity)", () => {
    // 2x reference speed → half chance.
    expect(procCoefficient(PROC_REF_SPEED * 2)).toBeCloseTo(0.5, 5);
    expect(procCoefficient(3)).toBeLessThan(procCoefficient(2));
  });

  it("never drops below the floor", () => {
    expect(procCoefficient(5)).toBeGreaterThanOrEqual(PROC_MIN);
    expect(procCoefficient(100)).toBe(PROC_MIN);
  });

  it("is monotonically non-increasing", () => {
    let prev = procCoefficient(0.1);
    for (let s = 0.1; s <= 10; s += 0.1) {
      const c = procCoefficient(s);
      expect(c).toBeLessThanOrEqual(prev + 1e-9);
      prev = c;
    }
  });

  it("falls back to 1 for non-positive / invalid speeds", () => {
    expect(procCoefficient(0)).toBe(1);
    expect(procCoefficient(-2)).toBe(1);
    expect(procCoefficient(NaN)).toBe(1);
  });
});
