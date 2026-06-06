import { describe, expect, it } from "vitest";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { ITEM_SLOTS, WEAPON_TYPES } from "../src/data/schema.ts";

describe("expanded item catalog (T10)", () => {
  it("has at least 149 items (19 base + 130 generated)", () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(149);
  });

  it("all item ids are unique", () => {
    const ids = ITEM_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers many distinct primary affix types", () => {
    const types = new Set(ITEM_CATALOG.map((d) => d.primaryAffix.type));
    expect(types.size).toBeGreaterThanOrEqual(12);
  });

  it("covers every equipment slot", () => {
    const slots = new Set(ITEM_CATALOG.map((d) => d.slot));
    for (const s of ITEM_SLOTS) {
      if (s === "Ring1" || s === "Ring2") continue; // rings split across both
      expect(slots.has(s), s).toBe(true);
    }
  });

  it("every weapon has a valid weaponType and every item a positive primary value", () => {
    for (const d of ITEM_CATALOG) {
      if (d.slot === "Weapon") expect(WEAPON_TYPES.includes(d.weaponType!), d.id).toBe(true);
      expect(d.primaryAffix.baseValue, d.id).toBeGreaterThan(0);
      expect(d.requiredLevel).toBeGreaterThanOrEqual(1);
    }
  });
});
