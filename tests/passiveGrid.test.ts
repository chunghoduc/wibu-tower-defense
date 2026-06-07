import { describe, expect, it } from "vitest";
import { PASSIVE_NODES, PASSIVE_NODES_MAP, getReachableNodes, canForgetNode } from "../src/data/passiveGrid.ts";
import { PASSIVE_REGIONS } from "../src/data/schema.ts";

describe("PASSIVE_NODES catalog", () => {
  it("has at least 60 nodes", () => {
    expect(PASSIVE_NODES.length).toBeGreaterThanOrEqual(60);
  });
  it("has no duplicate ids", () => {
    const ids = PASSIVE_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers all 8 regions", () => {
    const regions = new Set(PASSIVE_NODES.map((n) => n.region));
    for (const r of PASSIVE_REGIONS) expect(regions.has(r)).toBe(true);
  });
  it("all neighbor references point to existing nodes", () => {
    for (const node of PASSIVE_NODES) {
      for (const neighborId of node.neighbors) {
        expect(PASSIVE_NODES_MAP.has(neighborId), `${node.id} references missing neighbor ${neighborId}`).toBe(true);
      }
    }
  });
  it("neighbor graph is bidirectional", () => {
    for (const node of PASSIVE_NODES) {
      for (const neighborId of node.neighbors) {
        const neighbor = PASSIVE_NODES_MAP.get(neighborId)!;
        expect(neighbor.neighbors, `${neighborId} doesn't list ${node.id} as neighbor`).toContain(node.id);
      }
    }
  });
  it("prestige nodes have unlockAtLevel set", () => {
    const prestige = PASSIVE_NODES.filter((n) => n.region === "prestige");
    for (const n of prestige) {
      expect(n.unlockAtLevel, `prestige node ${n.id} missing unlockAtLevel`).toBeGreaterThan(0);
    }
  });
  it("has at least 3 keystone nodes", () => {
    expect(PASSIVE_NODES.filter((n) => n.type === "keystone").length).toBeGreaterThanOrEqual(3);
  });
});

describe("getReachableNodes", () => {
  it("starting node is always reachable with 0 unlocked", () => {
    expect(getReachableNodes([], 1).length).toBeGreaterThan(0);
  });
  it("unlocking a node makes its neighbors reachable", () => {
    const reachable = getReachableNodes(["grid-start"], 1);
    const start = PASSIVE_NODES_MAP.get("grid-start")!;
    for (const neighborId of start.neighbors) {
      expect(reachable.map((n) => n.id)).toContain(neighborId);
    }
  });
  it("prestige nodes locked below required hero level", () => {
    const reachable = getReachableNodes([], 1);
    const locked = reachable.filter((n) => n.region === "prestige" && (n.unlockAtLevel ?? 0) > 1);
    expect(locked.length).toBe(0);
  });
});

describe("canForgetNode", () => {
  // A simple unlocked chain off the start: start → p1 → p2.
  const chain = ["grid-start", "brawler-p1", "brawler-p2"];

  it("a leaf node can be forgotten (removing it leaves the rest connected)", () => {
    expect(canForgetNode(chain, "brawler-p2")).toBe(true);
  });

  it("an interior node cannot be forgotten (it would orphan its descendants)", () => {
    // Forgetting brawler-p1 would disconnect brawler-p2 from grid-start.
    expect(canForgetNode(chain, "brawler-p1")).toBe(false);
  });

  it("the start node cannot be forgotten while other nodes remain", () => {
    expect(canForgetNode(chain, "grid-start")).toBe(false);
  });

  it("the start node CAN be forgotten when it is the only unlocked node", () => {
    expect(canForgetNode(["grid-start"], "grid-start")).toBe(true);
  });

  it("a node that is not unlocked cannot be forgotten", () => {
    expect(canForgetNode(chain, "brawler-notable-1")).toBe(false);
  });
});
