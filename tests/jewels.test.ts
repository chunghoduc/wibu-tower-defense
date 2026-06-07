import { describe, expect, it } from "vitest";
import { JEWEL_CATALOG, JEWEL_CATALOG_MAP, jewelStatBag } from "../src/data/jewels.ts";
import { RARITIES } from "../src/data/schema.ts";

describe("JEWEL_CATALOG", () => {
  it("contains exactly 50 jewels", () => {
    expect(JEWEL_CATALOG.length).toBe(50);
  });

  it("has no duplicate ids", () => {
    const ids = JEWEL_CATALOG.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every jewel has a valid rarity and a name", () => {
    for (const j of JEWEL_CATALOG) {
      expect(RARITIES.includes(j.rarity), j.id).toBe(true);
      expect(j.name.trim().length, j.id).toBeGreaterThan(0);
    }
  });

  it("every jewel carries at least one non-empty stat bag", () => {
    for (const j of JEWEL_CATALOG) {
      const bagSizes =
        Object.keys(j.flat ?? {}).length +
        Object.keys(j.increased ?? {}).length +
        Object.keys(j.more ?? {}).length;
      expect(bagSizes, `${j.id} has no stats`).toBeGreaterThan(0);
    }
  });

  it("only Unique jewels carry a `more` multiplier (it is the rare, build-defining bucket)", () => {
    for (const j of JEWEL_CATALOG) {
      if (j.more && Object.keys(j.more).length > 0) {
        expect(j.rarity, `${j.id} has more% but isn't Unique`).toBe("Unique");
      }
    }
  });

  it("JEWEL_CATALOG_MAP indexes every jewel by id", () => {
    for (const j of JEWEL_CATALOG) {
      expect(JEWEL_CATALOG_MAP.get(j.id)).toBe(j);
    }
  });
});

describe("jewelStatBag", () => {
  it("returns the def's flat/increased/more bags for a known jewel", () => {
    const bag = jewelStatBag("crimson-shard");
    expect(bag).not.toBeNull();
    expect(bag!.increased?.atk).toBeCloseTo(0.08, 6);
  });

  it("returns null for an unknown jewel id", () => {
    expect(jewelStatBag("does-not-exist")).toBeNull();
  });
});
