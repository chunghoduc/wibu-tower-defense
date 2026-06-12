import { describe, expect, it } from "vitest";
import {
  smeltItem,
  smeltYield,
  SMELT_YIELD,
  bulkSmelt,
  bulkSmeltPreview,
  AUTO_SMELT_RARITIES,
} from "../src/core/smelt.ts";
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

describe("bulk smelt (auto-recycle)", () => {
  function pushOne(save: ReturnType<typeof createFreshSave>, r: Rarity, seed: number) {
    const inst = toItemInstanceSave(rollItem(defOf(r), 5, seed));
    save.inventory.items.push(inst);
    return inst;
  }

  it("AUTO_SMELT_RARITIES is exactly Common, Magic, Rare", () => {
    expect(AUTO_SMELT_RARITIES).toEqual(["Common", "Magic", "Rare"]);
  });

  it("preview counts only selected, non-equipped rarities and does not mutate", () => {
    const save = createFreshSave();
    pushOne(save, "Common", 1);
    pushOne(save, "Common", 2);
    pushOne(save, "Magic", 3);
    pushOne(save, "Rare", 4);
    const before = save.inventory.items.length;

    const p = bulkSmeltPreview(save, ["Common", "Magic"]);
    expect(p.count).toBe(3);
    expect(p.chaos).toBe(smeltYield("Common") * 2 + smeltYield("Magic"));
    expect(save.inventory.items.length).toBe(before); // no mutation
  });

  it("bulk smelt removes matched items, mints summed chaos, leaves the rest", () => {
    const save = createFreshSave();
    const c1 = pushOne(save, "Common", 1);
    const m1 = pushOne(save, "Magic", 2);
    const rare = pushOne(save, "Rare", 3);
    const leg = pushOne(save, "Legendary", 4);
    const before = save.materials[CHAOS_JEWEL] ?? 0;

    const res = bulkSmelt(save, ["Common", "Magic"]);
    expect(res.count).toBe(2);
    expect(res.chaos).toBe(smeltYield("Common") + smeltYield("Magic"));
    expect(save.materials[CHAOS_JEWEL]).toBe(before + res.chaos);
    expect(save.inventory.items.find((i) => i.id === c1.id)).toBeUndefined();
    expect(save.inventory.items.find((i) => i.id === m1.id)).toBeUndefined();
    expect(save.inventory.items.find((i) => i.id === rare.id)).toBeDefined();
    expect(save.inventory.items.find((i) => i.id === leg.id)).toBeDefined();
  });

  it("never smelts equipped items even if their rarity is selected", () => {
    const save = createFreshSave();
    const def = defOf("Common");
    const inst = toItemInstanceSave(rollItem(def, 5, 9));
    save.inventory.items.push(inst);
    save.inventory.equipped[equipSlotsFor(def.slot)[0]] = inst.id;

    const res = bulkSmelt(save, ["Common"]);
    expect(res.count).toBe(0);
    expect(save.inventory.items.find((i) => i.id === inst.id)).toBeDefined();
  });

  it("requesting Legendary/Unique smelts nothing (guard holds)", () => {
    const save = createFreshSave();
    pushOne(save, "Legendary", 1);
    pushOne(save, "Unique", 2);
    const res = bulkSmelt(save, ["Legendary", "Unique"] as Rarity[]);
    expect(res.count).toBe(0);
    expect(res.chaos).toBe(0);
    expect(save.inventory.items.length).toBe(2);
  });

  it("empty selection yields nothing and no mutation", () => {
    const save = createFreshSave();
    pushOne(save, "Common", 1);
    const res = bulkSmelt(save, []);
    expect(res).toEqual({ count: 0, chaos: 0 });
    expect(save.inventory.items.length).toBe(1);
  });

  it("preview and bulk agree for the same selection", () => {
    const save = createFreshSave();
    pushOne(save, "Common", 1);
    pushOne(save, "Magic", 2);
    pushOne(save, "Rare", 3);
    const p = bulkSmeltPreview(save, ["Common", "Magic", "Rare"]);
    const res = bulkSmelt(save, ["Common", "Magic", "Rare"]);
    expect(res.count).toBe(p.count);
    expect(res.chaos).toBe(p.chaos);
  });
});
