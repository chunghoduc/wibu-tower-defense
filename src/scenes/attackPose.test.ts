import { describe, it, expect } from "vitest";
import {
  ENGAGED_MS,
  POSE_FILL_BOOST,
  POSE_ORIGIN_Y,
  IDLE_ORIGIN_Y,
  isEngaged,
  towerDisplayScale,
} from "./attackPose.ts";

describe("attackPose", () => {
  it("engaged window outlasts the ~1s attack cadence", () => {
    expect(ENGAGED_MS).toBeGreaterThan(1000);
  });
  it("isEngaged is true until engagedUntil passes", () => {
    expect(isEngaged(1500, 1000)).toBe(true);
    expect(isEngaged(1000, 1000)).toBe(false);
    expect(isEngaged(0, 1000)).toBe(false);
  });
  it("idle scale fits a 192 frame to ~50px at level 0", () => {
    expect(towerDisplayScale(192, 0, false)).toBeCloseTo(50 / 192, 5);
  });
  it("posed scale boosts to compensate the pose's larger margin", () => {
    expect(towerDisplayScale(320, 0, true)).toBeCloseTo((50 * POSE_FILL_BOOST) / 320, 5);
  });
  it("upgrade level grows both idle and posed scale by 5% per level", () => {
    expect(towerDisplayScale(192, 4, false)).toBeCloseTo((50 / 192) * 1.2, 5);
  });
  it("pose feet sit lower in frame than the idle origin", () => {
    expect(POSE_ORIGIN_Y).toBeGreaterThan(IDLE_ORIGIN_Y);
  });
});
