import { describe, expect, it } from "vitest";
import { ACTIVE_SKILLS } from "../src/data/skills.ts";
import { ITEM_CATALOG, rollItem } from "../src/data/items.ts";
import { ITEM_SLOTS } from "../src/data/schema.ts";

describe("ACTIVE_SKILLS", () => {
  it("has at least 10 skills", () => {
    expect(ACTIVE_SKILLS.length).toBeGreaterThanOrEqual(10);
  });
  it("has no duplicate ids", () => {
    const ids = ACTIVE_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("all skills have basePower > 0", () => {
    for (const s of ACTIVE_SKILLS) expect(s.basePower).toBeGreaterThan(0);
  });
});

describe("ITEM_CATALOG", () => {
  it("has at least 18 items", () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(18);
  });
  it("has no duplicate ids", () => {
    const ids = ITEM_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers all 10 item slots", () => {
    const slots = new Set(ITEM_CATALOG.map((i) => i.slot));
    for (const slot of ITEM_SLOTS) expect(slots.has(slot)).toBe(true);
  });
  it("all Weapon items have weaponType", () => {
    for (const item of ITEM_CATALOG.filter((i) => i.slot === "Weapon")) {
      expect(item.weaponType).toBeDefined();
    }
  });
  it("all items have requiredLevel >= 1", () => {
    for (const item of ITEM_CATALOG) expect(item.requiredLevel).toBeGreaterThanOrEqual(1);
  });
});

describe("rollItem", () => {
  it("produces an ItemInstance with correct defId", () => {
    const def = ITEM_CATALOG[0];
    const instance = rollItem(def, 10, 42);
    expect(instance.defId).toBe(def.id);
    expect(instance.acquiredLevel).toBe(10);
  });
  it("rolled stats are within ±10% of effective base", () => {
    const def = ITEM_CATALOG.find((i) => i.id === "iron-sword")!;
    for (let seed = 0; seed < 20; seed++) {
      const inst = rollItem(def, 1, seed);
      for (const [k, v] of Object.entries(inst.rolledStats)) {
        const base = (def.baseStats as Record<string, number>)[k] ?? 0;
        if (base === 0) continue;
        const effective = base * (1 + 0.08 * def.requiredLevel);
        expect(v).toBeGreaterThanOrEqual(effective * 0.9 - 0.001);
        expect(v).toBeLessThanOrEqual(effective * 1.1 + 0.001);
      }
    }
  });
  it("rolled affix count matches rarity", () => {
    const common = ITEM_CATALOG.find((i) => i.rarity === "Common")!;
    const rare = ITEM_CATALOG.find((i) => i.rarity === "Rare")!;
    expect(rollItem(common, 1, 0).rolledAffixes).toHaveLength(0);
    expect(rollItem(rare, 1, 0).rolledAffixes).toHaveLength(2);
  });
  it("same seed produces identical rolls", () => {
    const def = ITEM_CATALOG[0];
    const a = rollItem(def, 10, 99);
    const b = rollItem(def, 10, 99);
    expect(a.rolledStats).toEqual(b.rolledStats);
    expect(a.rolledPrimaryAffix).toBe(b.rolledPrimaryAffix);
  });
});
