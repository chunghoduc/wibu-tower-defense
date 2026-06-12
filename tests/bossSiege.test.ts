import { describe, expect, it } from "vitest";
import { makeStats } from "../src/data/schema.ts";
import { BOSS_TOWER_DAMAGE_MULT } from "../src/core/battleTypes.ts";
import { mkEnemy, mkStage, mkTower, oneWave, world } from "./fixtures.ts";

describe("boss→tower damage scalar", () => {
  it("is a real fraction (boss hits towers for less than full, more than nothing)", () => {
    expect(BOSS_TOWER_DAMAGE_MULT).toBeGreaterThan(0);
    expect(BOSS_TOWER_DAMAGE_MULT).toBeLessThan(1);
  });
});

describe("boss sieges a tower", () => {
  // A boss marching the lane with a tower in reach should STOP (its distance
  // along the route plateaus while the tower lives), not walk past it.
  function siegeWorld(towerHp: number) {
    const boss = mkEnemy({
      archetype: "Boss",
      boss: { enrage: { belowHpPct: 0.0, atkMult: 1, speedMult: 1 } },
      weapon: { family: "sword", display: "greatblade" },
      castleDamage: 0,
      baseStats: makeStats({ maxHp: 1e9, moveSpeed: 30, atk: 60, attackSpeed: 1 }),
    });
    const tower = mkTower({
      id: "wall",
      role: "tanker",
      baseStats: makeStats({ atk: 0, attackSpeed: 0, range: 0, maxHp: towerHp, armor: 30 }),
    });
    // Tower planted right on the lane so the boss's weapon reach covers it.
    const b = world([boss], [tower], mkStage(oneWave("grunt", 1), { castleHp: 1e9, slots: [{ x: 150, y: 0 }] }), {
      hero: { stats: makeStats({ maxHp: 100 }), startPos: { x: -2000, y: -2000 } },
    });
    expect(b.placeTower("wall", 0)).toBe(true);
    return b;
  }

  it("halts on the tower (distance along the route plateaus while the tower lives)", () => {
    const b = siegeWorld(1e9); // unbreakable wall — boss can never pass
    for (let i = 0; i < 200; i++) b.tick(0.05);
    const e = b.enemies[0]!;
    const d1 = e.distanceAlong;
    for (let i = 0; i < 100; i++) b.tick(0.05);
    const d2 = e.distanceAlong;
    expect(b.towers.length).toBe(1); // wall still standing
    expect(d2 - d1).toBeLessThan(1); // boss is stuck, not advancing
  });

  it("a tank tower holds the boss for a meaningful window, then falls", () => {
    const b = siegeWorld(1200);
    while (b.enemies.length === 0) b.tick(0.05); // let the boss spawn
    const boss = b.enemies[0]!;
    let hitsWhileAlive = 0;
    let lastCd = boss.attackCd;
    for (let i = 0; i < 4000 && b.towers.length > 0; i++) {
      b.tick(0.05);
      if (boss.attackCd > lastCd + 0.01) hitsWhileAlive++; // cooldown reset = a landed hit
      lastCd = boss.attackCd;
    }
    expect(b.towers.length).toBe(0); // eventually destroyed — not an infinite wall
    expect(hitsWhileAlive).toBeGreaterThanOrEqual(20); // survived "a while" (many boss hits)
  });

  // Pins the scalar precisely: a boss hits a tower for BOSS_TOWER_DAMAGE_MULT× what
  // an identical-stat NON-boss (a sapper that also stops to demolish) does. This
  // fails if the scalar is removed (the loose hit-count check above would not).
  it("a boss deals BOSS_TOWER_DAMAGE_MULT× a same-stat sapper's hit to a tower", () => {
    // First-hit damage to an identical, unbreakable tower for the given attacker.
    function firstHit(over: Partial<Parameters<typeof mkEnemy>[0]>) {
      const enemy = mkEnemy({
        weapon: { family: "sword", display: "blade" },
        castleDamage: 0,
        baseStats: makeStats({ maxHp: 1e9, moveSpeed: 30, atk: 100, attackSpeed: 1, armorPen: 0 }),
        ...over,
      });
      const tower = mkTower({
        id: "anvil",
        role: "tanker",
        baseStats: makeStats({ atk: 0, attackSpeed: 0, range: 0, maxHp: 1e9, armor: 30 }),
      });
      const b = world([enemy], [tower], mkStage(oneWave("grunt", 1), { castleHp: 1e9, slots: [{ x: 150, y: 0 }] }), {
        hero: { stats: makeStats({ maxHp: 100 }), startPos: { x: -2000, y: -2000 } },
      });
      b.placeTower("anvil", 0);
      const tw = b.towers[0]!;
      const full = tw.hp;
      for (let i = 0; i < 600 && tw.hp === full; i++) b.tick(0.05); // tick to the first landed hit
      return full - tw.hp;
    }
    // Boss vs a dedicated sapper with the SAME offensive stats; only `boss` differs.
    const bossDmg = firstHit({ archetype: "Boss", boss: { enrage: { belowHpPct: 0, atkMult: 1, speedMult: 1 } } });
    const sapperDmg = firstHit({ special: { attacksTowers: { range: 130 } } });
    expect(bossDmg).toBeGreaterThan(0);
    expect(sapperDmg).toBeGreaterThan(0);
    expect(bossDmg / sapperDmg).toBeCloseTo(BOSS_TOWER_DAMAGE_MULT, 5);
  });
});
