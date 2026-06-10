import { describe, expect, it } from "vitest";
import { BattleState, MANA_MAX, MANA_PER_HIT, manaGainOnHit } from "../src/core/battle.ts";
import {
  makeStats,
  type CharacterDef,
  type EnemyDef,
  type StageDef,
  type TowerRole,
  type WaveDef,
} from "../src/data/schema.ts";

// A near-immortal, near-stationary enemy so attacks keep landing without kills —
// isolating on-hit mana charging from the on-kill bonus.
function tankEnemy(): EnemyDef {
  return {
    id: "wall", name: "Wall", archetype: "Rusher", flying: false, immunity: null,
    damageType: "Physical", bounty: 10, castleDamage: 1,
    baseStats: makeStats({ maxHp: 1e9, moveSpeed: 1, atk: 0, attackSpeed: 0 }),
    artRef: "placeholder",
  };
}

function caster(role: TowerRole, active: string | null): CharacterDef {
  return {
    id: "caster", name: "Caster", rarity: "Common", role, damageType: "Physical",
    target: "Both", cost: 0, description: "test", passives: ["p"], active,
    baseStats: makeStats({ atk: 1, attackSpeed: 10, range: 400, maxHp: 100 }),
    artRef: "placeholder",
  };
}

function world(char: CharacterDef) {
  const stage: StageDef = {
    id: "test", name: "Test",
    path: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
    airSpawns: [], castleHp: 1e9, startingGold: 0,
    towerSlots: [{ x: 100, y: -30 }],
    waves: [{ spawns: [{ enemyId: "wall", count: 1, interval: 1, delay: 0 }] }] as WaveDef[],
  };
  return {
    stage,
    catalog: {
      enemies: new Map([["wall", tankEnemy()]]),
      characters: new Map([[char.id, char]]),
    },
  };
}

const inertHero = {
  stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }),
  startPos: { x: -500, y: -500 },
};

/** Tick `seconds`, returning how many active-skill casts the tower emitted. */
function runCountingCasts(b: BattleState, seconds: number): number {
  const dt = 0.05;
  let casts = 0;
  for (let t = 0; t < seconds / dt; t++) {
    b.tick(dt);
    for (const fx of b.fx) if (fx.type === "cast") casts++;
  }
  return casts;
}

describe("manaGainOnHit", () => {
  it("is the flat base with no bonus", () => {
    expect(manaGainOnHit(makeStats({}))).toBe(MANA_PER_HIT);
    expect(MANA_PER_HIT).toBe(10);
  });

  it("adds the manaOnHit bonus on top of the base", () => {
    expect(manaGainOnHit(makeStats({ manaOnHit: 5 }))).toBe(15);
  });

  it("clamps the manaOnHit bonus to 15 (so per-hit gain caps at 25)", () => {
    expect(manaGainOnHit(makeStats({ manaOnHit: 100 }))).toBe(MANA_PER_HIT + 15);
    expect(manaGainOnHit(makeStats({ manaOnHit: 100 }))).toBe(25);
  });

  it("never goes below the base for negative bonuses", () => {
    expect(manaGainOnHit(makeStats({ manaOnHit: -50 }))).toBe(MANA_PER_HIT);
  });
});

describe("mana charge bar in battle", () => {
  it("a non-support tower charges on hit and casts when the 100 bar fills", () => {
    const { stage, catalog } = world(caster("damage", "burst"));
    const b = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
    expect(b.placeTower("caster", 0)).toBe(true);
    const casts = runCountingCasts(b, 8);
    expect(casts).toBeGreaterThan(0);
    // The bar is bounded — it resets on cast and never overflows MANA_MAX.
    expect(b.towers[0].mana).toBeGreaterThanOrEqual(0);
    expect(b.towers[0].mana).toBeLessThanOrEqual(MANA_MAX);
  });

  it("a support tower is aura-only: it never charges mana or casts", () => {
    const { stage, catalog } = world(caster("support", null));
    const b = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
    expect(b.placeTower("caster", 0)).toBe(true);
    const casts = runCountingCasts(b, 8);
    expect(casts).toBe(0);
    expect(b.towers[0].mana).toBe(0);
  });
});
