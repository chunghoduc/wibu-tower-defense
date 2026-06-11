import { describe, it, expect } from "vitest";
import { auraRadiusOf, auraPulse, AURA_RING_COLOR } from "../src/core/auraIndicator.ts";
import type { TowerRuntime } from "../src/core/battleTypes.ts";

// Minimal TowerRuntime stub — only the fields auraRadiusOf reads.
function tower(role: string, buffAura?: { radius: number; atkPct?: number; attackSpeedPct?: number }): TowerRuntime {
  return {
    def: { role } as TowerRuntime["def"],
    behavior: { buffAura } as TowerRuntime["behavior"],
  } as TowerRuntime;
}

describe("auraRadiusOf", () => {
  it("returns the radius for a support tower with a positive-radius buffAura", () => {
    expect(auraRadiusOf(tower("support", { radius: 150, atkPct: 0.1 }))).toBe(150);
  });

  it("returns null for a non-support role even with a buffAura", () => {
    expect(auraRadiusOf(tower("damage", { radius: 150, atkPct: 0.1 }))).toBeNull();
  });

  it("returns null when there is no buffAura", () => {
    expect(auraRadiusOf(tower("support", undefined))).toBeNull();
  });

  it("returns null for a non-positive radius", () => {
    expect(auraRadiusOf(tower("support", { radius: 0 }))).toBeNull();
  });

  it("reads the live (upgrade-scaled) radius, not a constant", () => {
    const t = tower("support", { radius: 150 });
    t.behavior.buffAura!.radius = 162; // sim mutates this on upgrade
    expect(auraRadiusOf(t)).toBe(162);
  });
});

describe("auraPulse", () => {
  it("stays within [0, 1] across a time sweep", () => {
    for (let ms = 0; ms < 10000; ms += 137) {
      const p = auraPulse(ms, 3);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("de-syncs different towers (different uids differ at some time)", () => {
    const differs = [0, 500, 1000, 1500].some((ms) => auraPulse(ms, 1) !== auraPulse(ms, 7));
    expect(differs).toBe(true);
  });
});

describe("AURA_RING_COLOR", () => {
  it("is the aquamarine indicator color, distinct from gold 0xffd34d", () => {
    expect(AURA_RING_COLOR).toBe(0x66ffcc);
    expect(AURA_RING_COLOR).not.toBe(0xffd34d);
  });
});
