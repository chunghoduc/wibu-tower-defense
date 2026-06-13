// tests/gesture.test.ts
import { describe, it, expect } from "vitest";
import {
  TAP_SLOP_PX,
  MIN_FLICK_VEL,
  MAX_FLICK_VEL,
  flickVelocity,
  decayVelocity,
  isFlick,
  type FlickSample,
} from "../src/core/gesture.ts";

describe("TAP_SLOP_PX", () => {
  it("is a single positive constant", () => {
    expect(TAP_SLOP_PX).toBeGreaterThan(0);
    expect(Number.isFinite(TAP_SLOP_PX)).toBe(true);
  });
});

describe("flickVelocity", () => {
  it("returns 0 for fewer than two samples", () => {
    expect(flickVelocity([])).toBe(0);
    expect(flickVelocity([{ pos: 10, t: 0 }])).toBe(0);
  });

  it("gives a non-zero, correctly-signed velocity for a fast recent swipe", () => {
    // finger moved from pos 300 -> 200 over 20ms (upward = negative): -5 px/ms
    const samples: FlickSample[] = [
      { pos: 300, t: 1000 },
      { pos: 250, t: 1010 },
      { pos: 200, t: 1020 },
    ];
    const v = flickVelocity(samples);
    expect(v).toBeLessThan(0);
    expect(Math.abs(v)).toBeCloseTo(5, 1);
  });

  it("ignores samples older than the recent window", () => {
    // A long-ago sample at t=0 must NOT be averaged in: velocity reflects only the
    // recent window (pos 0->2 over 20ms = 0.1), not the full 520ms span (~0.004).
    const samples: FlickSample[] = [
      { pos: 0, t: 0 },
      { pos: 0, t: 500 },
      { pos: 2, t: 520 },
    ];
    const fullSpanAvg = 2 / 520;
    expect(Math.abs(flickVelocity(samples))).toBeGreaterThan(fullSpanAvg * 10);
    expect(Math.abs(flickVelocity(samples))).toBeCloseTo(0.1, 5);
  });
});

describe("decayVelocity", () => {
  it("strictly decreases magnitude over time and preserves sign", () => {
    const v0 = 4;
    const v1 = decayVelocity(v0, 16);
    expect(v1).toBeGreaterThan(0);
    expect(v1).toBeLessThan(v0);
  });

  it("snaps to exactly 0 once below MIN_FLICK_VEL", () => {
    const tiny = MIN_FLICK_VEL * 0.5;
    expect(decayVelocity(tiny, 16)).toBe(0);
  });

  it("clamps the input magnitude to MAX_FLICK_VEL", () => {
    const huge = MAX_FLICK_VEL * 100;
    expect(decayVelocity(huge, 0)).toBeLessThanOrEqual(MAX_FLICK_VEL);
  });

  it("a fling terminates in finite steps with finite, monotonic travel", () => {
    let v = MAX_FLICK_VEL; // start at the fastest allowed
    let travel = 0;
    let steps = 0;
    while (v !== 0 && steps < 100000) {
      v = decayVelocity(v, 16);
      travel += Math.abs(v) * 16;
      steps++;
    }
    expect(v).toBe(0);
    expect(steps).toBeLessThan(10000); // converges quickly, no infinite loop
    expect(Number.isFinite(travel)).toBe(true);
  });
});

describe("isFlick", () => {
  it("is true above MIN_FLICK_VEL and false below", () => {
    expect(isFlick(MIN_FLICK_VEL * 2)).toBe(true);
    expect(isFlick(-MIN_FLICK_VEL * 2)).toBe(true); // sign-agnostic
    expect(isFlick(MIN_FLICK_VEL * 0.5)).toBe(false);
    expect(isFlick(0)).toBe(false);
  });
});
