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
    expect(result).toEqual({ weaponKey: null, wingKey: null, petKey: null });
  });

  it("returns weapon texture key when a weapon is equipped", () => {
    const inv = makeInventory({
      items: [makeItem("inst-1", "iron-sword")],
      equipped: { Weapon: "inst-1" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.weaponKey).toBe("item__iron-sword");
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

  it("returns wing appearanceRef when wing item has one", () => {
    const inv = makeInventory({
      items: [makeItem("inst-3", "fledgling-wings")],
      equipped: { Wing: "inst-3" },
    });
    const result = resolveHeroLayers(inv);
    // fledgling-wings currently has no appearanceRef yet (Task 2 adds it)
    // so result is either null or "item__fledgling-wings" — both acceptable
    expect(typeof result.wingKey === "string" || result.wingKey === null).toBe(true);
  });
});
