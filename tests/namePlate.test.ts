import { describe, it, expect } from "vitest";
import { plateLineLayout } from "../src/scenes/labelFit.ts";

describe("plateLineLayout", () => {
  it("centers a single line in the band", () => {
    // band from topY=10 height=24 => center 22; one line => baseline at center.
    const ys = plateLineLayout(10, 24, 1, 12);
    expect(ys).toHaveLength(1);
    expect(ys[0]).toBeCloseTo(22, 5);
  });

  it("stacks two lines symmetrically around the band center", () => {
    const ys = plateLineLayout(10, 28, 2, 10);
    expect(ys).toHaveLength(2);
    const center = 10 + 28 / 2;
    expect(ys[0] + ys[1]).toBeCloseTo(center * 2, 5); // symmetric
    expect(ys[1]).toBeGreaterThan(ys[0]);
  });

  it("keeps all baselines inside the band", () => {
    const topY = 0,
      h = 26,
      n = 2,
      px = 11;
    const ys = plateLineLayout(topY, h, n, px);
    for (const y of ys) {
      expect(y - px / 2).toBeGreaterThanOrEqual(topY - 1);
      expect(y + px / 2).toBeLessThanOrEqual(topY + h + 1);
    }
  });
});
