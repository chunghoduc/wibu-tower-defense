import { describe, expect, it } from "vitest";
import { enemyWalkTransform } from "../src/scenes/enemyWalkTransform.ts";

describe("enemyWalkTransform", () => {
  it("bobs the body up mid-stride and plants at phase 0", () => {
    const plant = enemyWalkTransform(0); // sin(0)=0 → foot-plant
    const mid = enemyWalkTransform(Math.PI / 2); // sin=1   → mid-swing
    expect(plant.yOff).toBeCloseTo(0, 5);
    expect(mid.yOff).toBeLessThan(plant.yOff); // up = more negative
  });

  it("keeps the bob within [-amp*BOB, 0] (never dips below ground)", () => {
    for (let p = 0; p < Math.PI * 4; p += 0.31) {
      const t = enemyWalkTransform(p);
      expect(t.yOff).toBeLessThanOrEqual(0.0001);
      expect(t.yOff).toBeGreaterThanOrEqual(-5.0001);
    }
  });

  it("squashes (scaleY<1) and stretches (scaleX>1) at foot-plant, neutral mid-swing", () => {
    const plant = enemyWalkTransform(0);
    expect(plant.scaleMulY).toBeLessThan(1);
    expect(plant.scaleMulX).toBeGreaterThan(1);
    const mid = enemyWalkTransform(Math.PI / 2);
    expect(mid.scaleMulY).toBeCloseTo(1, 5);
    expect(mid.scaleMulX).toBeCloseTo(1, 5);
  });

  it("scales every amplitude by the amp option", () => {
    const a1 = enemyWalkTransform(0.4, { amp: 1 });
    const a2 = enemyWalkTransform(0.4, { amp: 2 });
    expect(a2.yOff).toBeCloseTo(a1.yOff * 2, 5);
    expect(a2.xOff).toBeCloseTo(a1.xOff * 2, 5);
  });

  it("exposes liftNorm in [0,1] equal to |sin(phase)| (decoupled shadow cue)", () => {
    expect(enemyWalkTransform(0).liftNorm).toBeCloseTo(0, 5);
    expect(enemyWalkTransform(Math.PI / 2).liftNorm).toBeCloseTo(1, 5);
    expect(enemyWalkTransform(2.0).liftNorm).toBeCloseTo(Math.abs(Math.sin(2.0)), 5);
  });

  it("adds the lean option to angle and stays finite everywhere", () => {
    const noLean = enemyWalkTransform(0.7, { amp: 1 });
    const leaned = enemyWalkTransform(0.7, { amp: 1, lean: 2 });
    expect(leaned.angle).toBeCloseTo(noLean.angle + 2, 5);
    for (let p = -10; p < 10; p += 0.13) {
      const t = enemyWalkTransform(p, { amp: 0.6, lean: -2 });
      for (const v of [t.yOff, t.xOff, t.angle, t.scaleMulX, t.scaleMulY, t.liftNorm])
        expect(Number.isFinite(v)).toBe(true);
    }
  });
});
