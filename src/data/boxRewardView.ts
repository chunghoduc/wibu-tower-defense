/**
 * Turn a rolled BoxReward into a flat, render-ready list of reward entries for
 * the box-open reveal card. Pure (no Phaser) so it can be unit-tested; the
 * overlay just iterates the entries and draws a tile per one.
 */
import type { BoxReward } from "../core/boxes.ts";
import { MATERIALS_MAP } from "./materials.ts";
import { ITEM_CATALOG_MAP } from "./items.ts";
import type { Rarity } from "./schema.ts";
import { itemTex, materialTex, GOLD_TEX, GEM_TEX } from "./assetKeys.ts";

export interface BoxRewardEntry {
  kind: "gold" | "diamond" | "material" | "item";
  name: string;
  count: number;
  color: string; // hex string for the tile tint / border
  iconKey?: string; // texture key (icon__gold / material__<id> / item__<id>)
}

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

export function boxRewardEntries(reward: BoxReward): BoxRewardEntry[] {
  const entries: BoxRewardEntry[] = [
    { kind: "gold", name: "Gold", count: reward.crystals, color: "#ffcf4d", iconKey: GOLD_TEX },
  ];
  if (reward.diamonds > 0) {
    entries.push({
      kind: "diamond",
      name: "Diamonds",
      count: reward.diamonds,
      color: "#4dd0e1",
      iconKey: GEM_TEX,
    });
  }
  for (const [mid, n] of Object.entries(reward.materials)) {
    if (!n) continue;
    entries.push({
      kind: "material",
      name: MATERIALS_MAP.get(mid)?.name ?? mid,
      count: n,
      color: "#a5d6a7",
      iconKey: materialTex(mid),
    });
  }
  for (const item of reward.items) {
    const def = ITEM_CATALOG_MAP.get(item.defId);
    entries.push({
      kind: "item",
      name: def?.name ?? "Item",
      count: 1,
      color: def ? RARITY_HEX[def.rarity] : "#ffd34d",
      iconKey: itemTex(item.defId),
    });
  }
  return entries;
}
