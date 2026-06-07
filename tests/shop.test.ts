import { describe, expect, it } from "vitest";
import { generateShopStock, ensureShopStock, refreshShop, buyShopSlot, sellItem, SHOP_SIZE, SHOP_REFRESH_COST } from "../src/core/shop.ts";
import { createFreshSave } from "../src/core/save.ts";
import { rollItem, ITEM_CATALOG } from "../src/data/items.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";
import { SUMMON_SCROLL } from "../src/data/materials.ts";
import { Rng } from "../src/core/rng.ts";

describe("shop stock", () => {
  it("generates SHOP_SIZE slots with positive cost", () => {
    const save = createFreshSave();
    const stock = generateShopStock(save, new Rng(1));
    expect(stock).toHaveLength(SHOP_SIZE);
    for (const s of stock) expect(s.cost).toBeGreaterThan(0);
  });

  it("ensureShopStock fills an empty shop and is idempotent", () => {
    const save = createFreshSave();
    ensureShopStock(save, new Rng(2));
    const first = save.shop.stock;
    ensureShopStock(save, new Rng(3));
    expect(save.shop.stock).toBe(first); // not regenerated
  });

  it("refresh costs crystals and rerolls", () => {
    const save = createFreshSave();
    ensureShopStock(save, new Rng(4));
    save.currency.crystals = SHOP_REFRESH_COST;
    expect(refreshShop(save, new Rng(5)).success).toBe(true);
    expect(save.currency.crystals).toBe(0);
    expect(refreshShop(save, new Rng(6)).success).toBe(false); // can't afford
  });
});

describe("buy + sell", () => {
  it("buying an item slot adds it to inventory and removes the slot", () => {
    const save = createFreshSave();
    save.shop.stock = generateShopStock(save, new Rng(7)).map((s, i) => i === 0
      ? { slotId: "s0", kind: "item" as const, cost: 100, item: toItemInstanceSave(rollItem(ITEM_CATALOG[0], 5, 1)) }
      : s);
    save.currency.crystals = 100;
    const before = save.inventory.items.length;
    const r = buyShopSlot(save, "s0");
    expect(r.success).toBe(true);
    expect(save.inventory.items.length).toBe(before + 1);
    expect(save.shop.stock.find((s) => s.slotId === "s0")).toBeUndefined();
    expect(save.currency.crystals).toBe(0);
  });

  it("buying a scroll slot grants a summon scroll", () => {
    const save = createFreshSave();
    save.shop.stock = [{ slotId: "sc", kind: "scroll", cost: 50 }];
    save.currency.crystals = 50;
    buyShopSlot(save, "sc");
    expect(save.materials[SUMMON_SCROLL]).toBe(1);
  });

  it("selling refunds 75% and removes the item; equipped items can't be sold", () => {
    const save = createFreshSave();
    const inst = toItemInstanceSave(rollItem(ITEM_CATALOG[0], 5, 2));
    save.inventory.items.push(inst);
    save.currency.crystals = 0;
    const r = sellItem(save, inst.id);
    expect(r.success).toBe(true);
    expect(r.refund).toBeGreaterThan(0);
    expect(save.currency.crystals).toBe(r.refund);
    expect(save.inventory.items.find((i) => i.id === inst.id)).toBeUndefined();

    // equipped item can't be sold
    const inst2 = toItemInstanceSave(rollItem(ITEM_CATALOG[0], 5, 3));
    save.inventory.items.push(inst2);
    save.inventory.equipped[ITEM_CATALOG[0].slot] = inst2.id;
    expect(sellItem(save, inst2.id).success).toBe(false);
  });
});
