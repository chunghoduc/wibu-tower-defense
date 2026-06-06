import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import type { HeroSave } from "./save.ts";

export interface ShopEntry {
  id: string;
  name: string;
  cost: number;
  rewardType: "character" | "pity-boost";
  rewardRef: string;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
}

const MAGIC_CHARS = TOWERS.filter((t) => t.rarity === "Magic").slice(0, 3);

export const SHOP_CATALOG: ShopEntry[] = [
  ...MAGIC_CHARS.map((c) => ({
    id: `shop-char-${c.id}`,
    name: c.name,
    cost: 800,
    rewardType: "character" as const,
    rewardRef: c.id,
  })),
  {
    id: "shop-pity-boost",
    name: "Pity Insurance (guaranteed Rare+ next pull)",
    cost: 400,
    rewardType: "pity-boost" as const,
    rewardRef: "pity",
  },
];

export function purchaseShopItem(save: HeroSave, entryId: string): PurchaseResult {
  const entry = SHOP_CATALOG.find((e) => e.id === entryId);
  if (!entry) return { success: false, message: "Unknown shop item" };
  if (save.currency.crystals < entry.cost) return { success: false, message: "Not enough crystals" };
  save.currency.crystals -= entry.cost;
  if (entry.rewardType === "character") {
    addTowerToCollection(save, entry.rewardRef);
  } else if (entry.rewardType === "pity-boost") {
    save.currency.pityCount = Math.max(save.currency.pityCount, 74);
  }
  return { success: true, message: `Purchased ${entry.name}` };
}
