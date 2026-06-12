/**
 * Shop — rotating equipment stock. Currency split:
 *  - Gold: refresh cost, Common/Magic/Rare items, item sell refunds.
 *  - Diamonds: Legendary/Unique items and Summoning Scrolls (premium-gated).
 */
import { ITEM_CATALOG, ITEM_CATALOG_MAP, rollItem, itemValue } from "../data/items.ts";
import { toItemInstanceSave } from "./itemDrop.ts";
import { SUMMON_SCROLL } from "../data/materials.ts";
import { SINGLE_PULL_COST } from "./gacha.ts";
import { Rng } from "./rng.ts";
import type { HeroSave, ShopStockEntry } from "./save.ts";

export const SHOP_SIZE = 8;
export const SHOP_FREE_REFRESHES = 3;
export const SHOP_REFRESH_STEP = 60; // each reroll past the free ones costs +60 gold
/** Scroll costs diamonds, same as 75% of a single summon. */
export const SCROLL_SHOP_COST = Math.round(SINGLE_PULL_COST * 0.75);
export const SCROLL_SLOT_CHANCE = 0.04;

/** Rarities whose shop cost is paid in diamonds (premium); everything else uses gold. */
const DIAMOND_RARITIES = new Set(["Legendary", "Unique"]);

/** Returns which currency a shop slot costs and its amount. */
export function slotCurrency(slot: ShopStockEntry): {
  currency: "gold" | "diamonds";
  amount: number;
} {
  if (slot.kind === "scroll") return { currency: "diamonds", amount: slot.cost };
  if (!slot.item) return { currency: "gold", amount: slot.cost };
  const def = ITEM_CATALOG_MAP.get(slot.item.defId);
  const isDiamond = def && DIAMOND_RARITIES.has(def.rarity);
  return { currency: isDiamond ? "diamonds" : "gold", amount: slot.cost };
}

export interface PurchaseResult {
  success: boolean;
  message: string;
}

let _slotCounter = 0;
function newSlotId(): string {
  return `slot-${(_slotCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
function shopItemLevel(save: HeroSave): number {
  return Math.max(1, save.hero.level);
}

export function generateShopStock(save: HeroSave, rng: Rng): ShopStockEntry[] {
  const lvl = shopItemLevel(save);
  const eligible = ITEM_CATALOG.filter((d) => d.requiredLevel <= lvl + 5);
  const pool = eligible.length ? eligible : ITEM_CATALOG;
  const stock: ShopStockEntry[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    if (rng.next() < SCROLL_SLOT_CHANCE) {
      stock.push({ slotId: newSlotId(), kind: "scroll", cost: SCROLL_SHOP_COST });
      continue;
    }
    const def = pool[Math.floor(rng.next() * pool.length)];
    const inst = toItemInstanceSave(rollItem(def, lvl, Math.floor(rng.next() * 999983)));
    stock.push({ slotId: newSlotId(), kind: "item", cost: itemValue(def), item: inst });
  }
  return stock;
}

export function ensureShopStock(save: HeroSave, rng: Rng): void {
  if (!save.shop.stock || save.shop.stock.length === 0)
    save.shop.stock = generateShopStock(save, rng);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function rolloverRefreshes(save: HeroSave, today: string): void {
  if (save.shop.refreshDate !== today) {
    save.shop.refreshDate = today;
    save.shop.refreshesToday = 0;
  }
}

/** Gold cost of the next manual refresh (free until SHOP_FREE_REFRESHES, then escalating). */
export function shopRefreshCost(save: HeroSave, today: string = todayStr()): number {
  rolloverRefreshes(save, today);
  const past = save.shop.refreshesToday - SHOP_FREE_REFRESHES;
  return past < 0 ? 0 : SHOP_REFRESH_STEP * (past + 1);
}

export function refreshShop(save: HeroSave, rng: Rng, today: string = todayStr()): PurchaseResult {
  const cost = shopRefreshCost(save, today);
  if (save.currency.gold < cost)
    return { success: false, message: `Need ${cost} 🪙 gold to refresh` };
  save.currency.gold -= cost;
  save.shop.refreshesToday += 1;
  save.shop.stock = generateShopStock(save, rng);
  return { success: true, message: cost > 0 ? `Refreshed (−${cost} 🪙)` : "Refreshed (free)" };
}

export function buyShopSlot(save: HeroSave, slotId: string): PurchaseResult {
  const idx = save.shop.stock.findIndex((s) => s.slotId === slotId);
  if (idx < 0) return { success: false, message: "Item no longer available" };
  const slot = save.shop.stock[idx];
  const { currency, amount } = slotCurrency(slot);
  if (currency === "diamonds") {
    if (save.currency.diamonds < amount) return { success: false, message: "Not enough diamonds" };
    save.currency.diamonds -= amount;
  } else {
    if (save.currency.gold < amount) return { success: false, message: "Not enough gold" };
    save.currency.gold -= amount;
  }
  let name: string;
  if (slot.kind === "scroll") {
    save.materials[SUMMON_SCROLL] = (save.materials[SUMMON_SCROLL] ?? 0) + 1;
    name = "Summoning Scroll";
  } else {
    if (slot.item) save.inventory.items.push(slot.item);
    name = (slot.item && ITEM_CATALOG_MAP.get(slot.item.defId)?.name) || "item";
  }
  save.shop.stock.splice(idx, 1);
  return { success: true, message: `Purchased ${name}` };
}
