import { describe, expect, it } from "vitest";
import {
  WEAPON_TYPES,
  type PassiveNodeDef,
  type ActiveSkillDef,
  type ItemDef,
  type ItemInstance,
  type RolledAffix,
  validateActiveSkill,
  validatePassiveNode,
  validateItemDef,
} from "../src/data/schema.ts";

// Verify exported types exist by using them in narrowly-scoped type assertions.
// These are compile-time-only checks — no runtime cost.
const _itemInstanceCheck: ItemInstance = {
  id: "i",
  defId: "d",
  acquiredLevel: 1,
  rolledStats: {},
  rolledPrimaryAffix: 0,
  rolledAffixes: [],
  enhanceLevel: 0,
};
const _rolledAffixCheck: RolledAffix = { type: "critRate", value: 0.05 };
void _itemInstanceCheck;
void _rolledAffixCheck;

describe("WeaponType", () => {
  it("includes all six weapon types plus Any", () => {
    expect(WEAPON_TYPES).toContain("Sword");
    expect(WEAPON_TYPES).toContain("Bow");
    expect(WEAPON_TYPES).toContain("Staff");
    expect(WEAPON_TYPES).toContain("Gun");
    expect(WEAPON_TYPES).toContain("Tome");
    expect(WEAPON_TYPES).toContain("Fist");
    expect(WEAPON_TYPES).toContain("Any");
  });

  it("has exactly 7 entries", () => {
    expect(WEAPON_TYPES).toHaveLength(7);
  });
});

describe("validateActiveSkill", () => {
  it("accepts a valid skill", () => {
    const skill: ActiveSkillDef = {
      id: "flame-wave",
      name: "Flame Wave",
      description: "A wave of fire.",
      rarity: "Rare",
      requiresWeapon: "Staff",
      damageType: "Magic",
      basePower: 120,
      artRef: "placeholder",
    };
    expect(() => validateActiveSkill(skill)).not.toThrow();
  });

  it("rejects missing id", () => {
    expect(() =>
      validateActiveSkill({
        id: "",
        name: "x",
        description: "x",
        rarity: "Common",
        damageType: "Physical",
        basePower: 10,
        artRef: "x",
      }),
    ).toThrow();
  });

  it("rejects basePower <= 0", () => {
    expect(() =>
      validateActiveSkill({
        id: "s",
        name: "x",
        description: "x",
        rarity: "Common",
        damageType: "Physical",
        basePower: 0,
        artRef: "x",
      }),
    ).toThrow();
  });

  it("rejects bad rarity", () => {
    expect(() =>
      validateActiveSkill({
        id: "s",
        name: "x",
        description: "x",
        rarity: "SuperRare" as any,
        damageType: "Physical",
        basePower: 10,
        artRef: "x",
      }),
    ).toThrow();
  });

  it("rejects bad damageType", () => {
    expect(() =>
      validateActiveSkill({
        id: "s",
        name: "x",
        description: "x",
        rarity: "Common",
        damageType: "Poison" as any,
        basePower: 10,
        artRef: "x",
      }),
    ).toThrow();
  });

  it("rejects bad requiresWeapon", () => {
    expect(() =>
      validateActiveSkill({
        id: "s",
        name: "x",
        description: "x",
        rarity: "Common",
        damageType: "Physical",
        basePower: 10,
        requiresWeapon: "Axe" as any,
        artRef: "x",
      }),
    ).toThrow();
  });
});

describe("validatePassiveNode", () => {
  it("accepts a valid path node", () => {
    const node: PassiveNodeDef = {
      id: "brawler-atk-1",
      type: "path",
      region: "brawler",
      name: "+3% ATK",
      description: "Increases ATK by 3%.",
      gridX: 2,
      gridY: 3,
      neighbors: ["brawler-start"],
      increased: { atk: 0.03 },
    };
    expect(() => validatePassiveNode(node)).not.toThrow();
  });

  it("rejects node with no neighbors", () => {
    expect(() =>
      validatePassiveNode({
        id: "x",
        type: "path",
        region: "brawler",
        name: "x",
        description: "x",
        gridX: 0,
        gridY: 0,
        neighbors: [],
      }),
    ).toThrow();
  });
});

describe("validateItemDef", () => {
  it("accepts valid item", () => {
    const item: ItemDef = {
      id: "iron-sword",
      name: "Iron Sword",
      slot: "Weapon",
      weaponType: "Sword",
      rarity: "Common",
      requiredLevel: 1,
      baseStats: { atk: 20 },
      primaryAffix: { type: "physicalDamage", baseValue: 0.08 },
      affixPool: ["critRate", "armorPen"],
      artRef: "placeholder",
    };
    expect(() => validateItemDef(item)).not.toThrow();
  });

  it("rejects Weapon slot without weaponType", () => {
    expect(() =>
      validateItemDef({
        id: "x",
        name: "x",
        slot: "Weapon",
        rarity: "Common",
        requiredLevel: 1,
        baseStats: {},
        primaryAffix: { type: "x", baseValue: 1 },
        affixPool: [],
        artRef: "x",
      }),
    ).toThrow(/weaponType/);
  });

  it("rejects requiredLevel < 1", () => {
    expect(() =>
      validateItemDef({
        id: "x",
        name: "x",
        slot: "Helmet",
        rarity: "Common",
        requiredLevel: 0,
        baseStats: {},
        primaryAffix: { type: "x", baseValue: 1 },
        affixPool: [],
        artRef: "x",
      }),
    ).toThrow(/requiredLevel/);
  });

  it("rejects primaryAffix.baseValue of 0", () => {
    expect(() =>
      validateItemDef({
        id: "x",
        name: "Sword",
        slot: "Weapon",
        weaponType: "Sword",
        rarity: "Common",
        requiredLevel: 1,
        baseStats: {},
        primaryAffix: { type: "atk", baseValue: 0 },
        affixPool: [],
        artRef: "x",
      }),
    ).toThrow(/primaryAffix/);
  });
});
