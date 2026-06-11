import { describe, expect, it } from "vitest";
import { world, mkEnemy, mkTower, mkStage, runFor } from "./fixtures.ts";

describe("Bloodmad Reaver — frenzy", () => {
  it("latches into frenzy once HP drops below 50% and speeds up", () => {
    const reaver = mkEnemy({
      id: "reaver", name: "Bloodmad Reaver", archetype: "Berserker",
      baseStats: { ...mkEnemy().baseStats, maxHp: 70, moveSpeed: 60, atk: 30 },
      special: { frenzy: { belowHpPct: 0.5, speedMult: 1.8, atkMult: 1.6 } },
    });
    // A weak (but unkillable) tower so the enemy survives and crosses 50% slowly.
    const tower = mkTower({ baseStats: { ...mkTower().baseStats, atk: 5, attackSpeed: 1.5, range: 600, maxHp: 1e9 } });
    const stage = mkStage([{ spawns: [{ enemyId: "reaver", count: 1, interval: 1, delay: 0 }] }],
      { slots: [{ x: 150, y: -30 }], path: [{ x: 0, y: 0 }, { x: 4000, y: 0 }] });
    const b = world([reaver], [tower], stage, { seed: 1 });
    b.placeTower("turret", 0);
    runFor(b, 11);
    const e = b.enemies[0];
    expect(e).toBeDefined();
    if (e.alive) {
      expect(e.hp / e.stats.maxHp).toBeLessThan(0.5);
      expect(e.frenzied).toBe(true);
      expect(b.enemySpeed(e)).toBeGreaterThan(60 * 1.5); // ~1.8× base
    } else {
      // If it died, it must have frenzied first — assert the latch fired this run.
      expect(e.frenzied).toBe(true);
    }
  });
});
