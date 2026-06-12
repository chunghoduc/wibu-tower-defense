/**
 * Deterministic braided-maze arena generator (endless mode). Carves a grid maze
 * with the castle at the center cell, opens gates on all four edges, and computes
 * multiple gate→center corridor routes. Pure (Phaser-free) and seeded, so an
 * arena is fully reproducible and unit-testable. See
 * docs/superpowers/specs/2026-06-12-endless-maze-arena-design.md.
 */
import type { ArenaDef, Vec2 } from "../data/schema.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../data/stage.ts";
import { Rng } from "./rng.ts";

export interface MazeOpts {
  cols: number;
  rows: number;
  margin: number;
  braid: number;
  gatesPerEdge: number;
}
// Braid heavily (≈45% of interior walls knocked out) so loops are common and most
// gates offer more than one corridor to the center — the "walk any way they want"
// feel. Lower values leave a near-perfect maze with a single path per gate.
const DEFAULTS: MazeOpts = { cols: 9, rows: 7, margin: 60, braid: 0.45, gatesPerEdge: 2 };

/** Sorted-pair key for the undirected passage between two cell indices. */
const edgeKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** `count` evenly-spaced distinct indices in [0, n). */
function spaced(n: number, count: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(Math.round(((k + 1) * n) / (count + 1)));
  return out;
}

/** Breadth-first shortest path of cell indices from `start` to `goal`, or null. */
function bfs(
  start: number,
  goal: number,
  cols: number,
  rows: number,
  linked: Set<string>,
): number[] | null {
  const prev = new Map<number, number>();
  const seen = new Set<number>([start]);
  const q: number[] = [start];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) {
      const path = [cur];
      let c = cur;
      while (prev.has(c)) {
        c = prev.get(c)!;
        path.push(c);
      }
      return path.reverse();
    }
    const cx = cur % cols,
      cy = (cur / cols) | 0;
    for (const [nx, ny] of [
      [cx, cy - 1],
      [cx, cy + 1],
      [cx - 1, cy],
      [cx + 1, cy],
    ]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (seen.has(ni) || !linked.has(edgeKey(cur, ni))) continue;
      seen.add(ni);
      prev.set(ni, cur);
      q.push(ni);
    }
  }
  return null;
}

export function buildMazeArena(seed: number, opts: Partial<MazeOpts> = {}): ArenaDef {
  const { cols, rows, margin, braid, gatesPerEdge } = { ...DEFAULTS, ...opts };
  const rng = new Rng(seed * 2654435761 + 1);
  const cellW = (WORLD_WIDTH - 2 * margin) / cols;
  const cellH = (WORLD_HEIGHT - 2 * margin) / rows;
  const center = (cx: number, cy: number): Vec2 => ({
    x: Math.round(margin + cellW * (cx + 0.5)),
    y: Math.round(margin + cellH * (cy + 0.5)),
  });
  const startCx = (cols - 1) >> 1,
    startCy = (rows - 1) >> 1;
  const centerCell = startCy * cols + startCx;

  // Carve a perfect maze with a randomized depth-first backtracker from the center.
  const linked = new Set<string>();
  const visited = new Array(cols * rows).fill(false);
  const stack = [centerCell];
  visited[centerCell] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols,
      cy = (cur / cols) | 0;
    const nbrs: number[] = [];
    for (const [nx, ny] of [
      [cx, cy - 1],
      [cx, cy + 1],
      [cx - 1, cy],
      [cx + 1, cy],
    ]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!visited[ni]) nbrs.push(ni);
    }
    if (nbrs.length === 0) {
      stack.pop();
      continue;
    }
    const next = nbrs[Math.floor(rng.next() * nbrs.length)];
    linked.add(edgeKey(cur, next));
    visited[next] = true;
    stack.push(next);
  }

  // Braid: knock out extra walls to create loops (multiple routes to the center).
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const cur = cy * cols + cx;
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx, cy + 1],
      ]) {
        if (nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (!linked.has(edgeKey(cur, ni)) && rng.next() < braid) linked.add(edgeKey(cur, ni));
      }
    }
  }

  // Gates on all four edges, with off-map spawn points aligned to their cells.
  const gateCells: { cell: number; point: Vec2 }[] = [];
  for (const cx of spaced(cols, gatesPerEdge)) {
    gateCells.push({ cell: 0 * cols + cx, point: { x: center(cx, 0).x, y: -20 } });
    gateCells.push({
      cell: (rows - 1) * cols + cx,
      point: { x: center(cx, rows - 1).x, y: WORLD_HEIGHT + 20 },
    });
  }
  for (const cy of spaced(rows, gatesPerEdge)) {
    gateCells.push({ cell: cy * cols + 0, point: { x: -20, y: center(0, cy).y } });
    gateCells.push({
      cell: cy * cols + (cols - 1),
      point: { x: WORLD_WIDTH + 20, y: center(cols - 1, cy).y },
    });
  }

  const toPolyline = (point: Vec2, cells: number[]): Vec2[] => [
    point,
    ...cells.map((c) => center(c % cols, (c / cols) | 0)),
  ];

  const routes: Vec2[][] = [];
  for (const g of gateCells) {
    const cellsA = bfs(g.cell, centerCell, cols, rows, linked);
    if (!cellsA) continue;
    routes.push(toPolyline(g.point, cellsA));
    // A second, distinct route: BFS again with route A's interior edges removed.
    const edgesA = new Set<string>();
    for (let i = 1; i < cellsA.length; i++) edgesA.add(edgeKey(cellsA[i - 1], cellsA[i]));
    const linkedB = new Set([...linked].filter((e) => !edgesA.has(e)));
    const cellsB = bfs(g.cell, centerCell, cols, rows, linkedB);
    if (cellsB) routes.push(toPolyline(g.point, cellsB));
  }

  const gates = gateCells.map((g) => g.point);
  return { center: center(startCx, startCy), gates, airSpawns: gates, routes };
}
