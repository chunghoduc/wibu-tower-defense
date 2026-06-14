/**
 * mapTiles — pure, Phaser-free tile-grid math for the top-down battlefield map.
 * Owns the world↔cell grid, rasterizing enemy lanes onto that grid as a road,
 * 4-bit cardinal auto-tile bitmasking, and the deterministic ground-variant
 * hash. The Phaser presenter that turns this into real TilemapLayers lives in
 * scenes/battleTilemap.ts. Kept dependency-free so it is fully unit-testable.
 */
import type { Vec2 } from "../data/schema.ts";

/** Tile size (px). 1280×720 world ⇒ exactly 32×18 cells. */
export const TILE = 40;
export const GRID_COLS = 32;
export const GRID_ROWS = 18;

/** How many distinct ground-terrain tiles the tileset carries (variety). */
export const TERRAIN_VARIANTS = 4;

/**
 * Half the visual road width (px). A cell is "road" when its centre is within
 * this distance of a lane segment — the dilation that keeps the grid track wide
 * enough to always cover the centreline walkers. 28 < the 30px LANE_CLEARANCE,
 * so towers still sit just off the visible road and placement needs no change.
 */
export const ROAD_HALF = 28;

export interface Cell {
  col: number;
  row: number;
}

/** Colour palette for one biome's procedurally-drawn map tiles (Phaser-free). */
export interface MapTilePalette {
  grass: number;
  grassAlt: number;
  grassDab: number;
  dirt: number;
  dirtAlt: number;
  dirtEdge: number;
  rut: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function worldToCell(x: number, y: number): Cell {
  return {
    col: clamp(Math.floor(x / TILE), 0, GRID_COLS - 1),
    row: clamp(Math.floor(y / TILE), 0, GRID_ROWS - 1),
  };
}

export function cellCenter(col: number, row: number): Vec2 {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export function cellKey(col: number, row: number): number {
  return row * GRID_COLS + col;
}

/** Distance from point p to segment a→b. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The set of road cells (by cellKey) covered by any lane within halfWidth. */
export function rasterizeRoadCells(lanes: Vec2[][], halfWidth = ROAD_HALF): Set<number> {
  const cells = new Set<number>();
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const c = cellCenter(col, row);
      let road = false;
      for (const lane of lanes) {
        for (let i = 1; i < lane.length && !road; i++) {
          if (segDist(c, lane[i - 1], lane[i]) <= halfWidth) road = true;
        }
        if (road) break;
      }
      if (road) cells.add(cellKey(col, row));
    }
  }
  return cells;
}

/** 4-bit cardinal mask of which neighbours are also road: N=1 E=2 S=4 W=8. */
export function roadBitmask(roadCells: Set<number>, col: number, row: number): number {
  let m = 0;
  if (row > 0 && roadCells.has(cellKey(col, row - 1))) m |= 1;
  if (col < GRID_COLS - 1 && roadCells.has(cellKey(col + 1, row))) m |= 2;
  if (row < GRID_ROWS - 1 && roadCells.has(cellKey(col, row + 1))) m |= 4;
  if (col > 0 && roadCells.has(cellKey(col - 1, row))) m |= 8;
  return m;
}

/** Tileset index for a road auto-tile: the 16 road tiles follow the variants. */
export function roadTileIndex(bitmask: number, variantCount: number): number {
  return variantCount + bitmask;
}

/** Deterministic ground-variant index for a cell (spatial hash). */
export function terrainVariant(col: number, row: number, seed: number, count: number): number {
  let h = (col * 73856093) ^ (row * 19349663) ^ (seed * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return h % count;
}
