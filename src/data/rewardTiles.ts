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
import { boxOdds } from "../core/boxes.ts";

const RARITY_ORDER: Rarity[] = ["Common", "Magic", "Rare", "Legendary", "Unique"];
const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc", Magic: "#5fa8ff", Rare: "#c98bff", Legendary: "#ffb74d", Unique: "#ff7a7a",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
export const GOLD_INT = 0xffcf4d, DIAMOND_INT = 0x7ec8ff, MAT_INT = 0xa5d6a7, XP_INT = 0x9cc6ff;

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
  return {
    iconKey: "icon__gold", emoji: "🪙", label: `+${n}`, color: GOLD_INT,
    tooltip: { kind: "info", data: { title: "Gold", titleColor: hex(GOLD_INT), borderColor: GOLD_INT, subtitle: `+${n}`, body: "Everyday currency — spend it in the Shop and on upgrades." } },
  };
}

function diamondTile(n: number): RewardTileSpec {
  return {
    iconKey: "icon__gem", emoji: "💎", label: `+${n}`, color: DIAMOND_INT,
    tooltip: { kind: "info", data: { title: "Diamonds", titleColor: hex(DIAMOND_INT), borderColor: DIAMOND_INT, subtitle: `+${n}`, body: "Premium currency — used for summons and rare shop deals." } },
  };
}

function xpTile(n: number): RewardTileSpec {
  return {
    iconKey: "icon__xp", emoji: "⭐", label: `+${n}`, color: XP_INT,
    tooltip: { kind: "info", data: { title: "Hero XP", titleColor: hex(XP_INT), borderColor: XP_INT, subtitle: `+${n} XP`, body: "Experience earned from kills — levels your hero up." } },
  };
}

function itemTile(inst: ItemInstanceSave): RewardTileSpec {
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  const rarity = def?.rarity ?? "Common";
  return {
    iconKey: `item__${inst.defId}`, emoji: "📦", label: rarity, color: RARITY_INT[rarity],
    tooltip: { kind: "item", inst },
  };
}

function jewelTile(inst: JewelInstanceSave): RewardTileSpec {
  const def = JEWEL_CATALOG_MAP.get(inst.defId);
  const rarity = def?.rarity ?? "Common";
  return {
    iconKey: `jewel__${inst.defId}`, emoji: "💠", label: rarity, color: RARITY_INT[rarity],
    tooltip: { kind: "info", data: { title: def?.name ?? "Jewel", titleColor: RARITY_HEX[rarity], borderColor: RARITY_INT[rarity], subtitle: `${rarity} Jewel`, body: def?.description } },
  };
}

function skillTile(id: string): RewardTileSpec {
  const def = ACTIVE_SKILLS_MAP.get(id);
  const rarity = def?.rarity ?? "Common";
  return {
    iconKey: skillIconKey(id), emoji: "⚡", label: rarity, color: RARITY_INT[rarity],
    tooltip: { kind: "info", data: { title: def?.name ?? "Skill", titleColor: RARITY_HEX[rarity], borderColor: RARITY_INT[rarity], subtitle: `${rarity} Skill`, body: def?.description } },
  };
}

function characterTile(id: string): RewardTileSpec {
  const def = TOWERS.find((t) => t.id === id);
  const rarity = def?.rarity ?? "Common";
  return {
    iconKey: `tower__${id}`, emoji: "✨", label: rarity, color: RARITY_INT[rarity],
    tooltip: { kind: "info", data: { title: def?.name ?? "New Character", titleColor: RARITY_HEX[rarity], borderColor: RARITY_INT[rarity], subtitle: def ? `${rarity} ${def.role}` : "New character", body: def?.description } },
  };
}

/** A box tooltip lists its opening odds so players can see the drop rates. */
function boxOddsBody(id: string, desc?: string): string {
  const o = boxOdds(id);
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const lines = [
    "Opening odds:",
    `• ~${o.crystals} gold + ${o.bless}× Bless Jewel (guaranteed)`,
    `• ${pct(o.soulChance)} Soul Jewel`,
    `• ${pct(o.itemChance)} gear drop (around lvl ${o.itemLevel})`,
  ];
  return desc ? `${desc}\n\n${lines.join("\n")}` : lines.join("\n");
}

function materialTile(id: string, n: number): RewardTileSpec {
  const def = MATERIALS_MAP.get(id);
  // Boxes only ship a `box__<id>` texture; other materials use `material__<id>`.
  const isBox = def?.kind === "box";
  const iconKey = isBox ? `box__${id}` : `material__${id}`;
  const color = isBox && def?.rarity ? RARITY_INT[RARITY_ORDER[def.rarity - 1] ?? "Common"] : MAT_INT;
  const subtitle = isBox ? `Tier ${boxOdds(id).tier} Boss Chest · ×${n}` : `×${n}`;
  const body = isBox ? boxOddsBody(id, def?.description) : def?.description;
  return {
    iconKey, emoji: isBox ? "🎁" : "💠", label: `×${n}`, color,
    tooltip: { kind: "info", data: { title: def?.name ?? id, titleColor: hex(color), borderColor: color, subtitle, body } },
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
  outcome: "won" | "lost", loot: BattleLoot, clear: DropResult | null,
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
