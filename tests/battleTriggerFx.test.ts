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

  it("overkill heals the hero by a fraction of the overkill damage on a kill", () => {
    const b = spawnedWorld();
    b.triggers.onKill.push(TRIGGERED_EFFECTS.overkiller);
    const e = b.enemies[0];
    e.hp = -500; // 500 overkill below zero
    b.hero.hp = 1;
    b.killEnemy(e);
    // 30% of 500 = 150 healed (clamped to maxHp).
    expect(b.hero.hp).toBeGreaterThan(1);
  });

  it("frostnova freezes a bystander when an enemy dies near it", () => {
    const stage = mkStage(oneWave("grunt", 2, 0.1), {
      castleHp: 1e9,
      slots: [{ x: 150, y: -30 }],
    });
    const inert = mkTower({ baseStats: makeStats({ attackSpeed: 0, range: 0 }) });
    const b = world([mkEnemy()], [inert], stage);
    for (let i = 0; i < 120 && b.enemies.length < 2; i++) b.tick(0.05);
    expect(b.enemies.length).toBeGreaterThanOrEqual(2);
    const victim = b.enemies[0];
    const bystander = b.enemies[1];
    bystander.pos = { ...victim.pos };
    b.triggers.onKill.push(TRIGGERED_EFFECTS.frostnova);
    b.killEnemy(victim);
    expect(bystander.stunTimer).toBeGreaterThan(0);
  });

  it("glaciate freezes the attacker that struck the hero", () => {
    const b = spawnedWorld();
    b.triggers.onHurt.push(TRIGGERED_EFFECTS.glaciate);
    const e = b.enemies[0];
    // chance < 1 — force it by stacking many rolls until one lands (deterministic rng).
    let stunned = false;
    for (let i = 0; i < 200 && !stunned; i++) {
      e.stunTimer = 0;
      b.fireOnHurt(e, 50);
      stunned = e.stunTimer > 0;
    }
    expect(stunned).toBe(true);
  });

  it("a fast attacker procs an on-hit chance LESS often than a slow one (proc coefficient)", () => {
    const slow = spawnedWorld();
    const fast = spawnedWorld();
    slow.triggers.onHit.push(TRIGGERED_EFFECTS.permafrost); // chance 0.12
    fast.triggers.onHit.push(TRIGGERED_EFFECTS.permafrost);
    slow.hero.stats.attackSpeed = 1; // <= ref → full chance
    fast.hero.stats.attackSpeed = 5; // capped fast → reduced chance
    let slowHits = 0;
    let fastHits = 0;
    const es = slow.enemies[0];
    const ef = fast.enemies[0];
    for (let i = 0; i < 400; i++) {
      es.stunTimer = 0;
      ef.stunTimer = 0;
      slow.fireOnHit(slow.hero, slow.hero.pos, es, 1, false);
      fast.fireOnHit(fast.hero, fast.hero.pos, ef, 1, false);
      if (es.stunTimer > 0) slowHits++;
      if (ef.stunTimer > 0) fastHits++;
    }
    expect(slowHits).toBeGreaterThan(fastHits);
  });

  it("frostguard chills nearby foes when the hero is struck", () => {
    const b = spawnedWorld();
    b.triggers.onHurt.push(TRIGGERED_EFFECTS.frostguard);
    const e = b.enemies[0];
    e.pos = { ...b.hero.pos }; // inside the aura radius
    expect(e.slowTimer).toBe(0);
    b.fireOnHurt(e, 50);
    expect(e.slowTimer).toBeGreaterThan(0);
    expect(e.slowPct).toBeGreaterThan(0);
  });

  it("aegisthorns retaliates for a fraction of the hero's MAX HP (less vs bosses)", () => {
    const normal = spawnedWorld();
    const boss = spawnedWorld(mkEnemy({ id: "boss", archetype: "Boss" }));
    for (const b of [normal, boss]) {
      b.triggers.onHurt.push(TRIGGERED_EFFECTS.aegisthorns);
      b.hero.stats.maxHp = 10000;
    }
    const en = normal.enemies[0];
    const eb = boss.enemies[0];
    en.hp = en.stats.maxHp = 1e9; // huge bag so the hit never kills
    eb.hp = eb.stats.maxHp = 1e9;
    const n0 = en.hp;
    const b0 = eb.hp;
    normal.fireOnHurt(en, 1);
    boss.fireOnHurt(eb, 1);
    const normalDealt = n0 - en.hp;
    const bossDealt = b0 - eb.hp;
    expect(normalDealt).toBeGreaterThan(0);
    // ~6% of 10000 max HP retaliated; reduced on the boss.
    expect(normalDealt).toBeGreaterThan(bossDealt);
    expect(bossDealt).toBeGreaterThan(0);
  });

  it("secondwind heals the hero only when struck below the low-HP threshold", () => {
    const b = spawnedWorld();
    b.triggers.onHurt.push(TRIGGERED_EFFECTS.secondwind);
    b.hero.stats.maxHp = 1000;
    // Above threshold: no heal.
    b.hero.hp = 900;
    b.fireOnHurt(b.enemies[0], 10);
    expect(b.hero.hp).toBe(900);
    // Below threshold: heals a chunk of max HP.
    b.hero.hp = 200;
    b.fireOnHurt(b.enemies[0], 10);
    expect(b.hero.hp).toBeGreaterThan(200);
  });

  it("undying lets the hero survive ONE fatal blow per battle, then die", () => {
    const b = spawnedWorld();
    b.triggers.onHurt.push(TRIGGERED_EFFECTS.undying);
    b.hero.stats.maxHp = 1000;
    b.hero.hp = 50;
    const e = b.enemies[0];
    e.stats.atk = 1e6; // guaranteed lethal
    b.dealDamageToHero(e);
    expect(b.hero.alive).toBe(true);
    expect(b.hero.hp).toBeGreaterThan(0); // revived to a survival floor
    // Second fatal blow: the once-per-battle guard is spent.
    b.dealDamageToHero(e);
    expect(b.hero.alive).toBe(false);
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
