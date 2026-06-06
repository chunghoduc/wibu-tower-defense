import { describe, expect, it } from "vitest";
import { selectTarget, type Targetable } from "../src/core/targeting.ts";

function mob(over: Partial<Targetable>): Targetable {
  return { pos: { x: 0, y: 0 }, threat: 0, flying: false, alive: true, ...over };
}

describe("selectTarget", () => {
  const from = { x: 0, y: 0 };
  const filter = { canHitGround: true, canHitAir: true };

  it("picks the highest-threat enemy in range", () => {
    const a = mob({ pos: { x: 10, y: 0 }, threat: 0.2 });
    const b = mob({ pos: { x: 20, y: 0 }, threat: 0.8 });
    expect(selectTarget(from, 100, [a, b], filter)).toBe(b);
  });

  it("ignores enemies out of range", () => {
    const far = mob({ pos: { x: 500, y: 0 }, threat: 0.9 });
    const near = mob({ pos: { x: 10, y: 0 }, threat: 0.1 });
    expect(selectTarget(from, 100, [far, near], filter)).toBe(near);
  });

  it("ignores dead enemies", () => {
    const dead = mob({ pos: { x: 5, y: 0 }, threat: 0.9, alive: false });
    expect(selectTarget(from, 100, [dead], filter)).toBeNull();
  });

  it("respects ground/air targeting filters", () => {
    const flyer = mob({ pos: { x: 10, y: 0 }, threat: 0.9, flying: true });
    const groundOnly = { canHitGround: true, canHitAir: false };
    expect(selectTarget(from, 100, [flyer], groundOnly)).toBeNull();
    expect(selectTarget(from, 100, [flyer], { canHitGround: false, canHitAir: true })).toBe(flyer);
  });
});
