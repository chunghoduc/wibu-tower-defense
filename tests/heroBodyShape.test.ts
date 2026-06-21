import { describe, it, expect } from "vitest";
import { resolveSkeleton } from "../src/data/heroSkeleton.ts";
import { heroBodyShape } from "../src/data/heroBodyShape.ts";

const bones = resolveSkeleton({ size: 100, hover: 0, facing: 1, deltas: {} });

describe("heroBodyShape", () => {
  it("emits a solid torso polygon, limb capsules and a head disc", () => {
    const s = heroBodyShape({ bones, size: 100, cover: {} });
    expect(s.polys.length).toBeGreaterThanOrEqual(1);
    expect(s.polys[0].points).toHaveLength(8); // a quad
    // 2 legs + 2 arms + 1 neck.
    expect(s.capsules.length).toBe(5);
    // head disc present.
    const headR = 100 * 0.13;
    expect(s.discs.some((d) => Math.abs(d.r - headR) < 1e-6)).toBe(true);
  });

  it("bridges the neck so there is no skin gap below the head", () => {
    const s = heroBodyShape({ bones, size: 100, cover: {} });
    // The neck is the last capsule (legs, arms, then neck) and reaches from the
    // shoulders up to the head.
    const neck = s.capsules[s.capsules.length - 1];
    expect(neck.by).toBeLessThan(bones.torso.y); // top end near the head
    expect(neck.ay).toBeGreaterThan(neck.by); // bottom end at the shoulders
  });

  it("drops the head disc when the head is covered (helmet)", () => {
    const bare = heroBodyShape({ bones, size: 100, cover: {} });
    const covered = heroBodyShape({ bones, size: 100, cover: { head: true } });
    expect(covered.discs.length).toBeLessThan(bare.discs.length);
  });

  it("drops the legs when covered", () => {
    const bare = heroBodyShape({ bones, size: 100, cover: {} });
    const covered = heroBodyShape({ bones, size: 100, cover: { legs: true } });
    expect(covered.capsules.length).toBeLessThan(bare.capsules.length);
  });

  it("places the contact shadow at the feet, below the body", () => {
    const s = heroBodyShape({ bones, size: 100, cover: {} });
    expect(s.shadow.y).toBeGreaterThan(bones.footL.y);
    expect(s.shadow.rx).toBeGreaterThan(s.shadow.ry); // a flat ellipse
  });

  it("gives a non-zero outline width", () => {
    const s = heroBodyShape({ bones, size: 100, cover: {} });
    expect(s.outline.width).toBeGreaterThan(0);
  });
});
