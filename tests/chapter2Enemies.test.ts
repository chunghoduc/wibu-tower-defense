import { describe, expect, it } from "vitest";
import { world, mkEnemy, mkTower, mkStage, runFor } from "./fixtures.ts";
import { adaptiveImmuneType } from "../src/core/enemyAdaptive.ts";
import type { BattleState } from "../src/core/battle.ts";

/** Tick (dt 0.05) until the first enemy spawns; returns it. */
function spawnFirst(b: BattleState, cap = 60) {
  for (let t = 0; t < cap / 0.05 && b.enemies.length === 0; t++) b.tick(0.05);
  return b.enemies[0];
}

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

describe("Prism Behemoth — adaptive immunity", () => {
  function prismWorld(towerType: "Physical" | "Magic") {
    const prism = mkEnemy({
      id: "prism", name: "Prism Behemoth", archetype: "Adapter",
      baseStats: { ...mkEnemy().baseStats, maxHp: 100000, moveSpeed: 0, atk: 0 },
      special: { adaptiveImmunity: { types: ["Physical", "Magic"], switchIntervalSec: 3.5 } },
    });
    const tower = mkTower({ damageType: towerType, baseStats: { ...mkTower().baseStats, atk: 1000, attackSpeed: 10, range: 9999, maxHp: 1e9 } });
    const stage = mkStage([{ spawns: [{ enemyId: "prism", count: 1, interval: 1, delay: 0 }] }],
      { slots: [{ x: 10, y: 0 }], path: [{ x: 0, y: 0 }, { x: 50, y: 0 }] });
    const b = world([prism], [tower], stage, { seed: 1 });
    b.placeTower("turret", 0);
    return b;
  }

  it("starts immune to Physical at spawn", () => {
    const b = prismWorld("Magic");
    const e = spawnFirst(b);
    expect(adaptiveImmuneType(e.def.special, e.adaptPhaseIndex)).toBe("Physical");
  });

  it("a Physical-only tower stalls during the Physical phase but lands during the Magic phase", () => {
    const b = prismWorld("Physical");
    const e = spawnFirst(b);
    const hp0 = e.hp;
    runFor(b, 1.0); // still the Physical phase (timer ~3.5 from spawn) → no damage
    expect(e.hp).toBe(hp0);
    runFor(b, 3.0); // crosses into the Magic phase → Physical now lands
    expect(e.hp).toBeLessThan(hp0);
  });

  it("is always vulnerable to True damage regardless of phase", () => {
    const b = prismWorld("Magic");
    const e = spawnFirst(b);
    // Phase 0 = immune to Physical; True must never be blocked.
    expect(b.isImmune(e, "True", false)).toBe(false);
    expect(b.isImmune(e, "Physical", false)).toBe(true);
    runFor(b, 3.6); // switch to the Magic phase
    expect(b.isImmune(e, "True", false)).toBe(false);
    expect(b.isImmune(e, "Magic", false)).toBe(true);
  });
});

describe("Bloomrot Carrier — death nova", () => {
  it("damages towers within the nova radius when it dies", () => {
    const carrier = mkEnemy({
      id: "carrier", name: "Bloomrot Carrier", archetype: "Burster",
      baseStats: { ...mkEnemy().baseStats, maxHp: 30, moveSpeed: 0, atk: 0 },
      special: { deathNova: { radius: 110, damage: 45, type: "Magic" } },
    });
    // Low-HP, no-mitigation tower so the nova is observable; high atk to kill the carrier fast.
    const near = mkTower({ baseStats: { ...mkTower().baseStats, atk: 1000, attackSpeed: 10, range: 9999, maxHp: 100, magicResist: 0 } });
    const stage = mkStage([{ spawns: [{ enemyId: "carrier", count: 1, interval: 1, delay: 0 }] }],
      { slots: [{ x: 20, y: 0 }], path: [{ x: 0, y: 0 }, { x: 50, y: 0 }] });
    const b = world([carrier], [near], stage, { seed: 1 });
    b.placeTower("turret", 0);
    const tower = b.towers[0];
    const hp0 = tower.hp;
    runFor(b, 5); // carrier spawns, the tower kills it, the nova fires
    expect(b.enemies.length).toBe(0); // carrier dead + cleaned up
    expect(tower.hp).toBeLessThan(hp0); // nova hit the nearby tower (carrier deals no melee dmg)
  });

  it("spares towers outside the nova radius", () => {
    const carrier = mkEnemy({
      id: "carrier2", archetype: "Burster",
      baseStats: { ...mkEnemy().baseStats, maxHp: 30, moveSpeed: 0, atk: 0 },
      special: { deathNova: { radius: 50, damage: 45, type: "Magic" } },
    });
    const far = mkTower({ baseStats: { ...mkTower().baseStats, atk: 1000, attackSpeed: 10, range: 9999, maxHp: 100, magicResist: 0 } });
    const stage = mkStage([{ spawns: [{ enemyId: "carrier2", count: 1, interval: 1, delay: 0 }] }],
      { slots: [{ x: 400, y: 0 }], path: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }); // tower 400u away (> radius 50)
    const b = world([carrier], [far], stage, { seed: 1 });
    b.placeTower("turret", 0);
    const tower = b.towers[0];
    const hp0 = tower.hp;
    runFor(b, 5);
    expect(b.enemies.length).toBe(0); // carrier dead
    expect(tower.hp).toBe(hp0); // untouched — nova radius didn't reach it
  });
});
