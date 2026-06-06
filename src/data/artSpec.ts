/**
 * Canonical art specification — Phase 4.
 *
 * 8-bit / pixel-art, AI-generated, authored AFTER the data catalogs (which are
 * complete). This module is the single source of truth for:
 *   - canonical sprite dimensions per entity class,
 *   - the disciplined palette + style rules every prompt repeats,
 *   - the sprite-key / filename convention the loader and renderers share.
 *
 * No Phaser import here so it stays unit-testable. PreloadScene reads
 * SPRITE_MANIFEST to load whatever PNGs exist; renderers call spriteKey() and
 * fall back to placeholder shapes when the texture is absent.
 */
import type { Rarity, TowerRole } from "./schema.ts";

/** Entity classes that get sprites. */
export type ArtKind = "tower" | "enemy" | "boss" | "hero" | "item";

/** Canonical pixel dimensions (the source frame; rendering scales as needed). */
export const SPRITE_DIMENSIONS: Record<ArtKind, { w: number; h: number }> = {
  tower: { w: 32, h: 32 },
  enemy: { w: 24, h: 24 },
  boss: { w: 48, h: 48 },
  hero: { w: 32, h: 32 },
  item: { w: 16, h: 16 },
};

/** Animation frames every animated entity provides, in canonical order. */
export const ANIMATION_FRAMES = ["idle", "attack", "hit", "death"] as const;
export type AnimationFrame = (typeof ANIMATION_FRAMES)[number];

/**
 * Rarity drives the palette accent + frame/glow treatment so rarity reads at a
 * glance on the board, matching the UI rarity colours used in the scenes.
 */
export const RARITY_PALETTE: Record<Rarity, { accent: string; treatment: string }> = {
  Common: { accent: "muted grey-steel", treatment: "no frame, flat shading" },
  Magic: { accent: "cobalt blue", treatment: "thin blue rim-light" },
  Rare: { accent: "royal purple", treatment: "purple rim-light, subtle sparkle" },
  Legendary: { accent: "molten orange-gold", treatment: "glowing gold outline, ember motes" },
  Unique: { accent: "crimson red", treatment: "radiant crimson aura, animated glow" },
};

/** Per-role silhouette guidance so each role reads distinctly at 32×32. */
export const ROLE_SILHOUETTE: Record<TowerRole, string> = {
  damage: "lean aggressive stance, a clear weapon held forward, sharp angular silhouette",
  splash: "broad heavy frame, a wide-impact weapon (cannon/maul), bulky base",
  chain: "elegant upright pose, arcs/links/coils motif, tall thin silhouette",
  dot: "hooded or hunched poison-themed figure, dripping/trailing motif",
  support: "banner, standard, or instrument raised; open welcoming stance",
  debuff: "cold/controlling theme, frost or chains, outstretched controlling hand",
};

/** Global style preamble repeated in every prompt for consistency. */
export const STYLE_PREAMBLE =
  "8-bit retro pixel art sprite, NES/SNES era, limited disciplined palette, " +
  "crisp single-pixel outline, strong readable silhouette, transparent background, " +
  "front-facing or 3/4 view, no text, no signature, centered";

/** Folder under /public where sprites live. */
export const SPRITE_ROOT = "assets/sprites";

/**
 * Stable texture key / filename stem for an entity.
 * Example: spriteKey("tower", "zoran-thricedraw") -> "tower__zoran-thricedraw".
 */
export function spriteKey(kind: ArtKind, id: string): string {
  return `${kind}__${id}`;
}

/** Public path the loader fetches (single static frame for now). */
export function spritePath(kind: ArtKind, id: string): string {
  return `${SPRITE_ROOT}/${kind}/${id}.png`;
}
