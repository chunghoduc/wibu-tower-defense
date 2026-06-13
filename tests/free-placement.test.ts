import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { loadCatalog } from "../src/data/catalog.ts";
import { STAGE_1, defaultHeroStats, WORLD_WIDTH, WORLD_HEIGHT } from "../src/data/stage.ts";
import { groundLanes } from "../src/core/path.ts";
import type { StageDef } from "../src/data/schema.ts";

function battle() {
  return new BattleState(STAGE_1, loadCatalog(), {
    seed: 1,
    hero: {
      stats: defaultHeroStats(),
      startPos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
      damageType: "Physical",
    },
  });
}

/** Find a buildable open spot (not on the lane, not on an obstacle). */
function openSpot(b: BattleState): { x: number; y: number } {
  for (let y = 60; y < WORLD_HEIGHT - 60; y += 20) {
    for (let x = 60; x < WORLD_WIDTH - 60; x += 20) {
      if (b.canPlaceAt({ x, y })) return { x, y };
    }
  }
  throw new Error("no open spot");
}

describe("free tower placement", () => {
  it("places a tower at a valid open position", () => {
    const b = battle();
    const spot = openSpot(b);
    expect(b.placeTowerAt("zoran-thricedraw", spot)).toBe(true);
    expect(b.towers.length).toBe(1);
    expect(b.towers[0].pos.x).toBeCloseTo(spot.x, 0);
  });

  it("rejects placement on the lane corridor", () => {
    const b = battle();
    const mid = {
      x: (STAGE_1.path[0].x + STAGE_1.path[1].x) / 2,
      y: (STAGE_1.path[0].y + STAGE_1.path[1].y) / 2,
    };
    expect(b.canPlaceAt(mid)).toBe(false);
    expect(b.placeTowerAt("zoran-thricedraw", mid)).toBe(false);
  });

  it("rejects placement on a blocking obstacle", () => {
    const b = battle();
    const obstacle = (STAGE_1.terrain ?? []).find((t) => t.blocks);
    if (obstacle) {
      expect(b.canPlaceAt({ x: obstacle.x, y: obstacle.y })).toBe(false);
    }
  });

  it("rejects a second tower too close to the first", () => {
    const b = battle();
    const spot = openSpot(b);
    expect(b.placeTowerAt("zoran-thricedraw", spot)).toBe(true);
    expect(b.placeTowerAt("iron-bo-cannonarm", { x: spot.x + 4, y: spot.y + 4 })).toBe(false);
  });

  it("rejects placement off the world bounds", () => {
    const b = battle();
    expect(b.canPlaceAt({ x: -10, y: 100 })).toBe(false);
    expect(b.canPlaceAt({ x: WORLD_WIDTH + 10, y: 100 })).toBe(false);
  });
});

describe("placement blocks all campaign lanes", () => {
  it("rejects a spot sitting on the second lane", () => {
    const laneA = [
      { x: 0, y: 100 },
      { x: 600, y: 100 },
      { x: 600, y: 360 },
    ];
    const laneB = [
      { x: 0, y: 620 },
      { x: 600, y: 620 },
      { x: 600, y: 360 },
    ];
    const stage = {
      id: "ch1-s3",
      name: "TwoLane",
      path: laneA,
      lanes: [laneA, laneB],
      airSpawns: [{ x: 0, y: 360 }],
      castleHp: 1000,
      startingGold: 999,
      towerSlots: [],
      terrain: [],
      waves: [{ spawns: [] }],
    } as unknown as StageDef;
    const b = new BattleState(stage, loadCatalog(), {
      seed: 1,
      hero: { stats: defaultHeroStats(), startPos: { x: -500, y: -500 }, damageType: "Physical" },
    });
    expect(groundLanes(stage).length).toBe(2);
    // A point dead on lane B (y=620) must be blocked; a point clear of both is allowed.
    expect(b.canPlaceAt({ x: 300, y: 620 })).toBe(false);
    expect(b.canPlaceAt({ x: 300, y: 360 })).toBe(true);
  });
});
