import { describe, it, expect } from "vitest";
import { tierRewardPreview } from "./expeditionQuests.ts";
import { GOLD_TEX, GEM_TEX, materialTex } from "./assetKeys.ts";
import { RARITIES } from "./schemaEnums.ts";

describe("tierRewardPreview", () => {
  it("always leads with gold and caps at 5 icons", () => {
    for (const r of RARITIES) {
      const pv = tierRewardPreview(r);
      expect(pv.length).toBeGreaterThan(0);
      expect(pv.length).toBeLessThanOrEqual(5);
      expect(pv[0].iconKey).toBe(GOLD_TEX);
    }
  });

  it("gem-dropping tiers include the diamond icon", () => {
    for (const r of ["Magic", "Rare", "Legendary", "Unique"] as const) {
      expect(tierRewardPreview(r).some((v) => v.iconKey === GEM_TEX)).toBe(true);
    }
  });

  it("includes each tier's signature material", () => {
    expect(tierRewardPreview("Common").some((v) => v.iconKey === materialTex("bless-jewel"))).toBe(
      true,
    );
    expect(tierRewardPreview("Unique").some((v) => v.iconKey === materialTex("feather"))).toBe(
      true,
    );
    expect(
      tierRewardPreview("Legendary").some((v) => v.iconKey === materialTex("awakening-crystal")),
    ).toBe(true);
  });
});
