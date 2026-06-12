import { describe, expect, it } from "vitest";
import { applyEliteBoost, rollEliteImmunity, ELITE_DAMAGE_REDUCTION } from "../src/core/elite.ts";
import { defaultStats, makeStats } from "../src/data/schema.ts";
import { Rng } from "../src/core/rng.ts";
import { mkEnemy, mkStage, mkTower, world, runFor } from "./fixtures.ts";

describe("elite damage reduction", () => {
  it("applyEliteBoost grants a flat 50% reduction, combined with any existing one", () => {
    expect(applyEliteBoost({ ...defaultStats() }).damageReduction).toBeCloseTo(
      ELITE_DAMAGE_REDUCTION,
    );
    // 0.5 base combined with 0.5 elite → 1 - 0.5*0.5 = 0.75.
    expect(
      applyEliteBoost({ ...defaultStats(), damageReduction: 0.5 }).damageReduction,
    ).toBeCloseTo(0.75);
  });

  it("rollEliteImmunity yields both Physical and Magic over many rolls", () => {
    const rng = new Rng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(rollEliteImmunity(rng));
    expect(seen.has("Physical")).toBe(true);
    expect(seen.has("Magic")).toBe(true);
  });
});

describe("elite per-battle gating", () => {
  // A wave of plain grunts; a big castle so they linger long enough to count.
  const grunt = mkEnemy({
    baseStats: makeStats({ maxHp: 1e6, moveSpeed: 50, atk: 0, attackSpeed: 0 }),
  });
  const sixGrunts = [{ spawns: [{ enemyId: "grunt", count: 6, interval: 0.4, delay: 0 }] }];

  it("spawns at most ONE elite when the battle is fated to have one", () => {
    const b = world([grunt], [], mkStage(sixGrunts, { castleHp: 1e9 }), { eliteChance: 1 });
    runFor(b, 5.5); // wave starts after the 3s inter-wave delay; all six out, none at the castle yet
    const elites = b.enemies.filter((e) => e.elite);
    expect(elites).toHaveLength(1);
    // The elite gains a damage-type immunity and the flat 50% reduction.
    const elite = elites[0];
    expect(["Physical", "Magic"]).toContain(elite.eliteImmunity);
    expect(elite.stats.damageReduction).toBeGreaterThanOrEqual(ELITE_DAMAGE_REDUCTION);
  });

  it("spawns no elite when the per-battle roll fails", () => {
    const b = world([grunt], [], mkStage(sixGrunts, { castleHp: 1e9 }), { eliteChance: 0 });
    runFor(b, 5.5);
    expect(b.enemies.some((e) => e.elite)).toBe(false);
  });
});

describe("support enemy aura in battle", () => {
  it("a Hexer near a tower slows its attack speed (negative buff)", () => {
    const hexer = mkEnemy({
      id: "hexer",
      archetype: "Hexer",
      baseStats: makeStats({ maxHp: 1e6, moveSpeed: 0, atk: 0, attackSpeed: 0 }),
      special: { supportAura: { radius: 200, towerAttackSpeedMult: 0.75 } },
    });
    const stage = mkStage([{ spawns: [{ enemyId: "hexer", count: 1, interval: 1, delay: 0 }] }], {
      castleHp: 1e9,
      path: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      slots: [{ x: 20, y: 0 }],
    });
    const tower = mkTower({
      id: "turret",
      baseStats: makeStats({ atk: 0, attackSpeed: 1, range: 0, maxHp: 100 }),
    });
    const b = world([hexer], [tower], stage);
    b.placeTower("turret", 0);
    runFor(b, 3.5); // wave starts after the 3s inter-wave delay, then the hexer is in range
    expect(b.towers[0].buffAsPct).toBeCloseTo(-0.25);
  });
});
