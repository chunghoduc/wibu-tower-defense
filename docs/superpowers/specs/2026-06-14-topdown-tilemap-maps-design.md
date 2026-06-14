# Top-Down Tilemap Maps — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto session — author self-approved per standing delegation)

## Problem

Today the battlefield reads as a *painted perspective landscape*: each stage draws a single SDXL background image (`bg__chapter-*` / per-stage art) stretched to the 1280×720 world, with a dark veil over it, and the enemy road is a flat 36px blue-grey `Graphics` stroke (`battleSceneRender.drawStatic`, lines 511–520). The road does not read as part of the terrain — it's a line painted over a photograph. The look is inconsistent stage-to-stage and the road floats above the art.

**Goal:** redesign *all* stage battle backgrounds into a cohesive **top-down map** view, and draw the roads as a **tilemap** so the path is made of terrain (a dirt/stone track cut through grass/sand/snow) that visually matches the ground it crosses.

## Approach

Replace the per-stage background image + procedural road stroke with **two Phaser `TilemapLayer`s** built from a **procedurally generated, per-theme tileset texture**:

1. **Ground layer** — every grid cell filled with a top-down terrain tile (grass / sand / snow / ash / void per chapter theme), with per-cell variant selection for texture variety.
2. **Road layer** — the enemy lanes (`groundLanes(stage)`) rasterized onto the same grid and rendered with **4-bit cardinal auto-tiling** (16 tiles: isolated, ends, straights, corners, T-junctions, cross) so the track connects correctly through turns and branches.

The tileset is generated **at runtime** with `Graphics` → `RenderTexture` from a small per-theme colour palette (cached by palette key), so there are **no new art assets**, no `ASSET_VERSION` bump, and every chapter/stage is themed by data. This mirrors the codebase's existing procedural-fallback philosophy (`loadingBackdrop`, terrain blob fallbacks).

### Why a real Phaser tilemap (not a TileSprite or a textured rope)
The request explicitly says "using tilemap". We use Phaser's real `make.tilemap` + `addTilesetImage` + `createBlankLayer` + `putTileAt` API. It batches efficiently (one draw per layer), gives us a genuine tile grid, and the road auto-tiling is the natural fit for a grid.

### Coordinate grid
World is 1280×720. **Tile = 40px → exactly 32 cols × 18 rows** (1280/40, 720/40 both integer). 576 cells total — trivially cheap to fill and rasterize each `drawStatic`.

### The sim is NOT touched
Enemies keep walking the smooth free-form polylines (`pointAtDistance`), and tower placement keeps using `groundLanes` + `LANE_CLEARANCE`. Only *rendering* changes. Because a grid road can't follow a diagonal polyline exactly, we **dilate** the rasterized road: a cell is "road" when its centre is within `ROAD_HALF` (28px) of any lane segment. That yields a track ~1.4 tiles wide that reliably covers wherever the centreline walkers actually are, so enemies never appear to walk on grass. (28px < the 30px `LANE_CLEARANCE`, so towers still sit just off the visible track — placement needs no change.)

## Architecture

Split along the established pure-core / Phaser-presenter seam (cf. `uiMotion`↔`uiKit`, `loadingBackdrop`↔`loadingBackdropFx`):

### `src/core/mapTiles.ts` — pure, Phaser-free, fully unit-tested
Geometry + tiling math over plain `Vec2`:

- `TILE = 40`, `GRID_COLS = 32`, `GRID_ROWS = 18`, `ROAD_HALF = 28`.
- `worldToCell(x, y): {col, row}` — clamped to grid.
- `cellCenter(col, row): Vec2`.
- `cellKey(col, row): number` — `row * GRID_COLS + col`, the Set element type.
- `rasterizeRoadCells(lanes: Vec2[][], halfWidth = ROAD_HALF): Set<number>` — for each cell, road iff the cell centre is within `halfWidth` of any lane segment (reuses point-to-segment distance, same shape as `battlePlacement.segDist`). Deterministic, O(cells × segments).
- `roadBitmask(roadCells, col, row): number` — bits N=1, E=2, S=4, W=8 for cardinal neighbours that are also road (out-of-grid = not road).
- `roadTileIndex(bitmask, variantCount): number` — `variantCount + bitmask` (road tiles follow the terrain variants in the tileset).
- `terrainVariant(col, row, seed, count): number` — deterministic spatial hash → `0..count-1`.

### `src/scenes/battleTilemap.ts` — Phaser presenter
- `interface MapTilePalette { grass: number; grassAlt: number; grassDab: number; dirt: number; dirtAlt: number; dirtEdge: number; rut: number }` — top-down colours for one biome.
- `TERRAIN_VARIANTS = 4`.
- `buildMapTileset(scene, palette): string` — draws `TERRAIN_VARIANTS` ground tiles (base fill + a few seeded darker/lighter dabs) followed by the **16 road auto-tiles** (dirt fill carved to the connected sides with a grass-fringe edge + cart ruts) into a `(VARIANTS+16)·40 × 40` texture via `Graphics.generateTexture`. Cached on the scene's texture manager under a key derived from the palette so re-entry / shared themes don't regenerate.
- `class BattleTilemap` — given `(scene, layer, palette, lanes, seed)`:
  - builds a `make.tilemap({ tileWidth:40, tileHeight:40, width:32, height:18 })`,
  - `addTilesetImage(generatedKey)`,
  - ground `createBlankLayer` (depth −10): every cell ← `terrainVariant(...)`,
  - road `createBlankLayer` (depth −9): for each rasterized road cell ← `roadTileIndex(roadBitmask(...))`,
  - adds both layers to `this.world`,
  - `destroy()` tears down both layers + the tilemap (re-entry safe — Phaser reuses scene instances; cf. scene-reentry-reset memory).

### `src/data/chapters.ts` — theme palette
Extend `ChapterTheme` with `tiles: MapTilePalette`. Author one palette per chapter (greenwood = green grass / brown dirt; frost = snow / packed-ice path; desert = sand / pale-stone track; volcanic = ash / charred basalt; swamp = murk-green / boardwalk-brown; corrupted = void-violet / bone-grey). `StageBiome` overrides may optionally carry a `tiles` palette; when absent the chapter palette is used (so all 30 stages + endless are covered with zero gaps).

### `src/scenes/battleSceneRender.ts` — integration
In `drawStatic()`:
- Remove the background-image block (lines 451–461) and the road-stroke block (lines 511–520) **for battle rendering**.
- After clearing, build/refresh a `BattleTilemap` from `stageThemeForStage(stage).tiles`, `groundLanes(stage)`, and the stage-number seed. Store it on the scene; `destroy()` the prior one first (like `endlessBackdropFx`).
- Keep, unchanged and layered above the tiles: terrain feature sprites (depth 1), arena gates, castle sprite, and the `EndlessBackdropFx` atmosphere overlay (endless keeps its vignette/embers on top of the tiles).
- Keep a *very light* (`alpha ≈ 0.10`) `groundOverlay` full-rect for unit contrast — much lighter than today's 0.22–0.4 veil, since the tiles are already muted.

The SDXL `bg__chapter-*` textures stay loaded (used by the main-menu hall and as a harmless fallback) but battles no longer draw them.

## Components & Data Flow

```
stage ──groundLanes()──► lanes: Vec2[][]
                              │
stageThemeForStage(stage).tiles ─► palette
                              │
        ┌─────────────────────┴───────────────┐
        ▼                                       ▼
  buildMapTileset(scene,palette)        rasterizeRoadCells(lanes)
        │  → tileset texture key               │ → Set<cellKey>
        ▼                                       ▼
   make.tilemap + addTilesetImage      per cell: roadBitmask → roadTileIndex
        │                                       │
        ▼                                       ▼
   ground layer (terrainVariant per cell)   road layer (auto-tile per road cell)
        └───────────── this.world (depths −10 / −9) ──────────────┘
```

## Testing

`tests/mapTiles.test.ts` (pure, imports only `src/core/mapTiles.ts`):
- `worldToCell` / `cellCenter` round-trip & clamping at edges.
- `rasterizeRoadCells`: a straight horizontal lane marks the expected row-band; a diagonal lane is covered (dilation — no gaps along the line); a multi-lane junction unions both.
- `roadBitmask`: known neighbour patterns → cross (15), straight H (E+W=10), corner (N+E=3), dead-end (N=1), isolated (0).
- `roadTileIndex`: offsets past the terrain variants.
- `terrainVariant`: deterministic for same `(col,row,seed)`, always in `0..count-1`, varies across cells.

Presenter (`battleTilemap.ts`) is exercised by the existing CDP live-playtest (screenshots of several stages + endless) since it needs real WebGL.

## File-size budget
`mapTiles.ts` ≈ 150 lines, `battleTilemap.ts` ≈ 220 lines, `chapters.ts` grows by the palettes — all comfortably under the 500-line ESLint ceiling.

## Out of scope
- No change to enemy movement, wave logic, tower placement rules, or maze generation.
- No new image assets; no `ASSET_VERSION` bump.
- Main-menu hall, loading backdrop, and item/character art untouched.
- Snapping authored paths to the grid (rejected — would alter the sim and re-tune every stage).
```

