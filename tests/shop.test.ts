import { describe, expect, it } from "vitest";
import {
  generateShopStock,
  ensureShopStock,
  refreshShop,
  shopRefreshCost,
  buyShopSlot,
  SHOP_SIZE,
  SHOP_FREE_REFRESHES,
  SHOP_REFRESH_STEP,
  SCROLL_SHOP_COST,
  SCROLL_SLOT_CHANCE,
} from "../src/core/shop.ts";
import { SINGLE_PULL_COST } from "../src/core/gacha.ts";
import { createFreshSave } from "../src/core/save.ts";
import { rollItem, ITEM_CATALOG, ITEM_CATALOG_MAP } from "../src/data/items.ts";
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

  it("gives free daily refreshes, then charges +20 each, resetting daily", () => {
    const save = createFreshSave();
    ensureShopStock(save, new Rng(4));
    save.currency.gold = 1000;
    const day = "2026-06-07";

    // First SHOP_FREE_REFRESHES rerolls are free.
    expect(shopRefreshCost(save, day)).toBe(0);
    for (let i = 0; i < SHOP_FREE_REFRESHES; i++) {
      expect(refreshShop(save, new Rng(i), day).success).toBe(true);
    }
    expect(save.currency.gold).toBe(1000); // nothing spent yet

    // Then the cost accumulates by SHOP_REFRESH_STEP each time (20, 40, 60, …).
    expect(shopRefreshCost(save, day)).toBe(SHOP_REFRESH_STEP);
    expect(refreshShop(save, new Rng(20), day).success).toBe(true);
    expect(save.currency.gold).toBe(1000 - SHOP_REFRESH_STEP);
    expect(shopRefreshCost(save, day)).toBe(SHOP_REFRESH_STEP * 2);
    refreshShop(save, new Rng(21), day);
    expect(save.currency.gold).toBe(1000 - SHOP_REFRESH_STEP * 3); // 20 + 40

    // A new day resets the allowance back to free.
    expect(shopRefreshCost(save, "2026-06-08")).toBe(0);
  });

  it("refresh fails when crystals can't cover the accumulated cost", () => {
    const save = createFreshSave();
    ensureShopStock(save, new Rng(4));
    const day = "2026-06-07";
    save.currency.gold = 0;
    save.shop.refreshesToday = SHOP_FREE_REFRESHES; // already used the free ones
    save.shop.refreshDate = day;
    expect(refreshShop(save, new Rng(5), day).success).toBe(false);
  });

  it("a summoning scroll slot is cheaper than a single summon pull", () => {
    expect(SCROLL_SHOP_COST).toBeLessThan(SINGLE_PULL_COST);
  });

  it("scrolls have a low (<5%) chance per slot", () => {
    expect(SCROLL_SLOT_CHANCE).toBeLessThan(0.05);
  });

  // Wings never drop as loot, so the shop is the only reliable way to buy them
  // (craft is the gamble path). Random rolling left them effectively unbuyable,
  // so a Wing slot is guaranteed every shop / refresh.
  const wingSlots = (stock: ReturnType<typeof generateShopStock>) =>
    stock.filter(
      (s) => s.kind === "item" && s.item && ITEM_CATALOG_MAP.get(s.item.defId)?.slot === "Wing",
    );

  it("always offers at least one purchasable Wing slot, across seeds", () => {
    const save = createFreshSave();
    for (let seed = 0; seed < 25; seed++) {
      const stock = generateShopStock(save, new Rng(seed));
      const wings = wingSlots(stock);
      expect(wings.length).toBeGreaterThanOrEqual(1);
      for (const w of wings) expect(w.cost).toBeGreaterThan(0);
    }
  });

  it("a fresh (low-level) shop offers a level-appropriate Wing the player can equip", () => {
    const save = createFreshSave(); // hero level 1
    const stock = generateShopStock(save, new Rng(99));
    const [wing] = wingSlots(stock);
    expect(wing).toBeDefined();
    const def = ITEM_CATALOG_MAP.get(wing!.item!.defId)!;
    expect(def.requiredLevel).toBeLessThanOrEqual(save.hero.level + 5);
  });

  it("keeps the guaranteed Wing slot after a refresh", () => {
    const save = createFreshSave();
    ensureShopStock(save, new Rng(3));
    refreshShop(save, new Rng(4), "2026-06-13");
    expect(wingSlots(save.shop.stock).length).toBeGreaterThanOrEqual(1);
  });
});

describe("buy", () => {
  it("buying an item slot adds it to inventory and removes the slot", () => {
    const save = createFreshSave();
    save.shop.stock = generateShopStock(save, new Rng(7)).map((s, i) =>
      i === 0
        ? {
            slotId: "s0",
            kind: "item" as const,
            cost: 100,
            item: toItemInstanceSave(rollItem(ITEM_CATALOG[0], 5, 1)),
          }
        : s,
    );
    save.currency.gold = 100;
    const before = save.inventory.items.length;
    const r = buyShopSlot(save, "s0");
    expect(r.success).toBe(true);
    expect(save.inventory.items.length).toBe(before + 1);
    expect(save.shop.stock.find((s) => s.slotId === "s0")).toBeUndefined();
    expect(save.currency.gold).toBe(0);
  });

  it("buying a scroll slot grants a summon scroll", () => {
    const save = createFreshSave();
    save.shop.stock = [{ slotId: "sc", kind: "scroll", cost: 50 }];
    save.currency.diamonds = 50; // scrolls cost diamonds
    buyShopSlot(save, "sc");
    expect(save.materials[SUMMON_SCROLL]).toBe(1);
  });
});
