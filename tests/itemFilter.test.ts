// tests/itemFilter.test.ts
import { describe, it, expect } from "vitest";
import { slotInCategory, type ItemCategory } from "../src/scenes/itemCategory.ts";
import type { ItemDefSlot } from "../src/data/schemaEnums.ts";

const ALL_SLOTS: ItemDefSlot[] = [
  "Weapon",
  "Helmet",
  "BodyArmor",
  "Gloves",
  "Boots",
  "Amulet",
  "Ring",
  "Pet",
  "Wing",
];

describe("slotInCategory", () => {
  it("'all' matches every slot", () => {
    for (const s of ALL_SLOTS) expect(slotInCategory(s, "all")).toBe(true);
  });

  it("'weapon' matches only the Weapon slot", () => {
    expect(slotInCategory("Weapon", "weapon")).toBe(true);
    for (const s of ALL_SLOTS.filter((x) => x !== "Weapon")) {
      expect(slotInCategory(s, "weapon")).toBe(false);
    }
  });

  it("'armor' matches the four worn-armour slots", () => {
    for (const s of ["Helmet", "BodyArmor", "Gloves", "Boots"] as ItemDefSlot[]) {
      expect(slotInCategory(s, "armor")).toBe(true);
    }
    for (const s of ["Weapon", "Amulet", "Ring", "Pet", "Wing"] as ItemDefSlot[]) {
      expect(slotInCategory(s, "armor")).toBe(false);
    }
  });

  it("'accessory' matches Amulet / Ring / Pet / Wing", () => {
    for (const s of ["Amulet", "Ring", "Pet", "Wing"] as ItemDefSlot[]) {
      expect(slotInCategory(s, "accessory")).toBe(true);
    }
    for (const s of ["Weapon", "Helmet", "BodyArmor", "Gloves", "Boots"] as ItemDefSlot[]) {
      expect(slotInCategory(s, "accessory")).toBe(false);
    }
  });

  it("every slot falls into exactly one non-'all' category", () => {
    const cats: ItemCategory[] = ["weapon", "armor", "accessory"];
    for (const s of ALL_SLOTS) {
      const hits = cats.filter((c) => slotInCategory(s, c));
      expect(hits.length).toBe(1);
    }
  });
});
