import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import {
  makeStats,
  type AttackDamageType,
  type CharacterDef,
  type EnemyDef,
  type Immunity,
  type StageDef,
  type WaveDef,
} from "../src/data/schema.ts";

// --- Controlled test world -------------------------------------------------

function enemy(over: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id: "grunt",
    name: "Grunt",
    archetype: "Rusher",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 10,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 5, attackSpeed: 1 }),
    artRef: "placeholder",
    ...over,
  };
}

function turret(damageType: AttackDamageType = "Physical", critRate = 0): CharacterDef {
  return {
    id: "turret",
    name: "Turret",
    rarity: "Common",
    role: "damage",
    damageType,
    target: "Both",
    cost: 0,
    description: "test turret",
    passives: ["p"],
    active: null,
    baseStats: makeStats({
      atk: 1000,
      attackSpeed: 5,
      range: 400,
      critRate,
      critDamage: 2,
      maxHp: 100,
    }),
    artRef: "placeholder",
  };
}

function stage(waves: WaveDef[], castleHp: number, startingGold = 0): StageDef {
  return {
    id: "test",
    name: "Test",
    path: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
    airSpawns: [],
    castleHp,
    startingGold,
    towerSlots: [{ x: 100, y: -30 }],
    waves,
  };
}

function world(enemyDef: EnemyDef, char: CharacterDef, waves: WaveDef[], castleHp: number, gold = 0) {
  return {
    stage: stage(waves, castleHp, gold),
    catalog: {
      enemies: new Map([[enemyDef.id, enemyDef]]),
      characters: new Map([[char.id, char]]),
    },
  };
}

// Hero that does nothing (so tests isolate towers/enemies).
const inertHero = {
  stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }),
  startPos: { x: -500, y: -500 },
};

function runUntilDone(b: BattleState, maxSeconds = 80): BattleState {
  const dt = 0.05;
  for (let t = 0; t < maxSeconds / dt && b.outcome === "ongoing"; t++) b.tick(dt);
  return b;
}

const oneWave = (count: number): WaveDef[] => [
  { spawns: [{ enemyId: "grunt", count, interval: 0.5, delay: 0 }] },
];

// --- Tests -----------------------------------------------------------------

describe("BattleState outcomes", () => {
  it("is lost when undefended enemies overwhelm the castle", () => {
    const { stage, catalog } = world(enemy(), turret(), oneWave(5), 3);
    const b = new BattleState(stage, catalog, { hero: inertHero });
    runUntilDone(b);
    expect(b.outcome).toBe("lost");
  });

  it("is won when a strong tower clears every wave", () => {
    const { stage, catalog } = world(enemy(), turret(), oneWave(5), 50);
    const b = new BattleState(stage, catalog, { hero: inertHero });
    expect(b.placeTower("turret", 0)).toBe(true);
    runUntilDone(b);
    expect(b.outcome).toBe("won");
  });

  it("awards bounty gold to the player on each kill", () => {
    const { stage, catalog } = world(enemy({ bounty: 10 }), turret(), oneWave(5), 50, 0);
    const b = new BattleState(stage, catalog, { hero: inertHero });
    b.placeTower("turret", 0);
    runUntilDone(b);
    expect(b.outcome).toBe("won");
    expect(b.gold).toBe(50); // 5 kills * 10 bounty
  });
});

describe("hero → tower stat share", () => {
  it("a placed tower inherits 60% of the hero's stats (atk 1000 base + 0.6*500 hero = 1300)", () => {
    const { stage, catalog } = world(enemy(), turret(), oneWave(1), 50);
    const commander = {
      stats: makeStats({ atk: 500, maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }),
      startPos: { x: -500, y: -500 },
    };
    const b = new BattleState(stage, catalog, { hero: commander });
    expect(b.placeTower("turret", 0)).toBe(true);
    // turretStatPipeline(base=1000, lvl1, ★1) = 1000; + 0.6 * hero.atk(500) = 1300.
    expect(b.towers[0].stats.atk).toBeCloseTo(1300, 5);
  });
});

describe("single-immunity rule", () => {
  const physImmune: Immunity = "Physical";

  it("a Physical tower cannot kill a Physical-immune enemy (castle falls)", () => {
    const { stage, catalog } = world(enemy({ immunity: physImmune }), turret("Physical"), oneWave(2), 1);
    const b = new BattleState(stage, catalog, { hero: inertHero });
    b.placeTower("turret", 0);
    runUntilDone(b);
    expect(b.outcome).toBe("lost");
  });

  it("the same tower clears a non-immune enemy", () => {
    const { stage, catalog } = world(enemy({ immunity: null }), turret("Physical"), oneWave(2), 50);
    const b = new BattleState(stage, catalog, { hero: inertHero });
    b.placeTower("turret", 0);
    runUntilDone(b);
    expect(b.outcome).toBe("won");
  });

  it("True damage from a skill (DoT) bypasses a Physical immunity", () => {
    // Basic attacks are Physical/Magic only; True comes from a skill — here a
    // DoT with a True damageType override, which should ignore the immunity.
    const trueDotter: CharacterDef = {
      id: "dotter",
      name: "True Dotter",
      rarity: "Common",
      role: "dot",
      damageType: "Magic",
      target: "Both",
      cost: 0,
      description: "applies a True-damage DoT",
      passives: ["p"],
      active: null,
      behavior: { dot: { dps: 300, duration: 5, damageType: "True" } },
      baseStats: makeStats({ atk: 1, attackSpeed: 2, range: 400, maxHp: 100 }),
      artRef: "placeholder",
    };
    const { stage, catalog } = world(enemy({ immunity: physImmune }), trueDotter, oneWave(2), 50);
    const b = new BattleState(stage, catalog, { hero: inertHero });
    b.placeTower("dotter", 0);
    runUntilDone(b);
    expect(b.outcome).toBe("won");
  });
});

describe("determinism", () => {
  it("same seed + same inputs => identical result", () => {
    const build = () => {
      const { stage, catalog } = world(enemy(), turret("Physical", 0.5), oneWave(6), 50);
      const b = new BattleState(stage, catalog, { seed: 777, hero: inertHero });
      b.placeTower("turret", 0);
      return b;
    };
    const a = runUntilDone(build());
    const c = runUntilDone(build());
    expect(a.outcome).toBe(c.outcome);
    expect(a.gold).toBe(c.gold);
    expect(a.castleHp).toBeCloseTo(c.castleHp, 6);
    expect(a.time).toBeCloseTo(c.time, 6);
  });
});
