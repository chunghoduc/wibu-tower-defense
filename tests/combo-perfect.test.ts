import { describe, expect, it } from "vitest";
import { BattleState, COMBO_MAX_MULT, type FxEvent } from "../src/core/battle.ts";
import { makeStats, type CharacterDef, type EnemyDef, type StageDef, type WaveDef } from "../src/data/schema.ts";

function enemy(over: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id: "grunt", name: "Grunt", archetype: "Rusher", flying: false, immunity: null,
    damageType: "Physical", bounty: 10, castleDamage: 1,
    baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 5, attackSpeed: 1, armor: 10, magicResist: 10 }),
    artRef: "placeholder", ...over,
  };
}
function turret(): CharacterDef {
  return {
    id: "turret", name: "Turret", rarity: "Common", role: "damage", damageType: "Physical",
    target: "Both", cost: 10, description: "t", passives: ["p"], active: null,
    baseStats: makeStats({ atk: 100000, attackSpeed: 10, range: 9999, maxHp: 100 }), artRef: "placeholder",
  };
}
function stage(waves: WaveDef[], castleHp: number, startingGold = 0): StageDef {
  return {
    id: "test", name: "Test", path: [{ x: 0, y: 0 }, { x: 200, y: 0 }], airSpawns: [],
    castleHp, startingGold, towerSlots: [{ x: 100, y: -30 }], waves,
  };
}
function world(e: EnemyDef, c: CharacterDef, waves: WaveDef[], castleHp: number, gold = 0) {
  return { stage: stage(waves, castleHp, gold), catalog: { enemies: new Map([[e.id, e]]), characters: new Map([[c.id, c]]) } };
}
const inertHero = { stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }), startPos: { x: -500, y: -500 } };
const oneWave = (n: number): WaveDef[] => [{ spawns: [{ enemyId: "grunt", count: n, interval: 0.05, delay: 0 }] }];

function run(b: BattleState, fxSink?: FxEvent[], maxSeconds = 60) {
  const dt = 0.05;
  for (let t = 0; t < maxSeconds / dt && b.outcome === "ongoing"; t++) {
    b.tick(dt);
    if (fxSink) fxSink.push(...b.fx);
  }
}

describe("F13 combo multiplier", () => {
  it("comboMult ramps from 1 toward COMBO_MAX_MULT and emits combo fx", () => {
    const { stage, catalog } = world(enemy(), turret(), oneWave(30), 9999, 100);
    const b = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
    expect(b.placeTower("turret", 0)).toBe(true);
    const fx: FxEvent[] = [];
    run(b, fx);
    expect(b.outcome).toBe("won");
    // Killing 30 in a streak should bank far more than flat bounty (minus the 10 spent).
    expect(b.gold).toBeGreaterThan(30 * 10);
    expect(fx.some((e) => e.type === "combo")).toBe(true);
    const maxComboMult = Math.max(...fx.filter((e): e is Extract<FxEvent, { type: "combo" }> => e.type === "combo").map((e) => e.mult));
    expect(maxComboMult).toBeGreaterThan(1);
    expect(maxComboMult).toBeLessThanOrEqual(COMBO_MAX_MULT);
  });
});

describe("F14 perfect wave", () => {
  it("emits a perfect event + bonus when no enemy leaks", () => {
    const { stage, catalog } = world(enemy(), turret(), oneWave(5), 9999, 100);
    const b = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
    expect(b.placeTower("turret", 0)).toBe(true);
    const fx: FxEvent[] = [];
    run(b, fx);
    const perfect = fx.find((e): e is Extract<FxEvent, { type: "perfect" }> => e.type === "perfect");
    expect(perfect).toBeDefined();
    expect(perfect!.bonus).toBeGreaterThan(0);
    expect(b.wasFlawless()).toBe(true);
  });

  it("no perfect bonus when an enemy leaks (undefended)", () => {
    const { stage, catalog } = world(enemy(), turret(), oneWave(5), 9999, 0);
    const b = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
    // Don't place a tower → enemies leak to the (huge-HP) castle.
    const fx: FxEvent[] = [];
    run(b, fx, 30);
    expect(fx.some((e) => e.type === "perfect" && e.bonus > 0)).toBe(false);
    expect(b.wasFlawless()).toBe(false);
  });
});

describe("F5 challenge modifiers in battle", () => {
  it("enemyHpMul makes enemies tankier; towerCostMul discounts placement", () => {
    const { stage, catalog } = world(enemy(), turret(), oneWave(1), 9999, 100);
    const plain = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
    const buffed = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0, challenge: { enemyHpMul: 2, towerCostMul: 0.5 } });
    // Advance past the 3s inter-wave delay so the first enemy has spawned.
    for (let i = 0; i < 70; i++) { plain.tick(0.05); buffed.tick(0.05); }
    const plainHp = plain.enemies[0].stats.maxHp;
    const buffedHp = buffed.enemies[0].stats.maxHp;
    expect(buffedHp).toBeCloseTo(plainHp * 2, 3);
    // Tower cost halved: 10 → 5.
    expect(buffed.towerCost(turret())).toBe(5);
    expect(plain.towerCost(turret())).toBe(10);
  });
});
