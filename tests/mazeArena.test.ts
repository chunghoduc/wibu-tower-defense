import { describe, it, expect } from "vitest";
import { buildMazeArena } from "../src/core/mazeArena.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../src/data/stage.ts";

const eq = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;

describe("buildMazeArena", () => {
  it("is deterministic for a given seed", () => {
    expect(buildMazeArena(7)).toEqual(buildMazeArena(7));
  });

  it("differs across seeds", () => {
    expect(buildMazeArena(1)).not.toEqual(buildMazeArena(2));
  });

  it("puts the castle at the world middle", () => {
    const a = buildMazeArena(3);
    expect(Math.abs(a.center.x - WORLD_WIDTH / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.center.y - WORLD_HEIGHT / 2)).toBeLessThanOrEqual(2);
  });

  it("opens gates on at least 3 distinct edges (multi-direction)", () => {
    const a = buildMazeArena(5);
    expect(a.gates.length).toBeGreaterThanOrEqual(6);
    const edge = (g: { x: number; y: number }) =>
      g.x < 0 ? "L" : g.x > WORLD_WIDTH ? "R" : g.y < 0 ? "T" : g.y > WORLD_HEIGHT ? "B" : "?";
    const edges = new Set(a.gates.map(edge));
    expect(edges.has("?")).toBe(false); // every gate is off an edge
    expect(edges.size).toBeGreaterThanOrEqual(3);
  });

  it("every route starts at a gate and ends exactly at the center", () => {
    const a = buildMazeArena(9);
    expect(a.routes.length).toBeGreaterThanOrEqual(a.gates.length);
    for (const r of a.routes) {
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(a.gates.some((g) => eq(g, r[0]))).toBe(true); // starts at some gate
      expect(eq(r[r.length - 1], a.center)).toBe(true); // ends at the castle
    }
  });

  it("every route segment is axis-aligned (corridors, no diagonal wall-cutting)", () => {
    const a = buildMazeArena(11);
    for (const r of a.routes) {
      for (let i = 1; i < r.length; i++) {
        const dx = Math.abs(r[i].x - r[i - 1].x),
          dy = Math.abs(r[i].y - r[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  it("provides path variety — at least one gate yields two distinct routes", () => {
    const a = buildMazeArena(4);
    const fromGate = new Map<string, string[]>();
    for (const r of a.routes) {
      const key = `${r[0].x},${r[0].y}`;
      const sig = r.map((p) => `${p.x}:${p.y}`).join("|");
      (fromGate.get(key) ?? fromGate.set(key, []).get(key)!).push(sig);
    }
    const hasTwo = [...fromGate.values()].some((sigs) => new Set(sigs).size >= 2);
    expect(hasTwo).toBe(true);
  });
});
