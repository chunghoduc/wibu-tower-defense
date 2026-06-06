/**
 * AI art prompt pipeline — Phase 4.
 *
 * Pure, deterministic generators that turn the finished data catalogs into
 * 8-bit pixel-art generation prompts. Feed allArtPrompts() output to any image
 * model (Midjourney/DALL·E/SD); save each result to the entry's `path` and the
 * PreloadScene picks it up automatically (no code change).
 *
 * Why data-driven prompts: the catalogs already encode everything that should
 * drive the art (rarity, role, damage type, silhouette, lore). Generating
 * prompts from that data keeps art consistent with mechanics and lets the whole
 * roster be (re)generated in one pass.
 */
import {
  ANIMATION_FRAMES,
  RARITY_PALETTE,
  ROLE_SILHOUETTE,
  SPRITE_DIMENSIONS,
  STYLE_PREAMBLE,
  spriteKey,
  spritePath,
  type ArtKind,
} from "./artSpec.ts";
import { ENEMIES } from "./enemies.ts";
import { ITEM_CATALOG } from "./items.ts";
import type { CharacterDef, EnemyDef, ItemDef } from "./schema.ts";
import { TOWERS } from "./towers.ts";

export interface ArtPromptEntry {
  /** Texture key, e.g. "tower__zoran-thricedraw". */
  key: string;
  /** Public path to save the generated PNG to. */
  path: string;
  /** The full generation prompt. */
  prompt: string;
}

function dims(kind: ArtKind): string {
  const d = SPRITE_DIMENSIONS[kind];
  return `${d.w}x${d.h}`;
}

function rarityClause(rarity: CharacterDef["rarity"]): string {
  const p = RARITY_PALETTE[rarity];
  return `${rarity} rarity — accent colour ${p.accent}, ${p.treatment}`;
}

/** Build a prompt for a collectible tower/character. */
export function towerPrompt(def: CharacterDef): string {
  const silhouette = ROLE_SILHOUETTE[def.role] ?? "distinct readable silhouette";
  const damage = def.damageType === "Magic" ? "arcane/magical motif" : "martial/physical motif";
  return [
    STYLE_PREAMBLE,
    `${dims("tower")} character sprite.`,
    `Name: "${def.name}".`,
    `Role: ${def.role} tower (${silhouette}).`,
    `Attack: ${def.damageType} (${damage}); targets ${def.target}.`,
    rarityClause(def.rarity),
    `Lore: ${def.description}`,
    `Provide ${ANIMATION_FRAMES.length} frames (${ANIMATION_FRAMES.join(", ")}) sharing one palette and silhouette.`,
  ].join(" ");
}

/** Build a prompt for an enemy or boss. */
export function enemyPrompt(def: EnemyDef): string {
  const kind: ArtKind = def.archetype === "Boss" ? "boss" : "enemy";
  const motion = def.flying ? "flying creature with wings, airborne pose" : "ground unit, grounded stance";
  const immune = def.immunity ? `Visually telegraph ${def.immunity} immunity.` : "";
  const menace = kind === "boss" ? "imposing boss, large and threatening, " : "";
  return [
    STYLE_PREAMBLE,
    `${dims(kind)} ${menace}enemy sprite.`,
    `Name: "${def.name}", archetype ${def.archetype}.`,
    `${motion}; deals ${def.damageType} damage.`,
    immune,
    `Hostile, distinct from the player's collectible characters (darker, corrupted palette).`,
    `Provide ${ANIMATION_FRAMES.length} frames (${ANIMATION_FRAMES.join(", ")}).`,
  ].filter(Boolean).join(" ");
}

/** Build a prompt for an equipment item icon. */
export function itemPrompt(def: ItemDef): string {
  const weapon = def.weaponType ? ` (${def.weaponType})` : "";
  return [
    STYLE_PREAMBLE,
    `${dims("item")} inventory item icon.`,
    `Name: "${def.name}".`,
    `Equipment slot: ${def.slot}${weapon}.`,
    rarityClause(def.rarity),
    `Single static icon, clear on a dark inventory background.`,
  ].join(" ");
}

/** Every prompt for the whole roster: towers, enemies, items. */
export function allArtPrompts(): ArtPromptEntry[] {
  const entries: ArtPromptEntry[] = [];

  for (const t of TOWERS) {
    entries.push({ key: spriteKey("tower", t.id), path: spritePath("tower", t.id), prompt: towerPrompt(t) });
  }
  for (const e of ENEMIES) {
    const kind: ArtKind = e.archetype === "Boss" ? "boss" : "enemy";
    entries.push({ key: spriteKey(kind, e.id), path: spritePath(kind, e.id), prompt: enemyPrompt(e) });
  }
  for (const it of ITEM_CATALOG) {
    entries.push({ key: spriteKey("item", it.id), path: spritePath("item", it.id), prompt: itemPrompt(it) });
  }

  return entries;
}
