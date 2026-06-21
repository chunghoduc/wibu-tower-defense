import { describe, it, expect } from "vitest";
import { heroWeaponMotion } from "../src/data/heroWeaponMotion.ts";

const SIZE = 54;

describe("heroWeaponMotion", () => {
  it("idle is near-rest: tiny bob, stance pose, full alpha, no tint", () => {
    const m = heroWeaponMotion("idle", 0.5, SIZE, 1);
    expect(Math.abs(m.dx)).toBeLessThan(SIZE * 0.05);
    expect(Math.abs(m.dy)).toBeLessThan(SIZE * 0.08);
    expect(m.useAttackPose).toBe(false);
    expect(m.tint).toBeNull();
    expect(m.alpha).toBe(1);
  });

  it("walk bobs vertically and uses the stance pose", () => {
    const lo = heroWeaponMotion("walk", 0, SIZE, 1);
    const hi = heroWeaponMotion("walk", 0.25, SIZE, 1);
    expect(hi.dy).not.toBeCloseTo(lo.dy, 5); // there is vertical motion across phase
    expect(hi.useAttackPose).toBe(false);
  });

  it("attack lunges forward (facing-signed) and uses the attack pose", () => {
    const mid = heroWeaponMotion("attack", 0.4, SIZE, 1);
    const midL = heroWeaponMotion("attack", 0.4, SIZE, -1);
    expect(mid.useAttackPose).toBe(true);
    expect(mid.dx).toBeGreaterThan(0); // lunge toward facing (+1 = right)
    expect(midL.dx).toBeLessThan(0); // mirror when facing left
  });

  it("attack lunge returns to ~0 at the end of the window", () => {
    const end = heroWeaponMotion("attack", 1, SIZE, 1);
    expect(Math.abs(end.dx)).toBeLessThan(SIZE * 0.03);
  });

  it("hurt knocks back against facing and flashes a red tint early", () => {
    const early = heroWeaponMotion("hurt", 0.05, SIZE, 1);
    expect(early.dx).toBeLessThan(0); // pushed back (away from +1 facing)
    expect(early.tint).not.toBeNull();
    expect(early.useAttackPose).toBe(false);
  });

  it("hurt recovers: knockback and tint fade out by the end", () => {
    const end = heroWeaponMotion("hurt", 1, SIZE, 1);
    expect(Math.abs(end.dx)).toBeLessThan(SIZE * 0.03);
    expect(end.tint).toBeNull();
  });

  it("cast rises and uses the attack pose", () => {
    const mid = heroWeaponMotion("cast", 0.5, SIZE, 1);
    expect(mid.dy).toBeLessThan(0); // rises up (negative y)
    expect(mid.useAttackPose).toBe(true);
  });

  it("scales offsets with size", () => {
    const small = heroWeaponMotion("attack", 0.4, 40, 1);
    const big = heroWeaponMotion("attack", 0.4, 80, 1);
    expect(Math.abs(big.dx)).toBeGreaterThan(Math.abs(small.dx));
  });
});
