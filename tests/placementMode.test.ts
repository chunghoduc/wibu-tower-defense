import { describe, it, expect } from "vitest";
import {
  emptyPlacement,
  armPlacement,
  disarmPlacement,
  isArmed,
  resolveFieldTap,
} from "../src/core/placementMode.ts";

describe("placementMode", () => {
  it("starts unarmed", () => {
    expect(isArmed(emptyPlacement())).toBe(false);
    expect(emptyPlacement().armedId).toBe(null);
  });

  it("arms a tower id", () => {
    const s = armPlacement(emptyPlacement(), "yamo");
    expect(isArmed(s)).toBe(true);
    expect(s.armedId).toBe("yamo");
  });

  it("re-arming the SAME id toggles back to unarmed", () => {
    const s = armPlacement(armPlacement(emptyPlacement(), "yamo"), "yamo");
    expect(isArmed(s)).toBe(false);
  });

  it("arming a DIFFERENT id swaps the armed tower", () => {
    const s = armPlacement(armPlacement(emptyPlacement(), "yamo"), "pip");
    expect(s.armedId).toBe("pip");
  });

  it("disarm clears", () => {
    expect(isArmed(disarmPlacement(armPlacement(emptyPlacement(), "yamo")))).toBe(false);
  });

  it("resolveFieldTap is idle when unarmed", () => {
    expect(resolveFieldTap(emptyPlacement(), { canPlace: true, affordable: true })).toBe("idle");
  });

  it("resolveFieldTap places when armed + valid + affordable", () => {
    const s = armPlacement(emptyPlacement(), "yamo");
    expect(resolveFieldTap(s, { canPlace: true, affordable: true })).toBe("place");
  });

  it("resolveFieldTap is blocked when armed but invalid or unaffordable", () => {
    const s = armPlacement(emptyPlacement(), "yamo");
    expect(resolveFieldTap(s, { canPlace: false, affordable: true })).toBe("blocked");
    expect(resolveFieldTap(s, { canPlace: true, affordable: false })).toBe("blocked");
  });
});
