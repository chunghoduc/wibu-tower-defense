import { describe, it, expect } from "vitest";
import { resolveSkeleton } from "../src/data/heroSkeleton.ts";
import { weaponHold } from "../src/data/heroWeaponHold.ts";

const restBones = resolveSkeleton({ size: 100, hover: 0, facing: 1, deltas: {} });
const hand = restBones.handR;

describe("heroWeaponHold", () => {
  it("seats the grip at the weapon hand", () => {
    const h = weaponHold(hand, "Sword", 100, 1);
    expect(h.x).toBeCloseTo(hand.x);
    expect(h.y).toBeCloseTo(hand.y);
  });

  it("sizes the weapon to the body, not the arm (well under body height)", () => {
    const h = weaponHold(hand, "Sword", 100, 1);
    expect(h.displayH).toBeGreaterThan(20);
    expect(h.displayH).toBeLessThan(100); // never taller than the body
  });

  it("tilts the resting blade forward (positive angle) when the hand hangs at rest", () => {
    // Rest hand angle is ~0, so the weapon angle is the family tilt — leaning forward.
    expect(hand.angle).toBeCloseTo(0);
    const h = weaponHold(hand, "Sword", 100, 1);
    expect(h.angle).toBeGreaterThan(0);
  });

  it("follows the arm: a swung hand swings the weapon with it", () => {
    const swung = resolveSkeleton({
      size: 100,
      hover: 0,
      facing: 1,
      deltas: { armUpperR: 70, handR: 28 },
    });
    const rest = weaponHold(hand, "Sword", 100, 1);
    const mid = weaponHold(swung.handR, "Sword", 100, 1);
    expect(mid.angle).toBeGreaterThan(rest.angle + 40); // big rotation as the arm rises
    expect(Math.hypot(mid.x - rest.x, mid.y - rest.y)).toBeGreaterThan(5); // and translates
  });

  it("mirrors origin and flips for left facing", () => {
    const left = resolveSkeleton({ size: 100, hover: 0, facing: -1, deltas: {} });
    const h = weaponHold(left.handR, "Sword", 100, -1);
    expect(h.flipX).toBe(true);
    const right = weaponHold(hand, "Sword", 100, 1);
    expect(h.originX).toBeCloseTo(1 - right.originX);
  });

  it("falls back to Any for a null weapon type without throwing", () => {
    const h = weaponHold(hand, null, 100, 1);
    expect(h.displayH).toBeGreaterThan(0);
    expect(Number.isFinite(h.angle)).toBe(true);
  });
});
