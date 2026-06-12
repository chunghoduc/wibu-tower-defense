import { describe, it, expect } from "vitest";
import { enemyWalkTransform } from "../src/scenes/enemyWalkTransform.ts";

// The enemy walk is driven PURELY by this procedural transform on a single
// static SDXL sprite (there are no authored/baked walk frames). For the gait to
// read as a real, lively walk — not a sprite sliding/"floating" along the lane —
// each step must visibly lift the body, sway laterally, rock, and squash on the
// foot-plant. These thresholds guard against the motion being damped back to the
// near-imperceptible amplitudes that made enemies look like they float.
const TWO_PI = Math.PI * 2;

function cycleExtents(amp = 1) {
  let maxLift = 0,
    maxSway = 0,
    minScaleY = 1,
    maxScaleX = 1,
    maxLiftNorm = 0;
  for (let p = 0; p <= TWO_PI; p += 0.05) {
    const t = enemyWalkTransform(p, { amp });
    maxLift = Math.max(maxLift, -t.yOff); // yOff <= 0; lift is positive
    maxSway = Math.max(maxSway, Math.abs(t.xOff));
    minScaleY = Math.min(minScaleY, t.scaleMulY); // squash dips below 1
    maxScaleX = Math.max(maxScaleX, t.scaleMulX); // stretch rises above 1
    maxLiftNorm = Math.max(maxLiftNorm, t.liftNorm);
  }
  return { maxLift, maxSway, minScaleY, maxScaleX, maxLiftNorm };
}

describe("enemyWalkTransform — lively gait", () => {
  it("lifts the body a clearly visible amount each step (no floating slide)", () => {
    expect(cycleExtents().maxLift).toBeGreaterThanOrEqual(4);
  });

  it("sways laterally (waddle) by a perceptible amount", () => {
    expect(cycleExtents().maxSway).toBeGreaterThanOrEqual(2);
  });

  it("squashes on the foot-plant (scaleY dips, scaleX bulges)", () => {
    const e = cycleExtents();
    expect(e.minScaleY).toBeLessThanOrEqual(0.9);
    expect(e.maxScaleX).toBeGreaterThanOrEqual(1.07);
  });

  it("the contact phase (sin=0) plants the foot: full squash, no lift", () => {
    const planted = enemyWalkTransform(0); // sin(0)=0 → fully planted
    expect(planted.yOff).toBeCloseTo(0, 6); // grounded
    expect(planted.liftNorm).toBeCloseTo(0, 6);
    expect(planted.scaleMulY).toBeLessThan(1); // squashed under the weight
  });

  it("liftNorm spans roughly 0..1 across a stride (drives the ground shadow)", () => {
    const e = cycleExtents();
    expect(e.maxLiftNorm).toBeGreaterThan(0.95);
  });

  it("amplitude scales the gait (heavier/lighter units)", () => {
    expect(cycleExtents(0.6).maxLift).toBeLessThan(cycleExtents(1).maxLift);
  });

  it("all outputs finite over a full cycle", () => {
    for (let p = 0; p <= TWO_PI; p += 0.1) {
      const t = enemyWalkTransform(p, { amp: 1, lean: 2 });
      for (const v of [t.yOff, t.xOff, t.angle, t.scaleMulX, t.scaleMulY, t.liftNorm])
        expect(Number.isFinite(v)).toBe(true);
    }
  });
});
