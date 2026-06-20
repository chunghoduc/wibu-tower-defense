import { describe, it, expect } from "vitest";
import { ATTACK_SPEED_CAP, cappedAttackSpeed } from "./attackSpeedCap.ts";

describe("attack-speed cap", () => {
  it("caps at 5 attacks per second", () => {
    expect(ATTACK_SPEED_CAP).toBe(5);
  });
  it("clamps values above the cap down to 5", () => {
    expect(cappedAttackSpeed(10)).toBe(5);
    expect(cappedAttackSpeed(5.0001)).toBe(5);
  });
  it("passes through values at or below the cap unchanged", () => {
    expect(cappedAttackSpeed(5)).toBe(5);
    expect(cappedAttackSpeed(2.3)).toBe(2.3);
    expect(cappedAttackSpeed(0)).toBe(0);
  });
  it("preserves non-positive values (the sim's <=0 guard still works)", () => {
    expect(cappedAttackSpeed(-1)).toBe(-1);
  });
});
