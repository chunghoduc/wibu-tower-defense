import { describe, expect, it } from "vitest";
import { staggerDelays, MOTION } from "../src/scenes/uiMotion.ts";

describe("staggerDelays", () => {
  it("returns [] for non-positive counts", () => {
    expect(staggerDelays(0)).toEqual([]);
    expect(staggerDelays(-3)).toEqual([]);
  });

  it("returns a single 'from' delay for count 1", () => {
    expect(staggerDelays(1, { from: 50 })).toEqual([50]);
  });

  it("uses exact i*step spacing when under the cap", () => {
    expect(staggerDelays(4, { step: 40, maxTotal: 360, from: 0 })).toEqual([0, 40, 80, 120]);
  });

  it("offsets every delay by 'from'", () => {
    expect(staggerDelays(3, { step: 20, from: 100 })).toEqual([100, 120, 140]);
  });

  it("is non-decreasing and clamps the last delay to from+maxTotal for large counts", () => {
    const d = staggerDelays(50, { step: 40, maxTotal: 360, from: 0 });
    expect(d).toHaveLength(50);
    expect(d[0]).toBe(0);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
    expect(d[d.length - 1]).toBeLessThanOrEqual(360);
  });

  it("exposes motion-timing tokens", () => {
    expect(MOTION.popOut).toBeGreaterThan(0);
    expect(MOTION.stagger).toBeGreaterThan(0);
    expect(MOTION.staggerMax).toBeGreaterThanOrEqual(MOTION.stagger);
  });
});
