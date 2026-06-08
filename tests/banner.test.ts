import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  featuredForWeek, featuredIds, setWishlist, canClaimSpark, claimSpark, ensureWishlist, SPARK_PITY,
} from "../src/core/banner.ts";
import { TOWERS } from "../src/data/towers.ts";

const UNIQUE = TOWERS.find((t) => t.rarity === "Unique")!.id;

describe("F10 spotlight banner + spark", () => {
  it("featured rotation is deterministic per week and yields real tower ids", () => {
    const a = featuredForWeek("2026-W24");
    const b = featuredForWeek("2026-W24");
    expect(a).toEqual(b);
    expect(TOWERS.some((t) => t.id === a.unique)).toBe(true);
    expect(featuredIds("2026-W24").size).toBeGreaterThan(0);
  });

  it("different weeks can feature different headliners", () => {
    const keys = ["2026-W10", "2026-W11", "2026-W12", "2026-W13", "2026-W14"];
    const uniques = new Set(keys.map((k) => featuredForWeek(k).unique));
    expect(uniques.size).toBeGreaterThan(1);
  });

  it("ensureWishlist defaults the pick to the week's featured Unique", () => {
    const s = createFreshSave();
    ensureWishlist(s, "2026-W24");
    expect(s.meta.banner.pickedFeaturedId).toBe(featuredForWeek("2026-W24").unique);
  });

  it("setWishlist only accepts a Unique tower", () => {
    const s = createFreshSave();
    expect(setWishlist(s, UNIQUE)).toBe(true);
    const common = TOWERS.find((t) => t.rarity === "Common")!.id;
    expect(setWishlist(s, common)).toBe(false);
  });

  it("spark claim requires SPARK_PITY sparks and grants the wishlisted Unique", () => {
    const s = createFreshSave();
    setWishlist(s, UNIQUE);
    s.meta.banner.sparks = SPARK_PITY - 1;
    expect(canClaimSpark(s)).toBe(false);
    s.meta.banner.sparks = SPARK_PITY;
    expect(canClaimSpark(s)).toBe(true);
    expect(claimSpark(s)).toBe(UNIQUE);
    expect(s.collection[UNIQUE]).toBeDefined();
    expect(s.meta.banner.sparks).toBe(0);
  });
});
