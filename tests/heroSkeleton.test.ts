import { describe, it, expect } from "vitest";
import { BONES, resolveSkeleton, type BoneId } from "../src/data/heroSkeleton.ts";

const SIZE = 100;
const noDelta = {};

describe("heroSkeleton", () => {
  it("lists every bone parent-before-child", () => {
    const seen = new Set<BoneId>();
    for (const b of BONES) {
      if (b.parent) expect(seen.has(b.parent)).toBe(true);
      seen.add(b.id);
    }
    expect(seen.has("pelvis")).toBe(true);
    expect(seen.size).toBe(BONES.length);
  });

  it("resolves head above pelvis above feet (local y increases downward)", () => {
    const x = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    expect(x.head.y).toBeLessThan(x.pelvis.y);
    expect(x.pelvis.y).toBeLessThan(x.footL.y);
    expect(x.pelvis.y).toBeLessThan(x.footR.y);
  });

  it("centers the spine and splits limbs left/right at rest", () => {
    const x = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    expect(Math.abs(x.pelvis.x)).toBeLessThan(1e-6);
    expect(x.handL.x).toBeLessThan(0);
    expect(x.handR.x).toBeGreaterThan(0);
    expect(x.footL.x).toBeLessThan(0);
    expect(x.footR.x).toBeGreaterThan(0);
  });

  it("shifts every bone by hover", () => {
    const a = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    const b = resolveSkeleton({ size: SIZE, hover: -10, facing: 1, deltas: noDelta });
    for (const id of Object.keys(a) as BoneId[]) {
      expect(b[id].y).toBeCloseTo(a[id].y - 10, 6);
      expect(b[id].x).toBeCloseTo(a[id].x, 6);
    }
  });

  it("mirrors x and negates angle when facing left", () => {
    const r = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: { armUpperR: 30 } });
    const l = resolveSkeleton({ size: SIZE, hover: 0, facing: -1, deltas: { armUpperR: 30 } });
    expect(l.handR.x).toBeCloseTo(-r.handR.x, 6);
    expect(l.handR.angle).toBeCloseTo(-r.handR.angle, 6);
  });

  it("propagates a parent rotation to children (FK)", () => {
    const rest = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: noDelta });
    const bent = resolveSkeleton({ size: SIZE, hover: 0, facing: 1, deltas: { thighR: 40 } });
    expect(bent.footR.x).not.toBeCloseTo(rest.footR.x, 3);
    expect(bent.footL.x).toBeCloseTo(rest.footL.x, 6);
  });
});
