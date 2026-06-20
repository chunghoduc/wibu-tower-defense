import { describe, it, expect } from "vitest";
import { poseSkeleton } from "../src/data/heroSkeletonAnim.ts";

describe("heroSkeletonAnim", () => {
  it("idle holds the limbs still and bobs gently", () => {
    const p = poseSkeleton("idle", 0);
    expect(p.deltas.thighL ?? 0).toBeCloseTo(0, 6);
    expect(p.deltas.thighR ?? 0).toBeCloseTo(0, 6);
    expect(typeof p.bob).toBe("number");
  });

  it("walk swings the thighs in antiphase", () => {
    const a = poseSkeleton("walk", Math.PI / 2); // sin = 1
    expect(Math.sign(a.deltas.thighL!)).toBe(-Math.sign(a.deltas.thighR!));
    expect(Math.abs(a.deltas.thighL!)).toBeGreaterThan(2);
  });

  it("walk counter-swings the off (non-weapon) arm against the legs", () => {
    const a = poseSkeleton("walk", Math.PI / 2);
    expect(Math.sign(a.deltas.armUpperL!)).toBe(-Math.sign(a.deltas.thighL!));
  });

  it("a stopped phase holds a fixed pose (deterministic in phase)", () => {
    const a = poseSkeleton("walk", 1.234);
    const b = poseSkeleton("walk", 1.234);
    expect(a.deltas.thighL).toBe(b.deltas.thighL);
  });

  it("attack timeline starts and ends near rest on the weapon arm", () => {
    const start = poseSkeleton("attack", 0);
    const end = poseSkeleton("attack", 1);
    expect(Math.abs(start.deltas.armUpperR ?? 0)).toBeLessThan(6);
    expect(Math.abs(end.deltas.armUpperR ?? 0)).toBeLessThan(10);
    const mid = poseSkeleton("attack", 0.5);
    expect(Math.abs(mid.deltas.armUpperR!)).toBeGreaterThan(Math.abs(start.deltas.armUpperR ?? 0));
  });

  it("hurt recoils the torso", () => {
    const p = poseSkeleton("hurt", 0.2);
    expect(p.deltas.torso ?? 0).not.toBe(0);
  });
});
