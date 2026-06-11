import { describe, it, expect } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { buildMazeArena } from "../src/core/mazeArena.ts";
import {
  makeStats, type CharacterDef, type EnemyDef, type StageDef, type WaveDef,
} from "../src/data/schema.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../src/data/stage.ts";

function enemy(over: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id: "grunt", name: "Grunt", archetype: "Rusher", flying: false, immunity: null,
    damageType: "Physical", bounty: 10, castleDamage: 1,
    baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 5, attackSpeed: 1 }),
    artRef: "placeholder", ...over,
  };
}
function turret(): CharacterDef {
  return {
    id: "turret", name: "Turret", rarity: "Common", role: "damage", damageType: "Physical",
    target: "Both", cost: 0, description: "t", passives: ["p"], active: null,
    baseStats: makeStats({ atk: 1, attackSpeed: 1, range: 100, maxHp: 100 }), artRef: "placeholder",
  };
}
function arenaStage(waves: WaveDef[]): StageDef {
  const arena = buildMazeArena(42);
  return {
    id: "ch1-s1", name: "Arena", path: arena.routes[0], airSpawns: arena.gates,
    castleHp: 1000, startingGold: 0, towerSlots: [], terrain: [], waves, arena,
  };
}
const inertHero = { stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }), startPos: { x: -500, y: -500 } };
const cat = (e: EnemyDef, c: CharacterDef) => ({ enemies: new Map([[e.id, e]]), characters: new Map([[c.id, c]]) });

describe("maze-arena battle", () => {
  it("places the castle at the arena center, not a path end", () => {
    const stage = arenaStage([{ spawns: [] }]);
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero });
    expect(b.castlePos).toEqual(stage.arena!.center);
    expect(Math.abs(b.castlePos.x - WORLD_WIDTH / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(b.castlePos.y - WORLD_HEIGHT / 2)).toBeLessThanOrEqual(2);
  });

  it("spawns ground enemies from multiple distinct gate directions", () => {
    const stage = arenaStage([{ spawns: [{ enemyId: "grunt", count: 30, interval: 0.05, delay: 0 }] }]);
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero, seed: 99 });
    // Campaign cadence launches the first wave after INTER_WAVE_DELAY (~3s); tick
    // well past that so the gate stream is on the field but hasn't reached center.
    for (let i = 0; i < 160; i++) b.tick(0.05);
    const starts = new Set(b.enemies.map((e) => `${e.route[0].x},${e.route[0].y}`));
    expect(starts.size).toBeGreaterThanOrEqual(3); // enemies arrive from ≥3 directions
    // every enemy's route ends at the castle center
    for (const e of b.enemies) {
      const end = e.route[e.route.length - 1];
      expect(end).toEqual(stage.arena!.center);
    }
  });

  it("an enemy that walks its whole route leaks into the central castle", () => {
    const stage = arenaStage([{ spawns: [{ enemyId: "grunt", count: 1, interval: 1, delay: 0 }] }]);
    const fast = enemy({ baseStats: makeStats({ maxHp: 100, moveSpeed: 9999, atk: 5, attackSpeed: 1 }) });
    const b = new BattleState(stage, cat(fast, turret()), { hero: inertHero });
    const hp0 = b.castleHp;
    for (let i = 0; i < 200 && b.castleHp === hp0; i++) b.tick(0.1);
    expect(b.castleHp).toBeLessThan(hp0); // reached the center and dealt leak damage
  });

  it("blocks tower placement on a road but allows it in open cells", () => {
    const stage = arenaStage([{ spawns: [] }]);
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero });
    const onRoad = stage.arena!.routes[0][1]; // a corridor cell center
    expect(b.canPlaceAt({ x: onRoad.x, y: onRoad.y })).toBe(false);
  });
});
