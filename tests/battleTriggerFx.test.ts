import { describe, expect, it } from "vitest";
import { TRIGGERED_EFFECTS } from "../src/data/triggeredEffects.ts";
import { makeStats } from "../src/data/schema.ts";
import { mkEnemy, mkTower, mkStage, oneWave, world } from "./fixtures.ts";

/** A world with one enemy and an inert tower (attackSpeed 0 → never attacks), so
 *  the enemy survives and we can drive the trigger handlers directly. */
function spawnedWorld(enemy = mkEnemy()) {
  const stage = mkStage(oneWave(enemy.id, 1), { castleHp: 1e9, slots: [{ x: 150, y: -30 }] });
  const inert = mkTower({ baseStats: makeStats({ attackSpeed: 0, range: 0 }) });
  const b = world([enemy], [inert], stage);
  for (let i = 0; i < 120 && b.enemies.length === 0; i++) b.tick(0.05);
  return b;
}

describe("trigger sim handlers", () => {
  it("guaranteed cull slays a low-HP non-boss on hit", () => {
    const b = spawnedWorld();
    b.triggers.onHit.push(TRIGGERED_EFFECTS.cull);
    const e = b.enemies[0];
    e.hp = e.stats.maxHp * 0.05; // below the 8% threshold
    b.fireOnHit(b.hero, b.hero.pos, e, 1, false);
    expect(e.alive).toBe(false);
  });

  it("cull never executes a boss, even below the threshold", () => {
    const b = spawnedWorld(mkEnemy({ id: "boss", archetype: "Boss" }));
    b.triggers.onHit.push(TRIGGERED_EFFECTS.cull);
    const e = b.enemies[0];
    e.hp = e.stats.maxHp * 0.02;
    b.fireOnHit(b.hero, b.hero.pos, e, 1, false);
    expect(e.alive).toBe(true);
  });

  it("thornmail reflects damage back to the attacker", () => {
    const b = spawnedWorld();
    b.triggers.onHurt.push(TRIGGERED_EFFECTS.thornmail);
    const e = b.enemies[0];
    const hp0 = e.hp;
    b.fireOnHurt(e, 100);
    expect(e.hp).toBeLessThan(hp0);
  });

  it("detonate damages a bystander on kill (and does not recurse forever)", () => {
    const stage = mkStage(oneWave("grunt", 2, 0.1), {
      castleHp: 1e9,
      slots: [{ x: 150, y: -30 }],
    });
    const inert = mkTower({ baseStats: makeStats({ attackSpeed: 0, range: 0 }) });
    const b = world([mkEnemy({ baseStats: makeStats({ maxHp: 1000 }) })], [inert], stage);
    for (let i = 0; i < 120 && b.enemies.length < 2; i++) b.tick(0.05);
    expect(b.enemies.length).toBeGreaterThanOrEqual(2);
    const victim = b.enemies[0];
    const bystander = b.enemies[1];
    bystander.pos = { ...victim.pos }; // co-located → inside the blast radius
    const hp0 = bystander.hp;
    b.triggers.onKill.push(TRIGGERED_EFFECTS.detonate);
    b.killEnemy(victim);
    expect(bystander.hp).toBeLessThan(hp0);
  });
});
