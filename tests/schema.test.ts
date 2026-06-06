import { describe, expect, it } from "vitest";
import {
  makeStats,
  SchemaError,
  validateCharacter,
  validateEnemy,
  type CharacterDef,
  type EnemyDef,
} from "../src/data/schema.ts";
import { loadCatalog } from "../src/data/catalog.ts";

const goodChar: CharacterDef = {
  id: "x",
  name: "X",
  rarity: "Common",
  role: "damage",
  damageType: "Physical",
  target: "Both",
  cost: 10,
  description: "a test character",
  passives: ["p"],
  active: null,
  baseStats: makeStats({ atk: 1, maxHp: 1 }),
  artRef: "placeholder",
};

const goodEnemy: EnemyDef = {
  id: "e",
  name: "E",
  archetype: "Rusher",
  flying: false,
  immunity: null,
  damageType: "Physical",
  bounty: 1,
  castleDamage: 1,
  baseStats: makeStats({ maxHp: 10 }),
  artRef: "placeholder",
};

describe("validators", () => {
  it("accepts valid defs", () => {
    expect(() => validateCharacter(goodChar)).not.toThrow();
    expect(() => validateEnemy(goodEnemy)).not.toThrow();
  });

  it("rejects a character with 0 or >3 passives", () => {
    expect(() => validateCharacter({ ...goodChar, passives: [] })).toThrow(SchemaError);
    expect(() => validateCharacter({ ...goodChar, passives: ["a", "b", "c", "d"] })).toThrow(
      SchemaError,
    );
  });

  it("rejects an enemy with an invalid immunity", () => {
    // @ts-expect-error intentionally invalid value
    expect(() => validateEnemy({ ...goodEnemy, immunity: "Lasers" })).toThrow(SchemaError);
  });

  it("rejects an enemy with non-positive HP", () => {
    expect(() => validateEnemy({ ...goodEnemy, baseStats: makeStats({ maxHp: 0 }) })).toThrow(
      SchemaError,
    );
  });
});

describe("loadCatalog", () => {
  it("loads the placeholder catalogs without error", () => {
    const cat = loadCatalog();
    expect(cat.characters.size).toBeGreaterThan(0);
    expect(cat.enemies.size).toBeGreaterThan(0);
    expect(cat.stages.has("ch1-s1")).toBe(true);
  });
});
