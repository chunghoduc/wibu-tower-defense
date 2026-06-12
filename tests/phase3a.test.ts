import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { makeStats } from "../src/data/schema.ts";
import { createFreshSave } from "../src/core/save.ts";
import { awardHeroXp } from "../src/core/hero.ts";
import { mkEnemy, mkStage, mkTower, oneWave, runFor } from "./fixtures.ts";

describe("BattleState with heroSave", () => {
  it("hero level 10 has higher atk than level 1", () => {
    const baseStats = makeStats({
      atk: 100,
      maxHp: 500,
      moveSpeed: 80,
      attackSpeed: 1,
      range: 200,
    });
    const lvl1Save = createFreshSave();
    const lvl10Save = createFreshSave();
    awardHeroXp(lvl10Save, 6500);

    const stage = mkStage(oneWave("grunt", 1));
    const catalog = { enemies: new Map([["grunt", mkEnemy()]]), characters: new Map() };

    const b1 = new BattleState(stage, catalog, {
      hero: { stats: baseStats, startPos: { x: -100, y: 0 } },
      heroSave: lvl1Save,
    });
    const b10 = new BattleState(stage, catalog, {
      hero: { stats: baseStats, startPos: { x: -100, y: 0 } },
      heroSave: lvl10Save,
    });

    expect(b10.hero.stats.atk).toBeGreaterThan(b1.hero.stats.atk);
    expect(b10.hero.stats.maxHp).toBeGreaterThan(b1.hero.stats.maxHp);
  });

  it("equipped pet generates gold over time", () => {
    const save = createFreshSave();
    save.inventory.items.push({
      id: "test-pet-1",
      defId: "coin-sprite",
      acquiredLevel: 1,
      rolledStats: { goldFind: 0.05 },
      rolledPrimaryAffix: 0.05,
      rolledAffixes: [],
      enhanceLevel: 0,
    });
    save.inventory.equipped = { Pet: "test-pet-1" };

    const stage = mkStage(oneWave("grunt", 1), { castleHp: 1e6, startingGold: 0 });
    const catalog = { enemies: new Map([["grunt", mkEnemy()]]), characters: new Map() };
    const baseStats = makeStats({ maxHp: 500, attackSpeed: 0, range: 0, moveSpeed: 0 });
    const b = new BattleState(stage, catalog, {
      hero: { stats: baseStats, startPos: { x: -500, y: 0 } },
      heroSave: save,
    });

    const goldBefore = b.gold;
    runFor(b, 3);
    expect(b.gold).toBeGreaterThan(goldBefore + 4);
  });

  it("no heroSave — BattleState works as before (no regression)", () => {
    const stage = mkStage(oneWave("grunt", 3));
    const catalog = {
      enemies: new Map([["grunt", mkEnemy()]]),
      characters: new Map([["turret", mkTower()]]),
    };
    const baseStats = makeStats({ atk: 500, maxHp: 1000, attackSpeed: 2, range: 400 });
    const b = new BattleState(stage, catalog, {
      hero: { stats: baseStats, startPos: { x: 200, y: -50 } },
    });
    b.placeTower("turret", 0);
    let ticks = 0;
    while (b.outcome === "ongoing" && ticks < 2000) {
      b.tick(0.05);
      ticks++;
    }
    expect(b.outcome).toBe("won");
  });
});
