import { describe, expect, it } from "vitest";
import { selectTarget, type Targetable } from "../src/core/targeting.ts";

function mob(over: Partial<Targetable>): Targetable {
  return {
    pos: { x: 0, y: 0 },
    threat: 0,
    flying: false,
    alive: true,
    stealth: false,
    revealed: true,
    ...over,
  };
}

describe("selectTarget", () => {
  const from = { x: 0, y: 0 };
  const filter = { canHitGround: true, canHitAir: true, seeStealth: true };

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
    const groundOnly = { canHitGround: true, canHitAir: false, seeStealth: true };
    expect(selectTarget(from, 100, [flyer], groundOnly)).toBeNull();
    expect(
      selectTarget(from, 100, [flyer], { canHitGround: false, canHitAir: true, seeStealth: true }),
    ).toBe(flyer);
  });

  it("towers cannot see stealthed enemies but the hero can", () => {
    const ghost = mob({ pos: { x: 10, y: 0 }, threat: 0.9, stealth: true, revealed: false });
    const towerFilter = { canHitGround: true, canHitAir: true, seeStealth: false };
    expect(selectTarget(from, 100, [ghost], towerFilter)).toBeNull();
    expect(selectTarget(from, 100, [ghost], filter)).toBe(ghost);
  });

  it("towers CAN hit a stealthed enemy once it is revealed (T9)", () => {
    const towerFilter = { canHitGround: true, canHitAir: true, seeStealth: false };
    const hidden = mob({ pos: { x: 10, y: 0 }, threat: 0.9, stealth: true, revealed: false });
    expect(selectTarget(from, 100, [hidden], towerFilter)).toBeNull();
    const revealed = mob({ pos: { x: 10, y: 0 }, threat: 0.9, stealth: true, revealed: true });
    expect(selectTarget(from, 100, [revealed], towerFilter)).toBe(revealed);
  });
});
