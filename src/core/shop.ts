/**
 * Shop — a rotating stock of rolled equipment plus the occasional Summoning
 * Scroll. Stock is PERSISTED on the save so a purchased slot stays sold (the old
 * shop "lost" bought items). Players can reroll the stock for crystals, buy
 * slots (items land in the inventory, scrolls in materials), and sell unwanted
 * items back for 75% of their value.
 */
import { ITEM_CATALOG, ITEM_CATALOG_MAP, rollItem, itemValue, itemSellValue } from "../data/items.ts";
import { toItemInstanceSave } from "./itemDrop.ts";
import { SUMMON_SCROLL } from "../data/materials.ts";
import { SINGLE_PULL_COST } from "./gacha.ts";
import { Rng } from "./rng.ts";
import type { HeroSave, ShopStockEntry } from "./save.ts";

export const SHOP_SIZE = 8;
export const SHOP_FREE_REFRESHES = 3;   // free rerolls granted each day
export const SHOP_REFRESH_STEP = 20;    // every reroll past the free ones costs +20 crystals
// A summoning scroll is a bargain versus the summon UI: cheaper than a single pull.
export const SCROLL_SHOP_COST = Math.round(SINGLE_PULL_COST * 0.75); // 120, vs a 160 pull
export const SCROLL_SLOT_CHANCE = 0.04; // <5% chance a given slot offers a scroll, per refresh

export interface PurchaseResult {
  success: boolean;
  message: string;
}

let _slotCounter = 0;
function newSlotId(): string { return `slot-${(_slotCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`; }

function shopItemLevel(save: HeroSave): number {
  return Math.max(1, save.hero.level);
}

/** Roll a fresh stock of SHOP_SIZE slots (mostly items, occasionally a scroll). */
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

/** Populate the shop on first visit / fresh save (no crystal cost). */
export function ensureShopStock(save: HeroSave, rng: Rng): void {
  if (!save.shop.stock || save.shop.stock.length === 0) {
    save.shop.stock = generateShopStock(save, rng);
  }
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

/** Reset the day's free-refresh allowance when the calendar date changes. */
function rolloverRefreshes(save: HeroSave, today: string): void {
  if (save.shop.refreshDate !== today) { save.shop.refreshDate = today; save.shop.refreshesToday = 0; }
}

/**
 * Crystals the NEXT manual refresh will cost. The first SHOP_FREE_REFRESHES of
 * the day are free; after that each one costs SHOP_REFRESH_STEP more than the
 * last (20, 40, 60, …). The allowance resets daily.
 */
export function shopRefreshCost(save: HeroSave, today: string = todayStr()): number {
  rolloverRefreshes(save, today);
  const past = save.shop.refreshesToday - SHOP_FREE_REFRESHES;
  return past < 0 ? 0 : SHOP_REFRESH_STEP * (past + 1);
}

/** Reroll the shop stock; the first few rerolls each day are free (see shopRefreshCost). */
export function refreshShop(save: HeroSave, rng: Rng, today: string = todayStr()): PurchaseResult {
  const cost = shopRefreshCost(save, today);
  if (save.currency.crystals < cost) return { success: false, message: `Need ${cost} 💎 to refresh` };
  save.currency.crystals -= cost;
  save.shop.refreshesToday += 1;
  save.shop.stock = generateShopStock(save, rng);
  return { success: true, message: cost > 0 ? `Refreshed (−${cost} 💎)` : "Refreshed (free)" };
}

/** Buy a stock slot: grant the item (→ inventory) or scroll (→ materials), remove the slot. */
export function buyShopSlot(save: HeroSave, slotId: string): PurchaseResult {
  const idx = save.shop.stock.findIndex((s) => s.slotId === slotId);
  if (idx < 0) return { success: false, message: "Item no longer available" };
  const slot = save.shop.stock[idx];
  if (save.currency.crystals < slot.cost) return { success: false, message: "Not enough crystals" };
  save.currency.crystals -= slot.cost;
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

/** Sell an inventory item back for 75% of its value. Equipped items can't be sold. */
export function sellItem(save: HeroSave, instanceId: string): PurchaseResult & { refund: number } {
  if (Object.values(save.inventory.equipped).includes(instanceId)) {
    return { success: false, message: "Unequip the item first", refund: 0 };
  }
  const idx = save.inventory.items.findIndex((it) => it.id === instanceId);
  if (idx < 0) return { success: false, message: "Item not found", refund: 0 };
  const def = ITEM_CATALOG_MAP.get(save.inventory.items[idx].defId);
  const refund = def ? itemSellValue(def) : 0;
  save.inventory.items.splice(idx, 1);
  save.currency.crystals += refund;
  return { success: true, message: `Sold for ${refund} crystals`, refund };
}
