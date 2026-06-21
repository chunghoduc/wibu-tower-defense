import { describe, it, expect } from "vitest";
import { RARITIES, type Rarity } from "../src/data/schemaEnums.ts";
import { vfxPower, scaleCount, heroPowerRarity } from "../src/data/skillVfxPower.ts";

describe("skillVfxPower — rarity drives spectacle", () => {
  it("has a profile for every rarity", () => {
    for (const r of RARITIES) {
      const p = vfxPower(r);
      expect(p).toBeDefined();
      expect(p.waves).toBeGreaterThanOrEqual(1);
      expect(p.count).toBeGreaterThan(0);
    }
  });

  it("strictly escalates count / scale / duration / shake across the rarity ladder", () => {
    const tiers = RARITIES.map((r) => vfxPower(r));
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].count).toBeGreaterThan(tiers[i - 1].count);
      expect(tiers[i].scale).toBeGreaterThan(tiers[i - 1].scale);
      expect(tiers[i].duration).toBeGreaterThanOrEqual(tiers[i - 1].duration);
      expect(tiers[i].shake).toBeGreaterThanOrEqual(tiers[i - 1].shake);
      // tier index matches the rarity order
      expect(tiers[i].tier).toBe(i);
    }
  });

  it("adds more impact WAVES at higher rarity (monotonic, ≥1)", () => {
    const waves = RARITIES.map((r) => vfxPower(r).waves);
    for (let i = 1; i < waves.length; i++) {
      expect(waves[i]).toBeGreaterThanOrEqual(waves[i - 1]);
    }
    // Common is restrained; the apex is a multi-wave spectacle.
    expect(vfxPower("Common").waves).toBe(1);
    expect(vfxPower("Legendary").waves).toBeGreaterThanOrEqual(3);
  });

  it("reserves the grand flourish for Legendary and above", () => {
    expect(vfxPower("Common").grand).toBe(false);
    expect(vfxPower("Magic").grand).toBe(false);
    expect(vfxPower("Rare").grand).toBe(false);
    expect(vfxPower("Legendary").grand).toBe(true);
    expect(vfxPower("Unique").grand).toBe(true);
  });

  it("defaults missing rarity to the most restrained (Common) profile", () => {
    expect(vfxPower(undefined)).toEqual(vfxPower("Common"));
  });

  it("scaleCount never drops below the base and grows with power", () => {
    const common = vfxPower("Common");
    const legendary = vfxPower("Legendary");
    expect(scaleCount(8, common)).toBeGreaterThanOrEqual(8);
    expect(scaleCount(8, legendary)).toBeGreaterThan(scaleCount(8, common));
    // a single particle stays at least one even at Common
    expect(scaleCount(1, common)).toBeGreaterThanOrEqual(1);
  });

  it("maps hero level to a rising pseudo-rarity (low level = restrained, high = apex)", () => {
    const lvls: number[] = [1, 12, 30, 60, 100];
    const rarities = lvls.map((l) => heroPowerRarity(l));
    // each band must be no weaker than the previous
    const order = (r: Rarity) => RARITIES.indexOf(r);
    for (let i = 1; i < rarities.length; i++) {
      expect(order(rarities[i])).toBeGreaterThanOrEqual(order(rarities[i - 1]));
    }
    expect(heroPowerRarity(1)).toBe("Common");
    expect(heroPowerRarity(100)).toBe("Unique");
    // out-of-range levels clamp, never throw
    expect(heroPowerRarity(0)).toBe("Common");
    expect(heroPowerRarity(9999)).toBe("Unique");
  });
});
