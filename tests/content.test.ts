import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/data/catalog.ts";
import { RARITIES, TOWER_ROLES, type EnemyArchetype } from "../src/data/schema.ts";

const cat = loadCatalog();

describe("character roster", () => {
  it("has a roster in the expected size band", () => {
    // 37 launch towers + 16 weapon-family fillers (bow/crossbow/gun/tome/…).
    expect(cat.characters.size).toBeGreaterThanOrEqual(30);
    expect(cat.characters.size).toBeLessThanOrEqual(60);
  });

  it("covers all tower roles", () => {
    const roles = new Set([...cat.characters.values()].map((c) => c.role));
    for (const role of TOWER_ROLES) expect(roles.has(role)).toBe(true);
  });

  it("has at least one character of every rarity in every role", () => {
    for (const role of TOWER_ROLES) {
      for (const rarity of RARITIES) {
        const match = [...cat.characters.values()].some(
          (c) => c.role === role && c.rarity === rarity,
        );
        expect(match, `missing ${rarity} ${role}`).toBe(true);
      }
    }
  });

  it("only ever uses Physical or Magic for basic attacks (True is skill-only)", () => {
    for (const c of cat.characters.values()) {
      expect(["Physical", "Magic"]).toContain(c.damageType);
    }
  });

  it("enforces the damage-type stat archetype (Physical = no skill power, Magic = high)", () => {
    for (const c of cat.characters.values()) {
      if (c.damageType === "Physical") {
        expect(c.baseStats.skillPower, `${c.id} (Physical) should have no skill power`).toBe(1);
      } else if (c.damageType === "Magic") {
        expect(c.baseStats.skillPower, `${c.id} (Magic) should have high skill power`).toBeGreaterThanOrEqual(1.6);
      }
    }
  });

  it("gives role-dependent towers the behavior params they need to function", () => {
    for (const c of cat.characters.values()) {
      if (c.role === "support") expect(c.behavior?.buffAura).toBeTruthy();
      if (c.role === "dot") expect(c.behavior?.dot).toBeTruthy();
      if (c.role === "debuff") expect(c.behavior?.slow ?? c.behavior?.stun).toBeTruthy();
      if (c.role === "chain") expect(c.behavior?.chainTargets).toBeGreaterThan(0);
      if (c.role === "tanker") expect(c.behavior?.defenseScale).toBeTruthy();
    }
  });

  it("has a positive placement cost for every character", () => {
    for (const c of cat.characters.values()) expect(c.cost).toBeGreaterThan(0);
  });

  it("gives every character original lore", () => {
    for (const c of cat.characters.values()) {
      expect(c.description.trim().length).toBeGreaterThan(20);
    }
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

describe("campaign stages", () => {
  it("has 30 stages across five chapters", () => {
    expect(cat.stages.size).toBe(30);
    const ch1 = [...cat.stages.keys()].filter((id) => id.startsWith("ch1-"));
    const ch2 = [...cat.stages.keys()].filter((id) => id.startsWith("ch2-"));
    const ch3 = [...cat.stages.keys()].filter((id) => id.startsWith("ch3-"));
    const ch4 = [...cat.stages.keys()].filter((id) => id.startsWith("ch4-"));
    const ch5 = [...cat.stages.keys()].filter((id) => id.startsWith("ch5-"));
    expect(ch1.length).toBe(10);
    expect(ch2.length).toBe(5);
    expect(ch3.length).toBe(5);
    expect(ch4.length).toBe(5);
    expect(ch5.length).toBe(5);
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
