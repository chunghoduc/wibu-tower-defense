import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { craftAlchemy, maxCrafts, exchangeCopies } from "../src/core/alchemy.ts";
import { COPIES_PER_CRYSTAL } from "../src/data/alchemy.ts";
import { BLESS_JEWEL, SOUL_JEWEL, AWAKENING_CRYSTAL } from "../src/data/materials.ts";

describe("F18 alchemy / surplus exchange", () => {
  it("transmutes 5 Bless into 1 Soul (lossy)", () => {
    const s = createFreshSave();
    s.materials[BLESS_JEWEL] = 12;
    expect(maxCrafts(s, "bless-to-soul")).toBe(2);
    expect(craftAlchemy(s, "bless-to-soul", 2)).toBe(2);
    expect(s.materials[BLESS_JEWEL]).toBe(2);
    expect(s.materials[SOUL_JEWEL]).toBe(2);
  });

  it("does nothing when inputs are insufficient", () => {
    const s = createFreshSave();
    s.materials[BLESS_JEWEL] = 4;
    expect(craftAlchemy(s, "bless-to-soul", 1)).toBe(0);
    expect(s.materials[BLESS_JEWEL]).toBe(4);
  });

  it("clamps craft count to what's affordable", () => {
    const s = createFreshSave();
    s.materials[SOUL_JEWEL] = 7; // 3 per craft → only 2 crafts
    expect(craftAlchemy(s, "soul-to-crystal", 99)).toBe(2);
    expect(s.materials[AWAKENING_CRYSTAL]).toBe(2);
    expect(s.materials[SOUL_JEWEL]).toBe(1);
  });

  it("exchanges banked dupe copies into Awakening Crystals", () => {
    const s = createFreshSave();
    s.collection["yamo"] = { stars: 3, copies: COPIES_PER_CRYSTAL * 2 + 1 };
    expect(exchangeCopies(s, "yamo", 99)).toBe(2);
    expect(s.collection["yamo"].copies).toBe(1);
    expect(s.materials[AWAKENING_CRYSTAL]).toBe(2);
  });

  it("copy exchange refuses below the threshold", () => {
    const s = createFreshSave();
    s.collection["yamo"] = { stars: 2, copies: COPIES_PER_CRYSTAL - 1 };
    expect(exchangeCopies(s, "yamo", 1)).toBe(0);
  });
});
