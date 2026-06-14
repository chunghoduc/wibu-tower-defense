/**
 * Pure view-model for the wing-craft result reveal. Turns the CraftWingsResult
 * returned by craftWings() into a discriminated success/failure VM the overlay
 * renders. No Phaser — just data, so it's unit-testable and the reveal agrees
 * with tooltips/inventory (same itemInstanceIcon + itemStatRows sources).
 */
import type { CraftWingsResult } from "./wingCraft.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { itemInstanceIcon } from "../data/rewardIcon.ts";
import { itemStatRows, type ItemStatRow } from "../data/itemDisplay.ts";
import type { Rarity } from "../data/schema.ts";

export type WingCraftResultVM =
  | {
      kind: "success";
      name: string;
      rarity: Rarity;
      color: number;
      iconKey: string;
      emoji: string;
      statRows: ItemStatRow[];
    }
  | { kind: "failure" };

export function wingCraftResultView(result: CraftWingsResult): WingCraftResultVM {
  if (result.ok && result.success && result.item) {
    const def = ITEM_CATALOG_MAP.get(result.item.defId);
    if (def) {
      const icon = itemInstanceIcon(result.item);
      return {
        kind: "success",
        name: def.name,
        rarity: result.rarity ?? def.rarity,
        color: icon.color,
        iconKey: icon.iconKey,
        emoji: icon.emoji,
        statRows: itemStatRows(result.item, def),
      };
    }
  }
  return { kind: "failure" };
}
