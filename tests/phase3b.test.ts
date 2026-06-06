import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { makeStats } from "../src/data/schema.ts";
import { createFreshSave } from "../src/core/save.ts";
import { addTowerToCollection, addTowerDupe } from "../src/core/collection.ts";
import { mkEnemy, mkStage, mkTower, oneWave, runUntilDone } from "./fixtures.ts";

const baseHeroStats = makeStats({ atk: 500, maxHp: 1000, attackSpeed: 2, range: 400 });
const heroStart = { stats: baseHeroStats, startPos: { x: 200, y: -50 } };

function makeWorld(heroSave = createFreshSave()) {
  const stage = mkStage(oneWave("grunt", 3));
  const catalog = {
    enemies: new Map([["grunt", mkEnemy()]]),
    characters: new Map([["turret", mkTower()]]),
  };
  return new BattleState(stage, catalog, { hero: heroStart, heroSave });
}

describe("BattleState tower collection — Phase 3b", () => {
  it("places tower when owned in collection", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "turret");
    const b = makeWorld(save);
    expect(b.placeTower("turret", 0)).toBe(true);
  });

  it("rejects tower placement when not in collection", () => {
    const save = createFreshSave();
    const b = makeWorld(save);
    expect(b.placeTower("turret", 0)).toBe(false);
  });

  it("5-star tower has higher stats than 1-star", () => {
    const save1 = createFreshSave();
    addTowerToCollection(save1, "turret");

    const save5 = createFreshSave();
    addTowerToCollection(save5, "turret");
    for (let i = 0; i < 4; i++) addTowerDupe(save5, "turret");

    const b1 = makeWorld(save1);
    b1.placeTower("turret", 0);

    const b5 = makeWorld(save5);
    b5.placeTower("turret", 0);

    expect(b5.towers[0].stats.atk).toBeGreaterThan(b1.towers[0].stats.atk);
    expect(b5.towers[0].hp).toBeGreaterThan(b1.towers[0].hp);
  });

  it("tower stats scale with hero level", () => {
    const saveLvl1 = createFreshSave();
    addTowerToCollection(saveLvl1, "turret");
    saveLvl1.hero.level = 1;

    const saveLvl20 = createFreshSave();
    addTowerToCollection(saveLvl20, "turret");
    saveLvl20.hero.level = 20;

    const b1 = makeWorld(saveLvl1);
    b1.placeTower("turret", 0);

    const b20 = makeWorld(saveLvl20);
    b20.placeTower("turret", 0);

    expect(b20.towers[0].stats.atk).toBeGreaterThan(b1.towers[0].stats.atk);
  });

  it("no heroSave — placeTower works as before (backwards compat)", () => {
    const stage = mkStage(oneWave("grunt", 3));
    const catalog = {
      enemies: new Map([["grunt", mkEnemy()]]),
      characters: new Map([["turret", mkTower()]]),
    };
    const b = new BattleState(stage, catalog, { hero: heroStart });
    expect(b.placeTower("turret", 0)).toBe(true);
    runUntilDone(b);
    expect(b.outcome).toBe("won");
  });
});
