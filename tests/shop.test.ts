import { describe, expect, it } from "vitest";
import { SHOP_CATALOG, purchaseShopItem } from "../src/core/shop.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("SHOP_CATALOG", () => {
  it("has at least 3 entries", () => expect(SHOP_CATALOG.length).toBeGreaterThanOrEqual(3));
  it("all entries have cost > 0", () => {
    for (const e of SHOP_CATALOG) expect(e.cost).toBeGreaterThan(0);
  });
});

describe("purchaseShopItem", () => {
  it("deducts crystal cost on purchase", () => {
    const save = createFreshSave();
    const entry = SHOP_CATALOG[0];
    save.currency.crystals = entry.cost;
    purchaseShopItem(save, entry.id);
    expect(save.currency.crystals).toBe(0);
  });

  it("fails if not enough crystals", () => {
    const save = createFreshSave();
    const entry = SHOP_CATALOG[0];
    save.currency.crystals = 0;
    const result = purchaseShopItem(save, entry.id);
    expect(result.success).toBe(false);
    expect(save.currency.crystals).toBe(0);
  });

  it("returns failure for unknown item id", () => {
    const save = createFreshSave();
    save.currency.crystals = 9999;
    const result = purchaseShopItem(save, "does-not-exist");
    expect(result.success).toBe(false);
  });
});
