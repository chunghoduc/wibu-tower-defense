import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/data/catalog.ts";
import { TOWER_ROLES, type EnemyArchetype } from "../src/data/schema.ts";

const cat = loadCatalog();

describe("character roster", () => {
  it("has 30-40 characters", () => {
    expect(cat.characters.size).toBeGreaterThanOrEqual(30);
    expect(cat.characters.size).toBeLessThanOrEqual(40);
  });

  it("covers all 7 tower roles", () => {
    const roles = new Set([...cat.characters.values()].map((c) => c.role));
    for (const role of TOWER_ROLES) expect(roles.has(role)).toBe(true);
  });

  it("gives role-dependent towers the behavior params they need to function", () => {
    for (const c of cat.characters.values()) {
      if (c.role === "economy") expect(c.behavior?.goldPerSec).toBeGreaterThan(0);
      if (c.role === "support") expect(c.behavior?.buffAura).toBeTruthy();
      if (c.role === "dot") expect(c.behavior?.dot).toBeTruthy();
      if (c.role === "debuff") expect(c.behavior?.slow ?? c.behavior?.stun).toBeTruthy();
      if (c.role === "chain") expect(c.behavior?.chainTargets).toBeGreaterThan(0);
    }
  });

  it("has a positive placement cost for every character", () => {
    for (const c of cat.characters.values()) expect(c.cost).toBeGreaterThan(0);
  });
});

describe("enemy roster", () => {
  it("includes every designed archetype", () => {
    const required: EnemyArchetype[] = [
      "Rusher", "Brute", "Bulwark", "Mender", "Regenerator", "Splitter",
      "Gargoyle", "StormFlyer", "Sapper", "Phantom", "Summoner", "Raider",
      "Courier", "Boss",
    ];
    const present = new Set([...cat.enemies.values()].map((e) => e.archetype));
    for (const a of required) expect(present.has(a)).toBe(true);
  });

  it("never makes an enemy immune to more than one thing (no lock-and-key)", () => {
    // The schema allows a single immunity value; assert the data respects intent.
    for (const e of cat.enemies.values()) {
      if (e.immunity !== null) {
        expect(["Physical", "Magic", "CC", "AoE"]).toContain(e.immunity);
      }
    }
  });
});

describe("chapter 1 stages", () => {
  it("has 10 stages", () => {
    expect(cat.stages.size).toBe(10);
  });

  it("every stage has multiple waves ending in a boss", () => {
    for (const s of cat.stages.values()) {
      expect(s.waves.length).toBeGreaterThanOrEqual(3);
      const lastWave = s.waves[s.waves.length - 1];
      const hasBoss = lastWave.spawns.some(
        (grp) => cat.enemies.get(grp.enemyId)?.archetype === "Boss",
      );
      expect(hasBoss).toBe(true);
    }
  });

  it("only references enemies that exist (loadCatalog cross-check passed)", () => {
    for (const s of cat.stages.values()) {
      for (const wave of s.waves) {
        for (const grp of wave.spawns) expect(cat.enemies.has(grp.enemyId)).toBe(true);
      }
    }
  });
});
