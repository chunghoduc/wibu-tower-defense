import { describe, expect, it } from "vitest";
import { BattleState, MANA_MAX } from "../src/core/battle.ts";
import {
  makeStats,
  type CharacterDef,
  type EnemyDef,
  type StageDef,
  type TowerBehavior,
  type WaveDef,
} from "../src/data/schema.ts";

// A near-immortal, near-stationary enemy so attacks keep landing without kills.
function tankEnemy(id: string): EnemyDef {
  return {
    id,
    name: "Wall",
    archetype: "Rusher",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 10,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 1e9, moveSpeed: 0.0001, atk: 0, attackSpeed: 0, tenacity: 0 }),
    artRef: "placeholder",
  };
}

// A debuff caster that declares a guaranteed-if-it-fired stun (chance 1) plus a slow.
function stunCaster(): CharacterDef {
  const behavior: TowerBehavior = {
    stun: { duration: 1.2, chance: 1 },
    slow: { pct: 0.2, duration: 1 },
  };
  return {
    id: "stunner",
    name: "Stunner",
    rarity: "Common",
    role: "debuff",
    damageType: "Physical",
    target: "Both",
    cost: 0,
    description: "test",
    passives: ["p"],
    active: "stun-skill",
    behavior,
    // attackSpeed 1 → 1 hit/s; manaOnHit 0 → +10 mana/hit → fills 100 bar in 10 hits.
    baseStats: makeStats({ atk: 1, attackSpeed: 1, range: 400, maxHp: 100, manaOnHit: 0 }),
    artRef: "placeholder",
  };
}

function world() {
  const stage: StageDef = {
    id: "test",
    name: "Test",
    path: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
    airSpawns: [],
    castleHp: 1e9,
    startingGold: 0,
    towerSlots: [{ x: 100, y: -30 }],
    waves: [
      {
        spawns: [
          { enemyId: "wall1", count: 1, interval: 1, delay: 0 },
          { enemyId: "wall2", count: 1, interval: 1, delay: 0 },
          { enemyId: "wall3", count: 1, interval: 1, delay: 0 },
        ],
      },
    ] as WaveDef[],
  };
  return {
    stage,
    catalog: {
      enemies: new Map([
        ["wall1", tankEnemy("wall1")],
        ["wall2", tankEnemy("wall2")],
        ["wall3", tankEnemy("wall3")],
      ]),
      characters: new Map([["stunner", stunCaster()]]),
    },
  };
}

const inertHero = {
  stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }),
  startPos: { x: -500, y: -500 },
};

function fresh(): BattleState {
  const { stage, catalog } = world();
  const b = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
  expect(b.placeTower("stunner", 0)).toBe(true);
  return b;
}

const stunnedCount = (b: BattleState) => b.enemies.filter((e) => e.alive && e.stunTimer > 0).length;

describe("stun is a skill, never an on-hit proc", () => {
  it("does NOT stun while attacking before the mana bar fills (no on-hit stun)", () => {
    const b = fresh();
    // 4s = ~4 hits → mana ~40 (< 100), so no cast has happened yet.
    for (let i = 0; i < 80; i++) b.tick(0.05);
    expect(b.towers[0].mana).toBeLessThan(MANA_MAX);
    expect(stunnedCount(b)).toBe(0);
  });

  it("stuns exactly ONE enemy when the active skill casts", () => {
    const b = fresh();
    let sawCast = false;
    let peakStunned = 0;
    for (let i = 0; i < 400; i++) {
      b.tick(0.05);
      if (b.fx.some((f) => f.type === "cast")) sawCast = true;
      peakStunned = Math.max(peakStunned, stunnedCount(b));
    }
    expect(sawCast).toBe(true);
    // The skill stuns a single target — never the whole AoE cluster.
    expect(peakStunned).toBe(1);
  });
});
