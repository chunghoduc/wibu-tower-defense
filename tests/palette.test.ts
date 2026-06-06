import { describe, expect, it } from "vitest";
import { BASE_PALETTE, paletteFor, RARITY_ACCENT } from "../src/art/palette.ts";
import { spriteKind } from "../src/data/artPrompts.ts";
import { TOWERS } from "../src/data/towers.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

describe("BASE_PALETTE", () => {
  it("maps '.' to fully transparent and 'K' to opaque outline", () => {
    expect(BASE_PALETTE["."]).toEqual([0, 0, 0, 0]);
    expect(BASE_PALETTE["K"][3]).toBe(255);
  });
});

describe("paletteFor", () => {
  it("always includes transparent, outline, and the rarity accent symbol A", () => {
    const tower = TOWERS.find((t) => t.rarity === "Unique")!;
    const pal = paletteFor({ kind: "tower", rarity: tower.rarity });
    expect(pal["."]).toBeDefined();
    expect(pal["K"]).toBeDefined();
    expect(pal["A"]).toEqual(RARITY_ACCENT.Unique);
  });

  it("returns a unique RGBA per symbol and a non-empty set", () => {
    const pal = paletteFor({ kind: "item", rarity: ITEM_CATALOG[0].rarity });
    const keys = Object.keys(pal);
    expect(keys.length).toBeGreaterThan(3);
    expect(keys).toContain("A");
  });
});

describe("spriteKind", () => {
  it("classifies a Boss enemy as boss and others as enemy", () => {
    expect(spriteKind({ archetype: "Boss" } as never)).toBe("boss");
    expect(spriteKind({ archetype: "Rusher" } as never)).toBe("enemy");
  });
});
