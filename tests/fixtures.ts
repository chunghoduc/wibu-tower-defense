/**
 * Shared test fixtures: compact builders for controlled battle worlds so each
 * test can assemble exactly the enemies, towers, and stage it needs.
 */
import { BattleState, type BattleOptions } from "../src/core/battle.ts";
import {
  makeStats,
  type CharacterDef,
  type EnemyDef,
  type StageDef,
  type Vec2,
  type WaveDef,
} from "../src/data/schema.ts";

export function mkEnemy(over: Partial<EnemyDef> = {}): EnemyDef {
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

export function mkTower(over: Partial<CharacterDef> = {}): CharacterDef {
  return {
    id: "turret",
    name: "Turret",
    rarity: "Common",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 0,
    description: "test tower",
    passives: ["p"],
    active: null,
    baseStats: makeStats({ atk: 1000, attackSpeed: 5, range: 400, maxHp: 100 }),
    artRef: "placeholder",
    ...over,
  };
}

export interface StageOpts {
  castleHp?: number;
  startingGold?: number;
  slots?: Vec2[];
  path?: Vec2[];
}

export function mkStage(waves: WaveDef[], o: StageOpts = {}): StageDef {
  return {
    id: "test",
    name: "Test",
    path: o.path ?? [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ],
    airSpawns: [],
    castleHp: o.castleHp ?? 50,
    startingGold: o.startingGold ?? 0,
    towerSlots: o.slots ?? [{ x: 150, y: -30 }],
    waves,
  };
}

export function world(
  enemies: EnemyDef[],
  characters: CharacterDef[],
  stage: StageDef,
  opts: Partial<BattleOptions> = {},
): BattleState {
  return new BattleState(
    stage,
    {
      enemies: new Map(enemies.map((e) => [e.id, e])),
      characters: new Map(characters.map((c) => [c.id, c])),
    },
    {
      seed: opts.seed ?? 1,
      difficulty: opts.difficulty ?? "Normal",
      eliteChance: opts.eliteChance ?? 0,
      endless: opts.endless ?? false,
      bossRush: opts.bossRush ?? false,
      endlessMul: opts.endlessMul,
      hero: opts.hero ?? {
        stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }),
        startPos: { x: -500, y: -500 },
      },
    },
  );
}

export const oneWave = (enemyId: string, count: number, interval = 0.5): WaveDef[] => [
  { spawns: [{ enemyId, count, interval, delay: 0 }] },
];

/** Tick until the battle resolves (or a time cap), returning ticks elapsed. */
export function runUntilDone(b: BattleState, maxSeconds = 90, dt = 0.05): number {
  let n = 0;
  for (; n < maxSeconds / dt && b.outcome === "ongoing"; n++) b.tick(dt);
  return n;
}

/** Tick for a fixed duration regardless of outcome. */
export function runFor(b: BattleState, seconds: number, dt = 0.05): void {
  for (let t = 0; t < seconds / dt; t++) b.tick(dt);
}
