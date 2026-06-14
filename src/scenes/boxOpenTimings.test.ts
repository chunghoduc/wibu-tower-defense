import { describe, it, expect } from "vitest";
import { boxOpenTimings } from "./boxOpenTimings.ts";

describe("boxOpenTimings", () => {
  it("arms tap-to-close only after every reward tile has finished revealing", () => {
    // The reported bug: the overlay armed close at a fixed 1050ms, before the
    // reveal tiles animate in, so an early tap dismissed it unseen. Whatever the
    // reward count, close must never arm before the last tile settles.
    for (const n of [1, 2, 3, 4, 5, 8]) {
      const t = boxOpenTimings(n);
      expect(t.armCloseMs).toBeGreaterThanOrEqual(t.lastTileEndMs);
    }
  });

  it("arms close strictly after the reveal starts and the chest pops", () => {
    const t = boxOpenTimings(3);
    expect(t.popMs).toBeLessThan(t.revealMs);
    expect(t.armCloseMs).toBeGreaterThan(t.revealMs);
  });

  it("fixes the old 1050ms early-arm regression for a typical drop", () => {
    // A boss chest drops gold + an item (>=2 entries); the old fixed 1050ms
    // arm fired mid-reveal. The new arm must sit well past it.
    expect(boxOpenTimings(2).armCloseMs).toBeGreaterThan(1050);
  });

  it("pushes the close-arm later as more rewards stagger in (monotonic)", () => {
    expect(boxOpenTimings(5).armCloseMs).toBeGreaterThan(boxOpenTimings(2).armCloseMs);
  });

  it("never divides by zero / underflows for an empty reveal", () => {
    const t = boxOpenTimings(0);
    expect(t.armCloseMs).toBeGreaterThanOrEqual(t.revealMs);
    expect(Number.isFinite(t.armCloseMs)).toBe(true);
  });
});
