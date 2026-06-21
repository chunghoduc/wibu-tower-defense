import { describe, it, expect } from "vitest";
import { heroWingFlap } from "../src/data/heroWingFlap.ts";

describe("heroWingFlap", () => {
  it("keeps rise within [0,1] across a whole beat", () => {
    for (let ms = 0; ms <= 1600; ms += 17) {
      const f = heroWingFlap(ms);
      expect(f.rise).toBeGreaterThanOrEqual(0);
      expect(f.rise).toBeLessThanOrEqual(1);
    }
  });

  it("articulates a real arc — the wing actually rotates through the beat", () => {
    let min = Infinity,
      max = -Infinity;
    for (let ms = 0; ms <= 760; ms += 10) {
      const d = heroWingFlap(ms).beatDeg;
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    // A genuine flap swings the half through a wide arc, not a tiny rock.
    expect(max - min).toBeGreaterThan(30);
  });

  it("sweeps UP (more negative) as the wings rise", () => {
    // Sample the bottom of the beat vs a high-rise moment.
    let low = heroWingFlap(0);
    let high = low;
    for (let ms = 0; ms <= 760; ms += 5) {
      const f = heroWingFlap(ms);
      if (f.rise < low.rise) low = f;
      if (f.rise > high.rise) high = f;
    }
    expect(high.beatDeg).toBeLessThan(low.beatDeg); // raised pose rotates the half up
  });

  it("squashes the span as it sweeps up (narrower, slightly taller)", () => {
    for (let ms = 0; ms <= 760; ms += 19) {
      const f = heroWingFlap(ms);
      expect(f.scaleX).toBeLessThanOrEqual(1);
      expect(f.scaleY).toBeGreaterThanOrEqual(1);
    }
  });

  it("is periodic and wraps safely for negative and large times", () => {
    const a = heroWingFlap(120);
    const b = heroWingFlap(120 + 760);
    expect(b.beatDeg).toBeCloseTo(a.beatDeg, 6);
    expect(() => heroWingFlap(-500)).not.toThrow();
    const neg = heroWingFlap(-500);
    expect(neg.rise).toBeGreaterThanOrEqual(0);
    expect(neg.rise).toBeLessThanOrEqual(1);
  });
});
