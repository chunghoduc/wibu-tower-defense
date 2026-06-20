import { describe, it, expect } from "vitest";
import { buildExtendedPassiveTree } from "../src/data/passiveTreeGen.ts";
import { BASE_NODES, PASSIVE_NODES } from "../src/data/passiveGrid.ts";
import { REGION_GROWTH } from "../src/data/passiveTreeSpec.ts";

const tree = buildExtendedPassiveTree(BASE_NODES);
const byId = new Map(tree.map((n) => [n.id, n]));

describe("buildExtendedPassiveTree — structure", () => {
  it("produces a massive tree (>= 880 nodes)", () => {
    expect(tree.length).toBeGreaterThanOrEqual(880);
  });

  it("keeps every authored node with identical stats + position", () => {
    for (const b of BASE_NODES) {
      const got = byId.get(b.id);
      expect(got, `missing authored ${b.id}`).toBeTruthy();
      expect(got!.flat).toEqual(b.flat);
      expect(got!.increased).toEqual(b.increased);
      expect(got!.more).toEqual(b.more);
      expect(got!.gridX).toBe(b.gridX);
      expect(got!.gridY).toBe(b.gridY);
    }
  });

  it("generated ids never collide with authored ids", () => {
    const authored = new Set(BASE_NODES.map((n) => n.id));
    const gen = tree.filter((n) => n.id.startsWith("gen-"));
    for (const g of gen) expect(authored.has(g.id)).toBe(false);
    expect(gen.length).toBeGreaterThanOrEqual(800);
  });

  it("all neighbor references resolve and are bidirectional", () => {
    for (const n of tree)
      for (const nb of n.neighbors) {
        const other = byId.get(nb);
        expect(other, `${n.id} -> missing ${nb}`).toBeTruthy();
        expect(other!.neighbors, `${nb} not back-linked to ${n.id}`).toContain(n.id);
      }
  });

  it("no generated node collides with any other node's grid cell", () => {
    // (Two AUTHORED nodes pre-date this work sharing cell 8,5 — brawler-jewel-1 /
    //  phantom-notable-2; out of scope per spec "zero authored changes". The
    //  generator must never ADD to any occupied cell, base or generated.)
    const cellOwners = new Map<string, string[]>();
    for (const n of tree) {
      const key = `${n.gridX},${n.gridY}`;
      cellOwners.set(key, [...(cellOwners.get(key) ?? []), n.id]);
    }
    for (const n of tree) {
      if (!n.id.startsWith("gen-")) continue;
      const owners = cellOwners.get(`${n.gridX},${n.gridY}`)!;
      expect(owners, `gen node ${n.id} shares cell with ${owners.join(", ")}`).toEqual([n.id]);
    }
  });

  it("whole graph is connected to grid-start", () => {
    const seen = new Set(["grid-start"]);
    const q = ["grid-start"];
    while (q.length) {
      const cur = byId.get(q.pop()!)!;
      for (const nb of cur.neighbors)
        if (!seen.has(nb)) {
          seen.add(nb);
          q.push(nb);
        }
    }
    expect(seen.size).toBe(tree.length);
  });

  it("is deterministic (two builds deep-equal)", () => {
    const a = buildExtendedPassiveTree(BASE_NODES);
    const b = buildExtendedPassiveTree(BASE_NODES);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

const MAX_POINTS = 100; // 1/level, level cap 100 (hero.ts) — the only point source

/** Unweighted hop distance from `fromId` (contiguous allocation cost = hops). */
function bfsDepth(fromId: string): Map<string, number> {
  const depth = new Map<string, number>([[fromId, 0]]);
  const q = [fromId];
  while (q.length) {
    const cur = byId.get(q.shift()!)!;
    const d = depth.get(cur.id)!;
    for (const nb of cur.neighbors)
      if (!depth.has(nb)) {
        depth.set(nb, d + 1);
        q.push(nb);
      }
  }
  return depth;
}

describe("passive tree — commitment + coverage", () => {
  const depth = bfsDepth("grid-start");
  const regions = REGION_GROWTH.map((r) => r.region);
  const outerCost = (region: string) => depth.get(`gen-${region}-K`) ?? Infinity;

  it("reaching one lobe's capstone costs most of the budget (>= 45)", () => {
    for (const r of regions) expect(outerCost(r), `${r} capstone`).toBeGreaterThanOrEqual(45);
  });

  it("two different lobes' capstones cannot both be afforded at max", () => {
    const costs = regions.map(outerCost).sort((a, b) => a - b);
    expect(costs[0] + costs[1]).toBeGreaterThan(MAX_POINTS);
  });

  it("100 points is less than 1/5 of the live tree (headline requirement)", () => {
    expect(MAX_POINTS / PASSIVE_NODES.length).toBeLessThan(0.2);
  });
});
