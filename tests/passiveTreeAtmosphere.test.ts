import { describe, it, expect } from "vitest";
import {
  buildPassiveTreeAtmosphere,
  starTwinkle,
  nebulaPulse,
  type RegionCenter,
} from "../src/scenes/passiveTreeAtmosphere.ts";
import type { Bounds } from "../src/scenes/passiveTreeCamera.ts";

const BOUNDS: Bounds = { minX: -200, minY: -150, maxX: 800, maxY: 700 };
const CENTERS: RegionCenter[] = [
  { region: "brawler", x: 100, y: 50, color: 0xff7043 },
  { region: "arcane", x: 600, y: 400, color: 0xce93d8 },
  { region: "warden", x: 300, y: 600, color: 0x66bb6a },
];

describe("buildPassiveTreeAtmosphere", () => {
  it("is deterministic for a given seed", () => {
    const a = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 7);
    const b = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 7);
    expect(a).toEqual(b);
  });

  it("differs across seeds", () => {
    const a = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 1);
    const b = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 2);
    expect(a.stars).not.toEqual(b.stars);
  });

  it("emits one nebula per region center, tinted to match", () => {
    const spec = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 3);
    expect(spec.nebulae).toHaveLength(CENTERS.length);
    for (const c of CENTERS) {
      const neb = spec.nebulae.find((n) => n.region === c.region);
      expect(neb).toBeDefined();
      expect(neb!.color).toBe(c.color);
      // centered on (near) its region's node centroid
      expect(Math.abs(neb!.x - c.x)).toBeLessThan(60);
      expect(Math.abs(neb!.y - c.y)).toBeLessThan(60);
    }
  });

  it("scatters stars strictly within the bounds", () => {
    const spec = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 5);
    expect(spec.stars.length).toBeGreaterThan(60);
    for (const s of spec.stars) {
      expect(s.x).toBeGreaterThanOrEqual(BOUNDS.minX);
      expect(s.x).toBeLessThanOrEqual(BOUNDS.maxX);
      expect(s.y).toBeGreaterThanOrEqual(BOUNDS.minY);
      expect(s.y).toBeLessThanOrEqual(BOUNDS.maxY);
    }
  });

  it("builds gradient bands spanning the full vertical extent", () => {
    const spec = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 9);
    expect(spec.bands.length).toBeGreaterThan(2);
    const top = Math.min(...spec.bands.map((b) => b.y));
    const bottom = Math.max(...spec.bands.map((b) => b.y + b.h));
    expect(top).toBeLessThanOrEqual(BOUNDS.minY + 1);
    expect(bottom).toBeGreaterThanOrEqual(BOUNDS.maxY - 1);
  });
});

describe("animation helpers stay normalized", () => {
  it("starTwinkle in [0,1] across a time sweep", () => {
    const spec = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 4);
    const star = spec.stars[0];
    for (let t = 0; t < 20; t += 0.13) {
      const a = starTwinkle(star, t);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it("nebulaPulse in [0,1] across a time sweep", () => {
    const spec = buildPassiveTreeAtmosphere(BOUNDS, CENTERS, 6);
    const neb = spec.nebulae[0];
    for (let t = 0; t < 20; t += 0.17) {
      const p = nebulaPulse(neb, t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
