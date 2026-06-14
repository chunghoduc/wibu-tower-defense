# Top-Down Tilemap Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every stage's painted-image battle background + flat road stroke with a top-down **tilemap**: a tiled terrain ground layer plus an auto-tiled dirt-road layer that follows the enemy lanes.

**Architecture:** A pure Phaser-free core (`src/core/mapTiles.ts`) owns the grid math, road rasterization, and auto-tile bitmasking; a Phaser presenter (`src/scenes/battleTilemap.ts`) generates the tileset texture procedurally per theme and builds two `TilemapLayer`s. `BattleScene.drawStatic()` swaps its background-image + road-stroke code for a `BattleTilemap`. Themes (`chapters.ts`) gain a per-biome colour palette.

**Tech Stack:** TypeScript, Phaser 3 (Tilemaps API + `Graphics.generateTexture`), vitest.

---

## File Structure

- **Create** `src/core/mapTiles.ts` — pure grid/rasterize/auto-tile/palette types (~160 lines).
- **Create** `tests/mapTiles.test.ts` — unit tests for the pure core.
- **Create** `src/scenes/battleTilemap.ts` — procedural tileset + `BattleTilemap` presenter (~220 lines).
- **Modify** `src/data/chapters.ts` — add `tiles: MapTilePalette` to `ChapterTheme` + 6 chapter palettes (+ optional stage overrides).
- **Modify** `src/scenes/BattleScene.ts` — add `battleTilemap` field + reset cleanup.
- **Modify** `src/scenes/battleSceneRender.ts` — `drawStatic()` builds the tilemap, drops the bg image + road stroke.

---

## Task 1: Pure map-tiles core (grid + rasterize + auto-tile)

**Files:**
- Create: `src/core/mapTiles.ts`
- Test: `tests/mapTiles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mapTiles.test.ts
import { describe, expect, it } from "vitest";
import {
  TILE,
  GRID_COLS,
  GRID_ROWS,
  TERRAIN_VARIANTS,
  worldToCell,
  cellCenter,
  cellKey,
  rasterizeRoadCells,
  roadBitmask,
  roadTileIndex,
  terrainVariant,
} from "../src/core/mapTiles.ts";

describe("grid mapping", () => {
  it("maps world pixels to the containing cell and clamps to the grid", () => {
    expect(worldToCell(0, 0)).toEqual({ col: 0, row: 0 });
    expect(worldToCell(TILE * 1.5, TILE * 2.5)).toEqual({ col: 1, row: 2 });
    // Out-of-bounds clamps (world is GRID_COLS*TILE × GRID_ROWS*TILE).
    expect(worldToCell(-50, -50)).toEqual({ col: 0, row: 0 });
    expect(worldToCell(99999, 99999)).toEqual({ col: GRID_COLS - 1, row: GRID_ROWS - 1 });
  });

  it("cellCenter returns the pixel centre of a cell", () => {
    expect(cellCenter(0, 0)).toEqual({ x: TILE / 2, y: TILE / 2 });
    expect(cellCenter(3, 4)).toEqual({ x: 3 * TILE + TILE / 2, y: 4 * TILE + TILE / 2 });
  });
});

describe("rasterizeRoadCells", () => {
  it("marks the band of cells a straight horizontal lane passes through", () => {
    const y = cellCenter(0, 5).y; // centre of row 5
    const lane = [
      { x: 0, y },
      { x: GRID_COLS * TILE, y },
    ];
    const cells = rasterizeRoadCells([lane], 10); // half-width 10 < TILE/2 → only row 5
    expect(cells.has(cellKey(0, 5))).toBe(true);
    expect(cells.has(cellKey(10, 5))).toBe(true);
    expect(cells.has(cellKey(10, 4))).toBe(false);
    expect(cells.has(cellKey(10, 6))).toBe(false);
  });

  it("dilates so a diagonal lane leaves no gaps along its length", () => {
    const lane = [
      { x: 20, y: 20 },
      { x: 20 + 6 * TILE, y: 20 + 6 * TILE },
    ];
    const cells = rasterizeRoadCells([lane]); // default ROAD_HALF
    // every step along the diagonal has at least one road cell near it
    for (let t = 0; t <= 1; t += 0.1) {
      const px = 20 + t * 6 * TILE;
      const py = 20 + t * 6 * TILE;
      const c = worldToCell(px, py);
      expect(cells.has(cellKey(c.col, c.row))).toBe(true);
    }
  });

  it("unions multiple lanes (a junction)", () => {
    const yA = cellCenter(0, 4).y;
    const xB = cellCenter(8, 0).x;
    const laneA = [
      { x: 0, y: yA },
      { x: GRID_COLS * TILE, y: yA },
    ];
    const laneB = [
      { x: xB, y: 0 },
      { x: xB, y: GRID_ROWS * TILE },
    ];
    const cells = rasterizeRoadCells([laneA, laneB], 10);
    expect(cells.has(cellKey(2, 4))).toBe(true); // on laneA
    expect(cells.has(cellKey(8, 10))).toBe(true); // on laneB
  });
});

describe("roadBitmask", () => {
  const at = (...keys: Array<[number, number]>) =>
    new Set(keys.map(([c, r]) => cellKey(c, r)));

  it("encodes N=1 E=2 S=4 W=8 from neighbouring road cells", () => {
    // cross: all four neighbours present
    const cross = at([5, 4], [6, 5], [5, 6], [4, 5], [5, 5]);
    expect(roadBitmask(cross, 5, 5)).toBe(15);
    // horizontal straight: E + W
    const horiz = at([6, 5], [4, 5], [5, 5]);
    expect(roadBitmask(horiz, 5, 5)).toBe(2 | 8);
    // NE corner: N + E
    const corner = at([5, 4], [6, 5], [5, 5]);
    expect(roadBitmask(corner, 5, 5)).toBe(1 | 2);
    // dead-end pointing north: only N
    const end = at([5, 4], [5, 5]);
    expect(roadBitmask(end, 5, 5)).toBe(1);
    // isolated
    expect(roadBitmask(at([5, 5]), 5, 5)).toBe(0);
  });

  it("treats off-grid neighbours as not-road", () => {
    const corner = new Set([cellKey(0, 0), cellKey(1, 0), cellKey(0, 1)]);
    // at (0,0): N and W are off-grid; E(1,0) and S(0,1) are road → E|S
    expect(roadBitmask(corner, 0, 0)).toBe(2 | 4);
  });
});

describe("roadTileIndex", () => {
  it("offsets road auto-tiles past the terrain variants", () => {
    expect(roadTileIndex(0, TERRAIN_VARIANTS)).toBe(TERRAIN_VARIANTS);
    expect(roadTileIndex(15, TERRAIN_VARIANTS)).toBe(TERRAIN_VARIANTS + 15);
  });
});

describe("terrainVariant", () => {
  it("is deterministic and within range", () => {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const v = terrainVariant(col, row, 7, TERRAIN_VARIANTS);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(TERRAIN_VARIANTS);
        expect(terrainVariant(col, row, 7, TERRAIN_VARIANTS)).toBe(v);
      }
    }
  });

  it("varies across cells (not all the same value)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) seen.add(terrainVariant(i, i * 2, 1, TERRAIN_VARIANTS));
    expect(seen.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mapTiles.test.ts`
Expected: FAIL — `Cannot find module '../src/core/mapTiles.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/mapTiles.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mapTiles.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/core/mapTiles.ts tests/mapTiles.test.ts
git commit -m "feat(map): pure tile-grid core — rasterize lanes + auto-tile bitmask

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Theme tile palettes

**Files:**
- Modify: `src/data/chapters.ts` (add `MapTilePalette` import, `tiles` field, 6 palettes, optional stage overrides)

- [ ] **Step 1: Add the import and the `tiles` field to `ChapterTheme`**

At the top of `src/data/chapters.ts`, after the existing imports, add:

```ts
import type { MapTilePalette } from "../core/mapTiles.ts";
```

In `interface ChapterTheme`, add a field (after `groundOverlay`):

```ts
  /** Colour palette for the top-down map tiles (ground + road) of this biome. */
  tiles: MapTilePalette;
```

In `interface StageBiome`, add an optional override (after `groundOverlay`):

```ts
  tiles?: MapTilePalette;
```

- [ ] **Step 2: Author a `tiles` palette in each of the 6 `CHAPTER_THEMES` entries**

Add a `tiles: { ... }` property to each theme object. Use these exact palettes:

```ts
// greenwood — verdant forest pass: green grass, brown dirt track
tiles: {
  grass: 0x4a7a3a, grassAlt: 0x568a44, grassDab: 0x3c6630,
  dirt: 0x9a7748, dirtAlt: 0x8a6a3e, dirtEdge: 0x6e5230, rut: 0x5e4628,
},
```
```ts
// frost — snowfields: pale snow, packed-ice path
tiles: {
  grass: 0xcfe0ea, grassAlt: 0xdcebf3, grassDab: 0xb8cedd,
  dirt: 0x8fa8bc, dirtAlt: 0x7e98ae, dirtEdge: 0x60788c, rut: 0x52677a,
},
```
```ts
// desert — dunes: warm sand, pale-stone road
tiles: {
  grass: 0xc9a566, grassAlt: 0xd6b675, grassDab: 0xb89154,
  dirt: 0xa89072, dirtAlt: 0x988064, dirtEdge: 0x766048, rut: 0x66523c,
},
```
```ts
// volcanic — ash plain: dark ash, charred basalt road
tiles: {
  grass: 0x453c3a, grassAlt: 0x514645, grassDab: 0x352e2d,
  dirt: 0x5e4036, dirtAlt: 0x4e342c, dirtEdge: 0x36211c, rut: 0x7a2a14,
},
```
```ts
// swamp — mire: murk green, boardwalk brown
tiles: {
  grass: 0x44583a, grassAlt: 0x506544, grassDab: 0x374a30,
  dirt: 0x7a6440, dirtAlt: 0x6a5638, dirtEdge: 0x4e3e28, rut: 0x3e3220,
},
```
```ts
// corrupted — blight: void violet, bone-grey road
tiles: {
  grass: 0x3a2e4e, grassAlt: 0x453858, grassDab: 0x2e2440,
  dirt: 0x6a6478, dirtAlt: 0x585268, dirtEdge: 0x423e52, rut: 0x7a3a6a,
},
```

- [ ] **Step 3: Add stage-override palettes for the visually distinct hand-painted stages**

In `STAGE_BIOMES`, add a `tiles` to stage 6 (grey quarry) and stage 7 (lava crossroads):

```ts
// in the `6:` entry — bare grey stone pit
tiles: {
  grass: 0x6a6e74, grassAlt: 0x767a80, grassDab: 0x5a5e64,
  dirt: 0x8a8c90, dirtAlt: 0x7a7c80, dirtEdge: 0x5e6064, rut: 0x4e5054,
},
```
```ts
// in the `7:` entry — molten lava field
tiles: {
  grass: 0x3a302c, grassAlt: 0x463934, grassDab: 0x2c2422,
  dirt: 0x5e3a2a, dirtAlt: 0x4e2e20, dirtEdge: 0x331e16, rut: 0xd24a16,
},
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors — every `ChapterTheme` now has the required `tiles`).

- [ ] **Step 5: Commit**

```bash
git add src/data/chapters.ts
git commit -m "feat(map): per-biome tile palettes on chapter/stage themes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Procedural tileset + `BattleTilemap` presenter

**Files:**
- Create: `src/scenes/battleTilemap.ts`

- [ ] **Step 1: Write the presenter**

```ts
// src/scenes/battleTilemap.ts
/**
 * battleTilemap — the Phaser presenter that turns the pure mapTiles core into a
 * real top-down tilemap for the battlefield: a procedurally-generated tileset
 * texture (ground variants + 16 road auto-tiles) drawn from a biome palette,
 * plus two TilemapLayers (ground + auto-tiled road) built from the stage lanes.
 * No art assets — the tileset is rendered once per palette and cached.
 */
import Phaser from "phaser";
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

/** Ground + road tilemap layers sit just below the static graphics (depth -10). */
const GROUND_DEPTH = -12;
const ROAD_DEPTH = -11;
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
          road.putTileAt(roadTileIndex(roadBitmask(roadCells, col, row), TERRAIN_VARIANTS), col, row);
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (Phaser Tilemaps types resolve; `addTilesetImage`/`createBlankLayer` may return null — handled).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/battleTilemap.ts
git commit -m "feat(map): procedural tileset + BattleTilemap presenter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire the tilemap into BattleScene

**Files:**
- Modify: `src/scenes/BattleScene.ts` (field + reset cleanup)
- Modify: `src/scenes/battleSceneRender.ts` (`drawStatic`: build tilemap, drop bg image + road stroke)

- [ ] **Step 1: Add the field to `BattleScene`**

In `src/scenes/BattleScene.ts`, add the import near the other scene imports:

```ts
import type { BattleTilemap } from "./battleTilemap.ts";
```

Add the field next to `endlessBackdropFx` (around line 91):

```ts
  battleTilemap: BattleTilemap | null = null;
```

- [ ] **Step 2: Add reset cleanup**

In the reset block (around line 173, next to the `endlessBackdropFx` cleanup), add:

```ts
    this.battleTilemap?.destroy();
    this.battleTilemap = null;
```

- [ ] **Step 3: Build the tilemap in `drawStatic`**

In `src/scenes/battleSceneRender.ts`, add the import near the top (with the other scene imports):

```ts
import { BattleTilemap } from "./battleTilemap.ts";
```

Replace the background-image block (the `const stageBg = ...` through the `else { g.fillStyle(0x202a22 ...) }`, currently lines ~441–461) with:

```ts
    // Top-down tiled map (replaces the painted backdrop): a ground terrain layer
    // plus an auto-tiled dirt road following the enemy lanes. Rebuilt each
    // drawStatic; the prior one is torn down first (re-entry safe).
    this.battleTilemap?.destroy();
    this.battleTilemap = new BattleTilemap(
      this,
      this.world,
      theme.tiles,
      groundLanes(this.stage),
      stageNumber(this.stage.id) || 1,
    );
    // A very light veil over the tiles for unit contrast (tiles are already muted).
    g.fillStyle(theme.groundOverlay, 0.1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
```

Keep the line `const theme = stageThemeForStage(this.stage.id);` that precedes it.

- [ ] **Step 4: Remove the old road stroke**

Delete the road-stroke block (currently lines ~511–520):

```ts
    // roads: every authored lane / arena corridor (or the single legacy path).
    const roads = groundLanes(this.stage);
    g.lineStyle(36, 0x3a4458, 1);
    for (const road of roads) {
      if (road.length < 2) continue;
      g.beginPath();
      g.moveTo(road[0].x, road[0].y);
      for (let i = 1; i < road.length; i++) g.lineTo(road[i].x, road[i].y);
      g.strokePath();
    }
```

(The road is now the tilemap road layer. The arena-gates block immediately after stays.)

- [ ] **Step 5: Remove now-unused imports if any**

Check `battleSceneRender.ts` for `bgKey` / `stageBgKey` usage. If they are now unused, remove them from their import statements. Run:

Run: `npx tsc --noEmit`
Expected: PASS. If it reports an unused import (TS6133 only under `noUnusedLocals`) or ESLint flags it, delete the unused name.

- [ ] **Step 6: Run the full test suite + lint + build**

Run: `npx vitest run`
Expected: PASS (all prior tests + the new `mapTiles.test.ts`).

Run: `npm run lint`
Expected: 0 errors (pre-existing `any` warnings are fine).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/battleSceneRender.ts
git commit -m "feat(map): render battles as top-down tilemaps (ground + road layers)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Live playtest verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run (background): `npm run dev` and note the port (Vite default 5173, repo may use 4188).

- [ ] **Step 2: Drive a CDP playtest** capturing a campaign stage (e.g. stage 1 greenwood, stage 7 lava) and the endless maze arena. Launch each via `window.__game` registry + `scene.start("BattleScene")` with `selectedStage` set, override device metrics to 960×540@2, and screenshot to `/tmp/map_<id>.png`. Confirm:
  - The ground reads as tiled terrain (no stretched painting).
  - The road is a continuous dirt track that turns/branches correctly and sits under the enemies (enemies never walk on visible grass).
  - The castle, towers, terrain features, and gates still render above the tiles.

- [ ] **Step 3: Send the screenshots to the chat** with a one-line summary per stage.

- [ ] **Step 4: Update memory** — write `memory/project_topdown_tilemap_maps.md` recording the new tilemap rendering (pure `mapTiles.ts` + `battleTilemap.ts` presenter, 40px/32×18 grid, road dilation = ROAD_HALF, depths -12/-11, palette on themes), and add its index line to `MEMORY.md`. Link `[[project_chapter1_branching_maps]]` (which noted "NOT a tilemap" — now superseded for rendering) and `[[project_home_throne_room]]`-style backdrop notes as relevant.

---

## Self-Review Notes

- **Spec coverage:** ground tilemap (Task 3/4) ✓; auto-tiled road following lanes (Task 1 rasterize+bitmask, Task 3 draw, Task 4 wire) ✓; per-theme palettes for all stages incl. endless (Task 2) ✓; sim untouched — only `drawStatic` changes ✓; light veil retained ✓; no new assets / no ASSET_VERSION bump ✓; tests for the pure core (Task 1) ✓; live verification (Task 5) ✓.
- **Type consistency:** `MapTilePalette` defined once in `mapTiles.ts`, imported by both `chapters.ts` and `battleTilemap.ts`. `TERRAIN_VARIANTS`, `cellKey`, `rasterizeRoadCells`, `roadBitmask`, `roadTileIndex`, `terrainVariant` names match across core, tests, and presenter. `BattleTilemap` constructor signature `(scene, world, palette, lanes, seed)` matches the call site in Task 4.
- **No placeholders:** every code step is complete; the stage-7 palette fix-note is resolved to a final literal in Task 2 Step 3.
```

