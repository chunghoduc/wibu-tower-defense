import { describe, expect, it } from "vitest";
import { boxOdds } from "../src/core/boxes.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../src/data/materials.ts";

describe("wing materials drop from boss chests", () => {
  it("every tier can drop a Feather, weighted up by tier", () => {
    const chance = (t: number) =>
      boxOdds(`boss-box-t${t}`).bonusMaterials.find((b) => b.id === FEATHER)?.chance ?? 0;
    expect(chance(1)).toBeGreaterThan(0);
    expect(chance(5)).toBeGreaterThan(chance(1));
  });
  it("Jewel of Chaos drops, rarer and weighted to higher tiers", () => {
    const chance = (t: number) =>
      boxOdds(`boss-box-t${t}`).bonusMaterials.find((b) => b.id === JEWEL_OF_CHAOS)?.chance ?? 0;
    expect(chance(1)).toBeGreaterThan(0);
    expect(chance(5)).toBeGreaterThan(chance(1));
    for (const t of [1, 2, 3, 4, 5]) {
      const feather = boxOdds(`boss-box-t${t}`).bonusMaterials.find((b) => b.id === FEATHER)!.chance;
      expect(chance(t)).toBeLessThan(feather);
    }
  });
});
