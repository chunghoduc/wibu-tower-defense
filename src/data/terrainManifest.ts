/**
 * Terrain art manifest. The SVG files under public/assets/terrain/ are authored
 * by the `svg-asset-gen` skill (see .claude/skills/svg-asset-gen). Phaser loads
 * each .svg directly via `load.svg()` — it rasterizes in-browser, so no build
 * step or PNG baking is needed. Regenerate the art with:
 *
 *   node .claude/skills/svg-asset-gen/scripts/gen-terrain.mjs \
 *     --out public/assets/terrain --variants 3 --size 128
 *
 * Keep TERRAIN_VARIANTS in sync with the --variants used above.
 */
import type { TerrainType } from "./schema.ts";

export const TERRAIN_ART_TYPES: TerrainType[] = ["grass", "sand", "water", "stone", "jungle", "mountain"];
export const TERRAIN_VARIANTS = 3;
/** Pixel size the SVGs are rasterized to at load time (square). */
export const TERRAIN_TEX_SIZE = 128;

export interface TerrainAsset {
  key: string;          // Phaser texture key, e.g. "terrain__water_2"
  type: TerrainType;
  variant: number;      // 1-based
  path: string;         // relative to /public
}

export const TERRAIN_ASSETS: TerrainAsset[] = TERRAIN_ART_TYPES.flatMap((type) =>
  Array.from({ length: TERRAIN_VARIANTS }, (_, i) => {
    const variant = i + 1;
    return { key: `terrain__${type}_${variant}`, type, variant, path: `assets/terrain/${type}-${variant}.svg` };
  }),
);

/**
 * Pick a stable art variant for a feature from its position, so a given stage
 * always shows the same art in the same place (deterministic, no per-frame
 * randomness) while still varying across features.
 */
export function terrainKeyFor(type: TerrainType, x: number, y: number): string {
  const h = (Math.round(x) * 73856093) ^ (Math.round(y) * 19349663);
  const variant = ((h >>> 0) % TERRAIN_VARIANTS) + 1; // >>> 0 keeps it non-negative
  return `terrain__${type}_${variant}`;
}
