import { describe, it, expect } from "vitest";
import {
  FRAME_COUNTS,
  LOOPING_STATES,
  heroWeaponFrame,
} from "../src/data/heroWeaponFrames.ts";
import type { WeaponMotionState } from "../src/data/heroWeaponMotion.ts";

const STATES: WeaponMotionState[] = ["idle", "walk", "attack", "hurt", "cast"];

describe("FRAME_COUNTS", () => {
  it("meets the requested per-state frame minimums", () => {
    expect(FRAME_COUNTS.idle).toBeGreaterThanOrEqual(1);
    expect(FRAME_COUNTS.walk).toBeGreaterThanOrEqual(4);
    expect(FRAME_COUNTS.attack).toBeGreaterThanOrEqual(4);
    expect(FRAME_COUNTS.hurt).toBeGreaterThanOrEqual(2);
    expect(FRAME_COUNTS.cast).toBeGreaterThanOrEqual(4);
  });
});

describe("heroWeaponFrame", () => {
  it("starts at frame 0 at phase 0 for every state", () => {
    for (const s of STATES) expect(heroWeaponFrame(s, 0)).toBe(0);
  });

  it("returns indices strictly inside [0, count) for any phase", () => {
    for (const s of STATES) {
      const n = FRAME_COUNTS[s];
      for (let p = 0; p <= 1.0001; p += 0.017) {
        const f = heroWeaponFrame(s, p);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(n);
        expect(Number.isInteger(f)).toBe(true);
      }
    }
  });

  it("advances through every frame across the phase span", () => {
    for (const s of STATES) {
      const seen = new Set<number>();
      for (let p = 0; p < 1; p += 0.01) seen.add(heroWeaponFrame(s, p));
      expect(seen.size).toBe(FRAME_COUNTS[s]);
    }
  });

  it("looping states wrap (phase 1 == phase 0), one-shots clamp to last frame", () => {
    for (const s of STATES) {
      if (LOOPING_STATES.has(s)) {
        expect(heroWeaponFrame(s, 1)).toBe(heroWeaponFrame(s, 0));
        // and past 1 keeps wrapping rather than overflowing
        expect(heroWeaponFrame(s, 1.25)).toBe(heroWeaponFrame(s, 0.25));
      } else {
        expect(heroWeaponFrame(s, 1)).toBe(FRAME_COUNTS[s] - 1);
        expect(heroWeaponFrame(s, 2)).toBe(FRAME_COUNTS[s] - 1);
      }
    }
  });

  it("clamps negative phase to frame 0", () => {
    for (const s of STATES) expect(heroWeaponFrame(s, -0.5)).toBe(0);
  });

  it("walk reaches its final frame just before the loop point", () => {
    expect(heroWeaponFrame("walk", 0.99)).toBe(FRAME_COUNTS.walk - 1);
  });
});
