import { describe, expect, it } from "vitest";
import { smeltItem, smeltYield, SMELT_YIELD } from "../src/core/smelt.ts";
import { createFreshSave } from "../src/core/save.ts";
import { rollItem, ITEM_CATALOG } from "../src/data/items.ts";
import { equipSlotsFor, type Rarity } from "../src/data/schema.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";
import { CHAOS_JEWEL } from "../src/data/materials.ts";

const RARITIES: Rarity[] = ["Common", "Magic", "Rare", "Legendary", "Unique"];
function defOf(rarity: Rarity) {
  const d = ITEM_CATALOG.find((x) => x.rarity === rarity);
  if (!d) throw new Error(`no ${rarity} item in catalog`);
  return d;
}

describe("smelt", () => {
  it("yield doubles per rarity step (1/2/4/8/16), monotonic", () => {
    expect(RARITIES.map(smeltYield)).toEqual([1, 2, 4, 8, 16]);
    for (let i = 1; i < RARITIES.length; i++) {
      expect(SMELT_YIELD[RARITIES[i]]).toBeGreaterThan(SMELT_YIELD[RARITIES[i - 1]]);
    }
  });

  it("smelting removes the item and adds its rarity's chaos yield to the wallet", () => {
    const save = createFreshSave();
    for (const r of RARITIES) {
      const def = defOf(r);
      const inst = toItemInstanceSave(rollItem(def, 5, 1));
      save.inventory.items.push(inst);
      const before = save.materials[CHAOS_JEWEL] ?? 0;
      const res = smeltItem(save, inst.id);
      expect(res.ok).toBe(true);
      expect(res.chaos).toBe(smeltYield(r));
      expect(save.materials[CHAOS_JEWEL]).toBe(before + smeltYield(r));
      expect(save.inventory.items.find((i) => i.id === inst.id)).toBeUndefined();
    }
  });

  it("refuses to smelt an equipped item (and a missing one)", () => {
    const save = createFreshSave();
    const def = ITEM_CATALOG[0];
    const inst = toItemInstanceSave(rollItem(def, 5, 2));
    save.inventory.items.push(inst);
    save.inventory.equipped[equipSlotsFor(def.slot)[0]] = inst.id;
    expect(smeltItem(save, inst.id).ok).toBe(false);
    expect(save.inventory.items.find((i) => i.id === inst.id)).toBeDefined();
    expect(smeltItem(save, "nope").ok).toBe(false);
  });
});
