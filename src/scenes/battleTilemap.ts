/**
 * battleTilemap — the Phaser presenter that turns the pure mapTiles core into a
 * real top-down tilemap for the battlefield: a procedurally-generated tileset
 * texture (ground variants + 16 road auto-tiles) drawn from a biome palette,
 * plus two TilemapLayers (ground + auto-tiled road) built from the stage lanes.
 * No art assets — the tileset is rendered once per palette and cached.
 */
import type Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";
import {
  TILE,
  GRID_COLS,
  GRID_ROWS,
  TERRAIN_VARIANTS,
  type MapTilePalette,
  rasterizeRoadCells,
  roadBitmask,
  roadTileIndex,
  terrainVariant,
  cellKey,
} from "../core/mapTiles.ts";
import { DEPTH } from "./battleDepths.ts";

/** Ground + road tilemap layers sit just below the static graphics (depth -10). */
const GROUND_DEPTH = DEPTH.GROUND;
const ROAD_DEPTH = DEPTH.ROAD;
const ROAD_W = 28; // drawn dirt-track width (px) within a 40px tile

/** A stable texture key for a palette so identical biomes reuse one tileset. */
function paletteKey(p: MapTilePalette): string {
  return `maptiles__${[p.grass, p.dirt, p.dirtEdge, p.rut].map((c) => c.toString(16)).join("_")}`;
}

/** Small deterministic LCG so a variant's dabs look stable run-to-run. */
function lcg(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

function drawGroundTile(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  variant: number,
  p: MapTilePalette,
): void {
  g.fillStyle(variant % 2 === 0 ? p.grass : p.grassAlt, 1).fillRect(ox, 0, TILE, TILE);
  const rng = lcg(variant + 1);
  for (let i = 0; i < 7; i++) {
    const x = ox + rng() * TILE;
    const y = rng() * TILE;
    const r = 2 + rng() * 3;
    g.fillStyle(i % 2 === 0 ? p.grassDab : p.grassAlt, 0.5).fillCircle(x, y, r);
  }
}

function drawRoadTile(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  mask: number,
  p: MapTilePalette,
): void {
  const c = TILE / 2;
  // Two passes: a slightly wider darker edge, then the dirt fill, so the track
  // reads with a grass-fringe border. Each pass draws a centre patch + an arm
  // toward every connected cardinal side (mask bits N=1 E=2 S=4 W=8).
  const pass = (w: number, color: number) => {
    const h = w / 2;
    g.fillStyle(color, 1);
    g.fillRect(ox + c - h, c - h, w, w); // centre patch
    if (mask & 1) g.fillRect(ox + c - h, 0, w, c); // N
    if (mask & 2) g.fillRect(ox + c - h, c - h, c + h, w); // E
    if (mask & 4) g.fillRect(ox + c - h, c - h, w, c + h); // S
    if (mask & 8) g.fillRect(ox, c - h, c + h, w); // W
  };
  pass(ROAD_W + 6, p.dirtEdge);
  pass(ROAD_W, mask % 2 === 0 ? p.dirt : p.dirtAlt);
  // a faint rut line along straight-through arms
  g.lineStyle(2, p.rut, 0.5);
  if (mask & 1 || mask & 4) {
    g.beginPath();
    g.moveTo(ox + c, mask & 1 ? 0 : c);
    g.lineTo(ox + c, mask & 4 ? TILE : c);
    g.strokePath();
  }
  if (mask & 2 || mask & 8) {
    g.beginPath();
    g.moveTo(mask & 8 ? ox : ox + c, c);
    g.lineTo(mask & 2 ? ox + TILE : ox + c, c);
    g.strokePath();
  }
}

/** Build (or reuse) the tileset texture for a palette; returns its texture key. */
export function buildMapTileset(scene: Phaser.Scene, p: MapTilePalette): string {
  const key = paletteKey(p);
  if (scene.textures.exists(key)) return key;
  const n = TERRAIN_VARIANTS + 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let v = 0; v < TERRAIN_VARIANTS; v++) drawGroundTile(g, v * TILE, v, p);
  for (let m = 0; m < 16; m++) drawRoadTile(g, (TERRAIN_VARIANTS + m) * TILE, m, p);
  g.generateTexture(key, n * TILE, TILE);
  g.destroy();
  return key;
}

/** A built battlefield tilemap (ground + road layers). Call destroy() on rebuild. */
export class BattleTilemap {
  private map: Phaser.Tilemaps.Tilemap;
  private layers: Phaser.Tilemaps.TilemapLayer[] = [];

  constructor(
    scene: Phaser.Scene,
    world: Phaser.GameObjects.Layer,
    palette: MapTilePalette,
    lanes: Vec2[][],
    seed: number,
  ) {
    const tsKey = buildMapTileset(scene, palette);
    const map = scene.make.tilemap({
      tileWidth: TILE,
      tileHeight: TILE,
      width: GRID_COLS,
      height: GRID_ROWS,
    });
    this.map = map;
    const tiles = map.addTilesetImage("mt", tsKey, TILE, TILE, 0, 0);
    const ground = tiles && map.createBlankLayer("ground", tiles, 0, 0);
    const road = tiles && map.createBlankLayer("road", tiles, 0, 0);
    if (!ground || !road) return; // missing texture — leave the map empty (never crash)
    ground.setDepth(GROUND_DEPTH);
    road.setDepth(ROAD_DEPTH);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        ground.putTileAt(terrainVariant(col, row, seed, TERRAIN_VARIANTS), col, row);
      }
    }
    const roadCells = rasterizeRoadCells(lanes);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (roadCells.has(cellKey(col, row))) {
          road.putTileAt(
            roadTileIndex(roadBitmask(roadCells, col, row), TERRAIN_VARIANTS),
            col,
            row,
          );
        }
      }
    }
    world.add(ground);
    world.add(road);
    this.layers = [ground, road];
  }

  destroy(): void {
    for (const l of this.layers) l.destroy();
    this.layers = [];
    this.map.destroy();
  }
}
