/**
 * BattleScene helpers — module-level constants + pure helpers split out of
 * BattleScene.ts to keep the scene class focused (T10).
 */
import Phaser from "phaser";
import type { CharacterDef } from "../data/schema.ts";
import type { HeroSave } from "../core/save.ts";
import type { EnemyRuntime } from "../core/battle.ts";
import type { Catalog } from "../data/catalog.ts";
import { TOWERS } from "../data/towers.ts";

/** Preferred squad order — one per role plus a Unique marquee. */
export const PREFERRED_SQUAD: string[] = [
  "zoran-thricedraw",
  "iron-bo-cannonarm",
  "hyo-frost-arc",
  "shion-venom-priestess",
  "yuki-frostward-maiden",
  "aldric-banner-bearer",
  "karu-sunfist",
];

export const SQUAD_SIZE = 7;
export const SLOT_RADIUS = 26;

export const TERRAIN_COLOR: Record<string, number> = {
  grass: 0x35562f,
  sand: 0xb8a05a,
  water: 0x2a5f93,
  stone: 0x6b6c74,
  jungle: 0x1f4a2a,
  mountain: 0x5a4d40,
  lava: 0xc24a1e,
  ice: 0x7fb4dd,
  snow: 0xd8e4f0,
  crystal: 0x6a32b0,
};

// Re-exported for BattleScene/battleSceneInput (historical import site).
export { RARITY_INT } from "../data/rarityColors.ts";
// Pure stat formatting lives in statFormat.ts (Phaser-free, unit-tested);
// re-exported here so existing import sites stay stable.
export {
  n0,
  n1,
  pct,
  mult,
  statRows,
  HERO_STAT_KEYS,
  TOWER_STAT_KEYS,
  AURA_BUFF_COLOR,
  towerStatRows,
} from "./statFormat.ts";

export const ROLE_COLOR: Record<string, number> = {
  damage: 0x4fc3f7,
  splash: 0xff8a65,
  chain: 0xba68c8,
  dot: 0x9ccc65,
  support: 0xfff176,
  debuff: 0x4db6ac,
  tanker: 0x90a4ae,
  economy: 0xffd54f,
};

/** Towers with reach attack from afar (ranged); short-reach ones are melee (T5). */
export const RANGED_THRESHOLD = 120;
export function towerKind(def: CharacterDef): "melee" | "ranged" {
  return def.baseStats.range >= RANGED_THRESHOLD ? "ranged" : "melee";
}
export const KIND_COLOR: Record<"melee" | "ranged", number> = { melee: 0xff7a33, ranged: 0x46c2f0 };

/** Body tint for an enemy's dominant status: frozen > burning/poison (T8). */
export function enemyStatusTint(e: EnemyRuntime): number | null {
  if (e.slowPct >= 0.6) return 0x9fd8ff; // frozen — icy blue
  if (e.dots.length > 0) {
    const t = e.dots[0].type;
    return t === "Magic" ? 0xb6e07a : t === "True" ? 0xfff0b0 : 0xffb38a; // poison / sear / burn
  }
  return null;
}

/** Points of a 5-point star centered at (cx,cy). */
export function starPoints(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

/**
 * Build a squad of up to SQUAD_SIZE towers from the player's owned collection.
 * Prefers PREFERRED_SQUAD order when those towers are owned. If the player owns
 * nothing (fresh save), returns the full PREFERRED_SQUAD as a fallback so the
 * game is immediately playable without any collection.
 */
export function buildSquad(save: HeroSave, catalog: Catalog): CharacterDef[] {
  const owned = new Set(Object.keys(save.collection));

  // A player-chosen squad takes priority (only the still-owned members).
  const chosen = (save.squad ?? [])
    .filter((id) => owned.has(id))
    .map((id) => catalog.characters.get(id))
    .filter((c): c is CharacterDef => Boolean(c));
  if (chosen.length > 0) return chosen.slice(0, SQUAD_SIZE);

  const preferred = PREFERRED_SQUAD.filter((id) => owned.has(id))
    .map((id) => catalog.characters.get(id))
    .filter((c): c is CharacterDef => Boolean(c));

  if (preferred.length < SQUAD_SIZE && owned.size > 0) {
    for (const t of TOWERS) {
      if (preferred.length >= SQUAD_SIZE) break;
      if (owned.has(t.id) && !preferred.find((p) => p.id === t.id)) {
        const def = catalog.characters.get(t.id);
        if (def) preferred.push(def);
      }
    }
  }

  // Empty collection → unrestricted fallback so new players can play immediately
  if (preferred.length === 0) {
    return PREFERRED_SQUAD.map((id) => catalog.characters.get(id)).filter((c): c is CharacterDef =>
      Boolean(c),
    );
  }

  return preferred;
}
