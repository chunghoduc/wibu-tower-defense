import { describe, it, expect } from "vitest";
import { legPuppet, legWorldPos } from "../src/scenes/legPuppet.ts";

const TWO_PI = Math.PI * 2;

describe("legPuppet", () => {
  it("the two legs run a half-cycle out of phase (alternating step)", () => {
    // right leg at phase p equals left leg at phase p+π
    for (const p of [0, 0.5, 1.3, 2.0, 5.1]) {
      const a = legPuppet(p);
      const b = legPuppet(p + Math.PI);
      expect(a.right.liftY).toBeCloseTo(b.left.liftY, 6);
      expect(a.right.swingX).toBeCloseTo(b.left.swingX, 6);
    }
  });

  it("each foot lifts off the ground at some point in the cycle (liftY < 0)", () => {
    let minLeft = 0;
    for (let i = 0; i < 64; i++)
      minLeft = Math.min(minLeft, legPuppet((i / 64) * TWO_PI).left.liftY);
    expect(minLeft).toBeLessThan(-2); // clearly airborne, not a sub-pixel wiggle
  });

  it("a foot is planted (liftY ~ 0) at the bottom of its swing", () => {
    // left foot plants near phase 0 / π (sin = 0) and lifts mid-swing
    expect(legPuppet(0).left.liftY).toBeCloseTo(0, 5);
    expect(legPuppet(0).left.planted).toBe(true);
    expect(legPuppet(Math.PI / 2).left.planted).toBe(false);
  });

  it("at any instant at least one foot is on the ground (no full hop)", () => {
    for (let i = 0; i < 64; i++) {
      const { left, right } = legPuppet((i / 64) * TWO_PI);
      expect(left.planted || right.planted).toBe(true);
    }
  });

  it("is continuous/periodic across the 0/2π seam", () => {
    const a = legPuppet(1e-6);
    const b = legPuppet(TWO_PI - 1e-6);
    expect(a.left.liftY).toBeCloseTo(b.left.liftY, 3);
    expect(a.left.swingX).toBeCloseTo(b.left.swingX, 3);
  });

  it("amp scales lift and swing up monotonically", () => {
    const small = legPuppet(Math.PI / 2, { amp: 0.5 });
    const big = legPuppet(Math.PI / 2, { amp: 1.5 });
    expect(Math.abs(big.left.liftY)).toBeGreaterThan(Math.abs(small.left.liftY));
    expect(Math.abs(big.left.swingX)).toBeGreaterThan(Math.abs(small.left.swingX));
  });

  it("legWorldPos: a lifted foot sits higher (smaller y) than a planted one", () => {
    const pose = legPuppet(Math.PI / 2); // left lifted, right planted
    const bodyY = 300;
    const left = legWorldPos({ x: 100, y: bodyY }, pose.left);
    const right = legWorldPos({ x: 100, y: bodyY }, pose.right);
    expect(left.y).toBeLessThan(right.y); // lifted leg drawn higher up
    expect(left.x).not.toBeCloseTo(right.x, 1); // and swung apart
  });
});
