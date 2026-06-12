import { describe, it, expect } from "vitest";
import { mkEnemy, mkTower, mkStage, world } from "./fixtures.ts";

describe("BattleState.castleMax", () => {
  it("captures the stage's starting castle HP and never mutates", () => {
    const stage = mkStage([{ spawns: [] }], { castleHp: 42 });
    const b = world([mkEnemy()], [mkTower()], stage);
    expect(b.castleMax).toBe(42);
    b.castleHp = 1;
    expect(b.castleMax).toBe(42);
  });
});
