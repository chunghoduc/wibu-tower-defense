// tests/heroEquipVisuals.test.ts
import { describe, it, expect } from "vitest";
import { resolveHeroLayers } from "../src/scenes/heroEquipVisuals.ts";
import type { InventorySave, ItemInstanceSave } from "../src/core/save.ts";

function makeItem(id: string, defId: string): ItemInstanceSave {
  return {
    id,
    defId,
    acquiredLevel: 1,
    enhanceLevel: 0,
    rolledStats: {},
    rolledPrimaryAffix: 0,
    rolledAffixes: [],
  };
}

function makeInventory(overrides: Partial<InventorySave> = {}): InventorySave {
  return { items: [], equipped: {}, ...overrides };
}

describe("resolveHeroLayers", () => {
  it("returns all-null config when nothing is equipped", () => {
    const result = resolveHeroLayers(makeInventory());
    expect(result).toEqual({
      weaponKey: null, weaponType: null, wingKey: null, petKey: null,
      helmetKey: null, bodyKey: null, glovesKey: null, bootsKey: null,
    });
  });

  it("returns icon keys for worn armour (helmet, body, gloves, boots)", () => {
    const inv = makeInventory({
      items: [
        makeItem("h", "leather-cap"),
        makeItem("b", "cloth-robe"),
        makeItem("g", "worn-gloves"),
        makeItem("t", "worn-boots"),
      ],
      equipped: { Helmet: "h", BodyArmor: "b", Gloves: "g", Boots: "t" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.helmetKey).toBe("item__leather-cap");
    expect(result.bodyKey).toBe("item__cloth-robe");
    expect(result.glovesKey).toBe("item__worn-gloves");
    expect(result.bootsKey).toBe("item__worn-boots");
  });

  it("returns weapon texture key and family when a weapon is equipped", () => {
    const inv = makeInventory({
      items: [makeItem("inst-1", "iron-sword")],
      equipped: { Weapon: "inst-1" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.weaponKey).toBe("item__iron-sword");
    expect(result.weaponType).toBe("Sword");
  });

  it("returns null weaponKey when equipped weapon instance is not found", () => {
    const inv = makeInventory({
      items: [],
      equipped: { Weapon: "missing-instance" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.weaponKey).toBeNull();
  });

  it("returns pet texture key when a pet is equipped", () => {
    const inv = makeInventory({
      items: [makeItem("inst-2", "coin-sprite")],
      equipped: { Pet: "inst-2" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.petKey).toBe("item__coin-sprite");
  });

  it("returns item icon key for wing when no appearanceRef set", () => {
    const inv = makeInventory({
      items: [makeItem("inst-3", "fledgling-wings")],
      equipped: { Wing: "inst-3" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.wingKey).toBe("item__fledgling-wings");
  });
});
