import { describe, expect, it } from "vitest";
import {
  TERRAIN_ART_TYPES,
  TERRAIN_VARIANTS,
  TERRAIN_ASSETS,
  terrainKeyFor,
} from "../src/data/terrainManifest.ts";

describe("terrain art manifest", () => {
  it("lists one asset per type × variant with unique keys and svg paths", () => {
    expect(TERRAIN_ASSETS.length).toBe(TERRAIN_ART_TYPES.length * TERRAIN_VARIANTS);
    const keys = new Set(TERRAIN_ASSETS.map((a) => a.key));
    expect(keys.size).toBe(TERRAIN_ASSETS.length);
    for (const a of TERRAIN_ASSETS) {
      expect(a.path).toBe(`assets/terrain/${a.type}-${a.variant}.svg`);
      expect(a.key).toBe(`terrain__${a.type}_${a.variant}`);
    }
  });

  it("picks a stable variant for a position and resolves to a real asset", () => {
    const k1 = terrainKeyFor("water", 123, 456);
    expect(terrainKeyFor("water", 123, 456)).toBe(k1); // deterministic
    expect(TERRAIN_ASSETS.some((a) => a.key === k1)).toBe(true);
  });

  it("keeps variants within range for every type across many positions", () => {
    for (const type of TERRAIN_ART_TYPES) {
      for (let i = 0; i < 50; i++) {
        const key = terrainKeyFor(type, i * 37, i * 91 + 5);
        const variant = Number(key.split("_").pop());
        expect(variant).toBeGreaterThanOrEqual(1);
        expect(variant).toBeLessThanOrEqual(TERRAIN_VARIANTS);
      }
    }
  });
});
