// tests/itemArchetype.test.ts
import { describe, it, expect } from "vitest";
import {
  archetypeFor, archetypeForPrimary, ARCHETYPES, type ItemArchetype,
} from "../src/data/itemArchetype.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

describe("archetypeForPrimary (derivation)", () => {
  const cases: [string, ItemArchetype][] = [
    ["physicalDamage", "physical"], ["critRate", "physical"], ["critDamage", "physical"],
    ["armorPen", "physical"], ["attackSpeed", "physical"], ["omnivamp", "physical"], ["atk", "physical"],
    ["magicDamage", "magic"], ["skillPower", "magic"], ["magicPen", "magic"],
    ["manaOnHit", "magic"], ["manaOnKill", "magic"],
    ["maxHp", "defense"], ["armor", "defense"], ["magicResist", "defense"],
    ["damageReduction", "defense"], ["critDefense", "defense"], ["tenacity", "defense"], ["hpRegen", "defense"],
    ["goldFind", "utility"], ["moveSpeed", "utility"], ["range", "utility"],
  ];
  for (const [primary, expected] of cases) {
    it(`'${primary}' → ${expected}`, () => {
      expect(archetypeForPrimary(primary)).toBe(expected);
    });
  }

  it("unknown primary falls back to hybrid", () => {
    expect(archetypeForPrimary("nonsense")).toBe("hybrid");
  });
});

describe("archetypeFor (override beats derivation)", () => {
  it("uses the authored archetype when present", () => {
    expect(archetypeFor({ primaryAffix: { type: "atk" }, archetype: "hybrid" })).toBe("hybrid");
  });
  it("falls back to the primary-derived archetype when not authored", () => {
    expect(archetypeFor({ primaryAffix: { type: "skillPower" } })).toBe("magic");
  });
});

describe("ARCHETYPES metadata", () => {
  it("has a label + color for all five archetypes", () => {
    const ids = ARCHETYPES.map((a) => a.id).sort();
    expect(ids).toEqual(["defense", "hybrid", "magic", "physical", "utility"]);
    for (const a of ARCHETYPES) expect(a.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("accessory build matrix", () => {
  // Every accessory slot must offer each of the four combat archetypes so a
  // player can assemble a coherent physical / magic / defense / utility build.
  const COMBAT: ItemArchetype[] = ["physical", "magic", "defense", "utility"];
  for (const slot of ["Ring", "Amulet", "Pet"] as const) {
    it(`${slot} covers all four combat archetypes`, () => {
      const present = new Set(
        ITEM_CATALOG.filter((d) => d.slot === slot).map((d) => archetypeFor(d)),
      );
      for (const a of COMBAT) expect(present.has(a), `${slot} missing ${a}`).toBe(true);
    });
  }
});
