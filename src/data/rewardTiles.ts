// src/data/rewardTiles.ts
//
// Pure mapping from a battle's loot to render-ready reward-tile descriptors.
// Kept free of Phaser so it can be unit-tested; the scene-side rewardPanel.ts
// consumes these specs and draws the icons + hover tooltips.
//
// Two inputs feed this: the stage-clear DropResult (won only) and the loot
// gathered DURING the battle (item/box drops from kills, hero XP — kept even
// on a loss). buildLootSummary merges both into a BattleLootSummary, and
// battleLootTiles turns that into tiles. rewardTileSpecs is the legacy
// DropResult-only entry point, kept for callers/tests.
import type { DropResult } from "../core/drops.ts";
import type { ItemInstanceSave, JewelInstanceSave } from "../core/save.ts";
import type { Rarity } from "./schema.ts";
import type { InfoTooltipData } from "../scenes/infoTooltip.ts";
import { ITEM_CATALOG_MAP } from "./items.ts";
import { JEWEL_CATALOG_MAP } from "./jewels.ts";
import { ACTIVE_SKILLS_MAP } from "./skills.ts";
import { skillIconKey } from "./skillIconManifest.ts";
import { TOWERS } from "./towers.ts";
import { MATERIALS_MAP } from "./materials.ts";
import { boxOdds, boxOddsText } from "../core/boxes.ts";
import {
  goldIcon,
  diamondIcon,
  xpIcon,
  itemIcon,
  jewelIcon,
  materialIcon,
  RARITY_INT,
  GOLD_INT,
  DIAMOND_INT,
  MAT_INT,
  XP_INT,
} from "./rewardIcon.ts";
import { towerTex } from "./assetKeys.ts";

// Color ints live in rewardIcon.ts (the single icon source of truth); re-export
// for any external caller that imported them from here historically.
export { GOLD_INT, DIAMOND_INT, MAT_INT, XP_INT };

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc",
  Magic: "#5fa8ff",
  Rare: "#c98bff",
  Legendary: "#ffb74d",
  Unique: "#ff7a7a",
};

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

/** Loot gathered during the battle (kept even on a loss). */
export interface BattleLoot {
  items: ItemInstanceSave[];
  /** Box id -> count (guaranteed elite-kill loot boxes). */
  boxes: Record<string, number>;
  xp: number;
}

/** Everything looted in a single battle, merged from kill-drops + stage clear. */
export interface BattleLootSummary {
  outcome: "won" | "lost";
  isFirstClear: boolean;
  xp: number;
  gold: number;
  diamonds: number;
  items: ItemInstanceSave[];
  jewels: JewelInstanceSave[];
  skills: string[];
  characters: string[];
  /** Material/box id -> count (boxes from elite kills + stage-clear mats). */
  materials: Record<string, number>;
}

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

// ---- Per-kind tile builders --------------------------------------------------

function goldTile(n: number): RewardTileSpec {
  const v = goldIcon();
  return {
    iconKey: v.iconKey,
    emoji: v.emoji,
    label: `+${n}`,
    color: v.color,
    tooltip: {
      kind: "info",
      data: {
        title: "Gold",
        titleColor: hex(GOLD_INT),
        borderColor: GOLD_INT,
        subtitle: `+${n}`,
        body: "Everyday currency — spend it in the Shop and on upgrades.",
      },
    },
  };
}

function diamondTile(n: number): RewardTileSpec {
  const v = diamondIcon();
  return {
    iconKey: v.iconKey,
    emoji: v.emoji,
    label: `+${n}`,
    color: v.color,
    tooltip: {
      kind: "info",
      data: {
        title: "Diamonds",
        titleColor: hex(DIAMOND_INT),
        borderColor: DIAMOND_INT,
        subtitle: `+${n}`,
        body: "Premium currency — used for summons and rare shop deals.",
      },
    },
  };
}

function xpTile(n: number): RewardTileSpec {
  const v = xpIcon();
  return {
    iconKey: v.iconKey,
    emoji: v.emoji,
    label: `+${n}`,
    color: v.color,
    tooltip: {
      kind: "info",
      data: {
        title: "Hero XP",
        titleColor: hex(XP_INT),
        borderColor: XP_INT,
        subtitle: `+${n} XP`,
        body: "Experience earned from kills — levels your hero up.",
      },
    },
  };
}

function itemTile(inst: ItemInstanceSave): RewardTileSpec {
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  const rarity = def?.rarity ?? "Common";
  const v = itemIcon(rarity, inst.defId);
  return {
    iconKey: v.iconKey,
    emoji: v.emoji,
    label: rarity,
    color: v.color,
    tooltip: { kind: "item", inst },
  };
}

function jewelTile(inst: JewelInstanceSave): RewardTileSpec {
  const def = JEWEL_CATALOG_MAP.get(inst.defId);
  const rarity = def?.rarity ?? "Common";
  const v = jewelIcon(rarity, inst.defId);
  return {
    iconKey: v.iconKey,
    emoji: v.emoji,
    label: rarity,
    color: v.color,
    tooltip: {
      kind: "info",
      data: {
        title: def?.name ?? "Jewel",
        titleColor: RARITY_HEX[rarity],
        borderColor: v.color,
        subtitle: `${rarity} Jewel`,
        body: def?.description,
      },
    },
  };
}

function skillTile(id: string): RewardTileSpec {
  const def = ACTIVE_SKILLS_MAP.get(id);
  const rarity = def?.rarity ?? "Common";
  return {
    iconKey: skillIconKey(id),
    emoji: "⚡",
    label: rarity,
    color: RARITY_INT[rarity],
    tooltip: {
      kind: "info",
      data: {
        title: def?.name ?? "Skill",
        titleColor: RARITY_HEX[rarity],
        borderColor: RARITY_INT[rarity],
        subtitle: `${rarity} Skill`,
        body: def?.description,
      },
    },
  };
}

function characterTile(id: string): RewardTileSpec {
  const def = TOWERS.find((t) => t.id === id);
  const rarity = def?.rarity ?? "Common";
  return {
    iconKey: towerTex(id),
    emoji: "✨",
    label: rarity,
    color: RARITY_INT[rarity],
    tooltip: {
      kind: "info",
      data: {
        title: def?.name ?? "New Character",
        titleColor: RARITY_HEX[rarity],
        borderColor: RARITY_INT[rarity],
        subtitle: def ? `${rarity} ${def.role}` : "New character",
        body: def?.description,
      },
    },
  };
}

/** A box tooltip lists its opening odds so players can see the drop rates. */
function boxOddsBody(id: string, desc?: string): string {
  const odds = boxOddsText(id);
  return desc ? `${desc}\n\n${odds}` : odds;
}

function materialTile(id: string, n: number): RewardTileSpec {
  const def = MATERIALS_MAP.get(id);
  const isBox = def?.kind === "box";
  const v = materialIcon(id); // box__<id>+rarity color, or material__<id>+MAT color
  const subtitle = isBox ? `Tier ${boxOdds(id).tier} Boss Chest · ×${n}` : `×${n}`;
  const body = isBox ? boxOddsBody(id, def?.description) : def?.description;
  return {
    iconKey: v.iconKey,
    emoji: v.emoji,
    label: `×${n}`,
    color: v.color,
    tooltip: {
      kind: "info",
      data: {
        title: def?.name ?? id,
        titleColor: hex(v.color),
        borderColor: v.color,
        subtitle,
        body,
      },
    },
  };
}

// ---- Entry points ------------------------------------------------------------

/** Turn a merged battle-loot summary into an ordered list of reward tiles. */
export function battleLootTiles(s: BattleLootSummary): RewardTileSpec[] {
  const tiles: RewardTileSpec[] = [];
  if (s.gold > 0) tiles.push(goldTile(s.gold));
  if (s.diamonds > 0) tiles.push(diamondTile(s.diamonds));
  for (const inst of s.items) tiles.push(itemTile(inst));
  for (const inst of s.jewels) tiles.push(jewelTile(inst));
  for (const id of s.skills) tiles.push(skillTile(id));
  for (const id of s.characters) tiles.push(characterTile(id));
  for (const [id, n] of Object.entries(s.materials)) {
    if (n > 0) tiles.push(materialTile(id, n));
  }
  if (s.xp > 0) tiles.push(xpTile(s.xp));
  return tiles;
}

/** Merge in-battle loot with the (won-only) stage-clear DropResult. */
export function buildLootSummary(
  outcome: "won" | "lost",
  loot: BattleLoot,
  clear: DropResult | null,
): BattleLootSummary {
  const materials: Record<string, number> = { ...loot.boxes };
  for (const [id, n] of Object.entries(clear?.materialsDropped ?? {})) {
    materials[id] = (materials[id] ?? 0) + n;
  }
  return {
    outcome,
    isFirstClear: clear?.isFirstClear ?? false,
    xp: loot.xp,
    gold: clear?.goldAwarded ?? 0,
    diamonds: clear?.diamondsAwarded ?? 0,
    items: [...loot.items, ...(clear?.itemDropped ? [clear.itemDropped] : [])],
    jewels: clear?.jewelDropped ? [clear.jewelDropped] : [],
    skills: clear?.skillDropped ? [clear.skillDropped] : [],
    characters: clear?.characterDropped ? [clear.characterDropped] : [],
    materials,
  };
}

/** Legacy: map a stage-clear DropResult straight to tiles (no in-battle loot). */
export function rewardTileSpecs(result: DropResult): RewardTileSpec[] {
  return battleLootTiles(buildLootSummary("won", { items: [], boxes: {}, xp: 0 }, result));
}
