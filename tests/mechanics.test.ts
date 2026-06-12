import { describe, expect, it } from "vitest";
import { makeStats } from "../src/data/schema.ts";
import {
  mkEnemy,
  mkStage,
  mkTower,
  oneWave,
  runFor,
  runUntilDone,
  world,
} from "./fixtures.ts";

describe("support role", () => {
  it("buffs nearby towers via its aura", () => {
    const support = mkTower({
      id: "support",
      role: "support",
      behavior: { buffAura: { radius: 200, atkPct: 0.2, attackSpeedPct: 0.1 } },
      baseStats: makeStats({ atk: 0, attackSpeed: 0, range: 0, maxHp: 100 }),
    });
    const dmg = mkTower({ id: "dmg" });
    const stage = mkStage(oneWave("grunt", 1), {
      castleHp: 1e6,
      slots: [
        { x: 150, y: -30 },
        { x: 160, y: -30 },
      ],
    });
    const b = world([mkEnemy()], [support, dmg], stage);
    b.placeTower("support", 0);
    b.placeTower("dmg", 1);
    runFor(b, 0.1);
    const buffed = b.towers.find((t) => t.def.id === "dmg")!;
    expect(buffed.buffAtkPct).toBeCloseTo(0.2);
    expect(buffed.buffAsPct).toBeCloseTo(0.1);
  });
});

describe("debuff role (slow)", () => {
  it("a pure-slow tower delays the enemy reaching the castle", () => {
    const enemy = mkEnemy({
      baseStats: makeStats({ maxHp: 1e6, moveSpeed: 50, atk: 0, attackSpeed: 0 }),
      castleDamage: 100,
    });
    const slowTower = mkTower({
      id: "slow",
      role: "debuff",
      behavior: { slow: { pct: 0.5, duration: 5 } },
      baseStats: makeStats({ atk: 0, attackSpeed: 2, range: 400, maxHp: 100 }),
    });
    const inertTower = mkTower({
      id: "inert",
      role: "damage",
      baseStats: makeStats({ atk: 0, attackSpeed: 2, range: 400, maxHp: 100 }),
    });

    const slowed = world([enemy], [slowTower], mkStage(oneWave("grunt", 1), { castleHp: 1 }));
    slowed.placeTower("slow", 0);
    const slowedTicks = runUntilDone(slowed);

    const control = world([enemy], [inertTower], mkStage(oneWave("grunt", 1), { castleHp: 1 }));
    control.placeTower("inert", 0);
    const controlTicks = runUntilDone(control);

    expect(slowed.outcome).toBe("lost");
    expect(control.outcome).toBe("lost");
    expect(slowedTicks).toBeGreaterThan(controlTicks * 1.4);
  });
});

describe("stealth", () => {
  it("is invisible to towers (reaches the castle) but a strong tower clears a non-stealth twin", () => {
    const ghost = mkEnemy({ id: "ghost", special: { stealth: true }, baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 0 }) });
    const seen = mkEnemy({ id: "seen", baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 0 }) });

    const stealthWorld = world([ghost], [mkTower()], mkStage(oneWave("ghost", 1), { castleHp: 1 }));
    stealthWorld.placeTower("turret", 0);
    runUntilDone(stealthWorld);
    expect(stealthWorld.outcome).toBe("lost");

    const seenWorld = world([seen], [mkTower()], mkStage(oneWave("seen", 1), { castleHp: 1 }));
    seenWorld.placeTower("turret", 0);
    runUntilDone(seenWorld);
    expect(seenWorld.outcome).toBe("won");
  });
});

describe("destructible towers", () => {
  it("an enemy that attacks towers can destroy one and free its slot", () => {
    const sapper = mkEnemy({
      id: "sapper",
      special: { attacksTowers: { range: 130 } },
      castleDamage: 0,
      baseStats: makeStats({ maxHp: 1e6, moveSpeed: 20, atk: 100, attackSpeed: 2 }),
    });
    const fragile = mkTower({ id: "fragile", baseStats: makeStats({ atk: 0, attackSpeed: 0, range: 0, maxHp: 50 }) });
    // A neutral parked hero — the default fixture hero has 1e9 maxHp, and towers
    // now inherit 60% of the hero's stats, which would make the tower unkillable.
    const b = world([sapper], [fragile], mkStage(oneWave("sapper", 1), { castleHp: 1e6 }), {
      hero: { stats: makeStats({ maxHp: 100 }), startPos: { x: -500, y: -500 } },
    });
    expect(b.placeTower("fragile", 0)).toBe(true);
    runFor(b, 6);
    expect(b.towers.length).toBe(0); // destroyed and cleaned up
    expect(b.outcome).toBe("ongoing");
    expect(b.placeTower("fragile", 0)).toBe(true); // slot freed
  });
});

describe("shields", () => {
  it("absorb damage so a weak tower cannot break through an oversized shield", () => {
    const shielded = mkEnemy({ id: "shield", special: { shieldHp: 1e6 }, baseStats: makeStats({ maxHp: 50, moveSpeed: 50, atk: 0 }) });
    const weak = mkTower({ id: "weak", baseStats: makeStats({ atk: 30, attackSpeed: 2, range: 400, maxHp: 100 }) });
    const b = world([shielded], [weak], mkStage(oneWave("shield", 1), { castleHp: 1 }));
    b.placeTower("weak", 0);
    runUntilDone(b);
    expect(b.outcome).toBe("lost");
  });
});

describe("splitter", () => {
  it("spawns child enemies when it dies", () => {
    const splitter = mkEnemy({
      id: "splitter",
      special: { splitInto: { enemyId: "child", count: 2 } },
      baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 0 }),
    });
    const child = mkEnemy({ id: "child", baseStats: makeStats({ maxHp: 1e6, moveSpeed: 1, atk: 0 }) });
    const b = world([splitter, child], [mkTower()], mkStage(oneWave("splitter", 1), { castleHp: 1e6 }));
    b.placeTower("turret", 0);

    let sawChild = false;
    for (let i = 0; i < 200 && b.outcome === "ongoing"; i++) {
      b.tick(0.05);
      if (b.enemies.some((e) => e.def.id === "child")) sawChild = true;
    }
    expect(sawChild).toBe(true);
  });
});

describe("summoner", () => {
  it("periodically spawns adds", () => {
    const summoner = mkEnemy({
      id: "summoner",
      special: { summon: { enemyId: "add", count: 2, interval: 0.5 } },
      castleDamage: 0,
      baseStats: makeStats({ maxHp: 1e6, moveSpeed: 0, atk: 0 }),
    });
    const add = mkEnemy({ id: "add", castleDamage: 0, baseStats: makeStats({ maxHp: 1e6, moveSpeed: 0, atk: 0 }) });
    const b = world([summoner, add], [], mkStage(oneWave("summoner", 1), { castleHp: 1e6 }));

    let sawAdd = false;
    for (let i = 0; i < 160 && !sawAdd; i++) {
      b.tick(0.05);
      if (b.enemies.some((e) => e.def.id === "add")) sawAdd = true;
    }
    expect(sawAdd).toBe(true);
  });
});

describe("difficulty scaling", () => {
  it("multiplies enemy HP on higher tiers", () => {
    const spawnHp = (difficulty: "Normal" | "Nightmare") => {
      const e = mkEnemy({ baseStats: makeStats({ maxHp: 100, moveSpeed: 1 }) });
      const b = world([e], [], mkStage(oneWave("grunt", 1), { castleHp: 1e6 }), { difficulty });
      for (let i = 0; i < 200 && b.enemies.length === 0; i++) b.tick(0.05);
      return b.enemies[0]?.stats.maxHp ?? 0;
    };
    // 1.55× Normal floor (first wave ⇒ no intra-stage ramp; see waveScaling.ts).
    expect(spawnHp("Normal")).toBeCloseTo(155);
    expect(spawnHp("Nightmare")).toBeCloseTo(1480); // 14.8× HP — ~25× combat power vs Normal
  });

  it("Hard is ~10× the combat power (HP × ATK) of Normal", () => {
    const power = (difficulty: "Normal" | "Hard") => {
      const e = mkEnemy({ baseStats: makeStats({ maxHp: 100, atk: 10, moveSpeed: 1 }) });
      const b = world([e], [], mkStage(oneWave("grunt", 1), { castleHp: 1e6 }), { difficulty });
      for (let i = 0; i < 200 && b.enemies.length === 0; i++) b.tick(0.05);
      const s = b.enemies[0]!.stats;
      return s.maxHp * s.atk;
    };
    expect(power("Hard") / power("Normal")).toBeCloseTo(10, 0);
  });

  it("bosses scale harder than trash on Hard (extra boss multipliers)", () => {
    const spawn = (archetype: "Rusher" | "Boss") => {
      const e = mkEnemy({ archetype, baseStats: makeStats({ maxHp: 100, atk: 10, moveSpeed: 1 }) });
      const b = world([e], [], mkStage(oneWave("grunt", 1), { castleHp: 1e6 }), { difficulty: "Hard" });
      for (let i = 0; i < 200 && b.enemies.length === 0; i++) b.tick(0.05);
      return b.enemies[0]!.stats;
    };
    const trash = spawn("Rusher");
    const boss = spawn("Boss");
    expect(boss.maxHp / trash.maxHp).toBeCloseTo(2.0, 5); // bossHpMult on Hard
    expect(boss.atk / trash.atk).toBeCloseTo(1.3, 5); // bossAtkMult on Hard
  });
});
