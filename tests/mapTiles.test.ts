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
    const y = cellCenter(0, 5).y;
    const lane = [
      { x: 0, y },
      { x: GRID_COLS * TILE, y },
    ];
    const cells = rasterizeRoadCells([lane], 10);
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
    const cells = rasterizeRoadCells([lane]);
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
    expect(cells.has(cellKey(2, 4))).toBe(true);
    expect(cells.has(cellKey(8, 10))).toBe(true);
  });
});

describe("roadBitmask", () => {
  const at = (...keys: Array<[number, number]>) => new Set(keys.map(([c, r]) => cellKey(c, r)));

  it("encodes N=1 E=2 S=4 W=8 from neighbouring road cells", () => {
    const cross = at([5, 4], [6, 5], [5, 6], [4, 5], [5, 5]);
    expect(roadBitmask(cross, 5, 5)).toBe(15);
    const horiz = at([6, 5], [4, 5], [5, 5]);
    expect(roadBitmask(horiz, 5, 5)).toBe(2 | 8);
    const corner = at([5, 4], [6, 5], [5, 5]);
    expect(roadBitmask(corner, 5, 5)).toBe(1 | 2);
    const end = at([5, 4], [5, 5]);
    expect(roadBitmask(end, 5, 5)).toBe(1);
    expect(roadBitmask(at([5, 5]), 5, 5)).toBe(0);
  });

  it("treats off-grid neighbours as not-road", () => {
    const corner = new Set([cellKey(0, 0), cellKey(1, 0), cellKey(0, 1)]);
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
