import { describe, it, expect } from "vitest";
import { endlessArenaStage } from "../src/core/endlessArena.ts";
import { STAGE_1 } from "../src/data/stage.ts";

describe("endlessArenaStage", () => {
  it("attaches a maze arena and centers the castle, inheriting base economy", () => {
    const s = endlessArenaStage(STAGE_1, 5);
    expect(s.arena).toBeDefined();
    expect(s.arena!.routes.length).toBeGreaterThan(0);
    expect(s.castleHp).toBe(STAGE_1.castleHp);
    expect(s.startingGold).toBe(STAGE_1.startingGold);
    expect(s.terrain).toEqual([]); // the maze IS the terrain
    // fallbacks for incidental stage.path readers point into the arena
    expect(s.path).toEqual(s.arena!.routes[0]);
    expect(s.airSpawns).toEqual(s.arena!.gates);
  });

  it("is deterministic per seed and does not mutate the base stage", () => {
    expect(endlessArenaStage(STAGE_1, 8)).toEqual(endlessArenaStage(STAGE_1, 8));
    expect(STAGE_1.arena).toBeUndefined();
  });
});
