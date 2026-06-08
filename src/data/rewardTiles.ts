// src/data/rewardTiles.ts
//
// Pure mapping from a battle's DropResult to render-ready reward-tile
// descriptors. Kept free of Phaser so it can be unit-tested; the scene-side
// rewardPanel.ts consumes these specs and draws the icons + hover tooltips.
import type { DropResult } from "../core/drops.ts";
import type { ItemInstanceSave } from "../core/save.ts";
import type { Rarity } from "./schema.ts";
import type { InfoTooltipData } from "../scenes/infoTooltip.ts";
import { ITEM_CATALOG_MAP } from "./items.ts";
import { JEWEL_CATALOG_MAP } from "./jewels.ts";
import { ACTIVE_SKILLS_MAP } from "./skills.ts";
import { skillIconKey } from "./skillIconManifest.ts";
import { TOWERS } from "./towers.ts";
import { MATERIALS_MAP } from "./materials.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc", Magic: "#5fa8ff", Rare: "#c98bff", Legendary: "#ffb74d", Unique: "#ff7a7a",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
export const GOLD_INT = 0xffcf4d, DIAMOND_INT = 0x7ec8ff, MAT_INT = 0xa5d6a7;

/** How a tile's hover detail should be rendered. */
export type TileTooltip =
  | { kind: "item"; inst: ItemInstanceSave }
  | { kind: "info"; data: InfoTooltipData };

export interface RewardTileSpec {
  /** Painted-icon texture key (used when the texture is loaded). */
  iconKey: string;
  /** Emoji fallback when the texture is missing. */
  emoji: string;
  /** Small caption under the icon (count for stacks, rarity for uniques). */
  label: string;
  /** Border / caption colour. */
  color: number;
  tooltip: TileTooltip;
}

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

/** Map a battle's DropResult to an ordered list of render-ready reward tiles. */
export function rewardTileSpecs(result: DropResult): RewardTileSpec[] {
  const tiles: RewardTileSpec[] = [];

  if (result.goldAwarded > 0) {
    tiles.push({
      iconKey: "icon__gold", emoji: "🪙", label: `+${result.goldAwarded}`, color: GOLD_INT,
      tooltip: { kind: "info", data: { title: "Gold", titleColor: hex(GOLD_INT), borderColor: GOLD_INT, subtitle: `+${result.goldAwarded}`, body: "Everyday currency — spend it in the Shop and on upgrades." } },
    });
  }
  if (result.diamondsAwarded > 0) {
    tiles.push({
      iconKey: "icon__gem", emoji: "💎", label: `+${result.diamondsAwarded}`, color: DIAMOND_INT,
      tooltip: { kind: "info", data: { title: "Diamonds", titleColor: hex(DIAMOND_INT), borderColor: DIAMOND_INT, subtitle: `+${result.diamondsAwarded}`, body: "Premium currency — used for summons and rare shop deals." } },
    });
  }
  if (result.itemDropped) {
    const def = ITEM_CATALOG_MAP.get(result.itemDropped.defId);
    const rarity = def?.rarity ?? "Common";
    tiles.push({
      iconKey: `item__${result.itemDropped.defId}`, emoji: "📦", label: rarity, color: RARITY_INT[rarity],
      tooltip: { kind: "item", inst: result.itemDropped },
    });
  }
  if (result.jewelDropped) {
    const def = JEWEL_CATALOG_MAP.get(result.jewelDropped.defId);
    const rarity = def?.rarity ?? "Common";
    tiles.push({
      iconKey: `jewel__${result.jewelDropped.defId}`, emoji: "💠", label: rarity, color: RARITY_INT[rarity],
      tooltip: { kind: "info", data: { title: def?.name ?? "Jewel", titleColor: RARITY_HEX[rarity], borderColor: RARITY_INT[rarity], subtitle: `${rarity} Jewel`, body: def?.description } },
    });
  }
  if (result.skillDropped) {
    const def = ACTIVE_SKILLS_MAP.get(result.skillDropped);
    const rarity = def?.rarity ?? "Common";
    tiles.push({
      iconKey: skillIconKey(result.skillDropped), emoji: "⚡", label: rarity, color: RARITY_INT[rarity],
      tooltip: { kind: "info", data: { title: def?.name ?? "Skill", titleColor: RARITY_HEX[rarity], borderColor: RARITY_INT[rarity], subtitle: `${rarity} Skill`, body: def?.description } },
    });
  }
  if (result.characterDropped) {
    const def = TOWERS.find((t) => t.id === result.characterDropped);
    const rarity = def?.rarity ?? "Common";
    tiles.push({
      iconKey: `tower__${result.characterDropped}`, emoji: "✨", label: rarity, color: RARITY_INT[rarity],
      tooltip: { kind: "info", data: { title: def?.name ?? "New Character", titleColor: RARITY_HEX[rarity], borderColor: RARITY_INT[rarity], subtitle: def ? `${rarity} ${def.role}` : "New character", body: def?.description } },
    });
  }
  for (const [id, n] of Object.entries(result.materialsDropped ?? {})) {
    if (!n) continue;
    const def = MATERIALS_MAP.get(id);
    tiles.push({
      iconKey: `material__${id}`, emoji: "💠", label: `×${n}`, color: MAT_INT,
      tooltip: { kind: "info", data: { title: def?.name ?? id, titleColor: hex(MAT_INT), borderColor: MAT_INT, subtitle: `×${n}`, body: def?.description } },
    });
  }
  return tiles;
}
