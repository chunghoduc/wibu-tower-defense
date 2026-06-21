import { describe, expect, it } from "vitest";
import { makeStats } from "../src/data/schema.ts";
import { SUMMON_MAP } from "../src/data/summons.ts";
import { MINION_CAP } from "../src/core/battleMinions.ts";
import { mkEnemy, mkTower, mkStage, oneWave, world } from "./fixtures.ts";

/** A world with one enemy and an inert tower, enemy spawned and standing. */
function spawnedWorld(enemy = mkEnemy({ baseStats: makeStats({ maxHp: 100000 }) })) {
  const stage = mkStage(oneWave(enemy.id, 1), { castleHp: 1e9, slots: [{ x: 150, y: -30 }] });
  const inert = mkTower({ baseStats: makeStats({ attackSpeed: 0, range: 0 }) });
  const b = world([enemy], [inert], stage);
  for (let i = 0; i < 120 && b.enemies.length === 0; i++) b.tick(0.05);
  return b;
}

const golem = SUMMON_MAP.get("frost-golem")!;
const sprite = SUMMON_MAP.get("flame-sprite")!;

describe("minion simulation", () => {
  it("summonMinion adds a live minion scaled off the summoner", () => {
    const b = spawnedWorld();
    b.summonMinion(golem, { x: 100, y: 100 }, 1000, 5000, golem.lifespan);
    expect(b.minions.length).toBe(1);
    expect(b.minions[0].alive).toBe(true);
    expect(b.minions[0].stats.atk).toBeCloseTo(1000 * golem.atkFrac, 3);
  });

  it("a minion damages a nearby enemy over time", () => {
    const b = spawnedWorld();
    const e = b.enemies[0];
    b.summonMinion(golem, { x: e.pos.x, y: e.pos.y }, 4000, 5000, 30);
    const hp0 = e.hp;
    for (let i = 0; i < 60; i++) b.tick(0.05); // 3s
    expect(e.hp).toBeLessThan(hp0);
  });

  it("a frost minion slows the enemy it hits", () => {
    const b = spawnedWorld();
    const e = b.enemies[0];
    b.summonMinion(golem, { x: e.pos.x, y: e.pos.y }, 4000, 5000, 30);
    for (let i = 0; i < 40 && e.slowTimer <= 0; i++) b.tick(0.05);
    expect(e.slowTimer).toBeGreaterThan(0);
  });

  it("a minion despawns when its lifespan runs out", () => {
    const b = spawnedWorld();
    b.summonMinion(sprite, { x: 100, y: 100 }, 1000, 5000, 1.0);
    expect(b.minions.length).toBe(1);
    for (let i = 0; i < 30; i++) b.tick(0.05); // 1.5s > lifespan
    expect(b.minions.length).toBe(0);
  });

  it("never exceeds the concurrency cap", () => {
    const b = spawnedWorld();
    for (let i = 0; i < MINION_CAP + 6; i++) {
      b.summonMinion(sprite, { x: 100, y: 100 }, 500, 5000, 30);
    }
    expect(b.minions.length).toBeLessThanOrEqual(MINION_CAP);
  });

  it("enemies never target friendly minions (minions take no enemy damage)", () => {
    const b = spawnedWorld();
    b.summonMinion(golem, { x: 640, y: 360 }, 1000, 5000, 30);
    const m = b.minions[0];
    const hp0 = m.hp;
    for (let i = 0; i < 40; i++) b.tick(0.05);
    expect(m.hp).toBe(hp0);
  });
});
