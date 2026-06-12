import { describe, expect, it } from "vitest";
import { makeStats } from "../src/data/schema.ts";
import { enemyTowerAttack } from "../src/core/enemyCombat.ts";
import { MELEE_TOWER_RANGE, RUSHER_BYPASS_SPEED } from "../src/core/battleTypes.ts";
import { weaponBaseRange } from "../src/data/weaponFamily.ts";
import { mkEnemy, mkStage, mkTower, oneWave, runFor, world } from "./fixtures.ts";

describe("enemyTowerAttack profile", () => {
  it("gives an ordinary ground enemy a melee swipe in passing", () => {
    const p = enemyTowerAttack(mkEnemy())!;
    expect(p.range).toBe(MELEE_TOWER_RANGE);
    expect(p.whileMoving).toBe(true);
  });

  it("returns null for a plain flyer (beelines the castle, ignores towers)", () => {
    expect(enemyTowerAttack(mkEnemy({ archetype: "Gargoyle", flying: true }))).toBeNull();
  });

  it("keeps a dedicated tower-killer's tuned range and makes it stop to demolish", () => {
    const p = enemyTowerAttack(mkEnemy({ special: { attacksTowers: { range: 130 } } }))!;
    expect(p.range).toBe(130);
    expect(p.whileMoving).toBe(false);
  });

  it("lets a tower-attacking flyer strike while moving", () => {
    const p = enemyTowerAttack(
      mkEnemy({ flying: true, special: { attacksTowers: { range: 120 } } }),
    )!;
    expect(p.whileMoving).toBe(true);
  });

  it("returns null for a stealthed infiltrator (slips past towers to the castle)", () => {
    expect(
      enemyTowerAttack(mkEnemy({ archetype: "Phantom", special: { stealth: true } })),
    ).toBeNull();
  });

  it("returns null for a high-speed rusher (blows past the lane)", () => {
    expect(
      enemyTowerAttack(mkEnemy({ baseStats: makeStats({ moveSpeed: RUSHER_BYPASS_SPEED }) })),
    ).toBeNull();
  });

  it("still lets a fast DEDICATED tower-killer demolish (authored range wins)", () => {
    const p = enemyTowerAttack(
      mkEnemy({
        baseStats: makeStats({ moveSpeed: 90 }),
        special: { attacksTowers: { range: 110 } },
      }),
    )!;
    expect(p.range).toBe(110);
    expect(p.whileMoving).toBe(false);
  });

  it("derives a ground boss's reach from its weapon and HALTS it to siege the tower", () => {
    const boss = mkEnemy({
      archetype: "Boss",
      weapon: { family: "thrown", display: "magma fists" },
      boss: { enrage: { belowHpPct: 0.4, atkMult: 1.5, speedMult: 1.5 } },
    });
    const p = enemyTowerAttack(boss)!;
    expect(p.range).toBe(weaponBaseRange({ family: "thrown", display: "" }));
    expect(p.whileMoving).toBe(false); // ground boss stops to siege
  });

  it("lets a FLYING boss strike towers in passing (never halts mid-air)", () => {
    const boss = mkEnemy({
      archetype: "Boss",
      flying: true,
      weapon: { family: "thrown", display: "storm bolts" },
      boss: { enrage: { belowHpPct: 0.4, atkMult: 1.5, speedMult: 1.5 } },
    });
    const p = enemyTowerAttack(boss)!;
    expect(p.whileMoving).toBe(true);
  });
});

describe("on-road melee enemies attack towers", () => {
  it("chip a tower hugging the lane while still marching to the castle", () => {
    // Tower planted right at the lane edge (y = -MELEE_TOWER_RANGE+ a hair) so a
    // grunt walking y=0 passes within melee reach.
    const grunt = mkEnemy({
      baseStats: makeStats({ maxHp: 1e6, moveSpeed: 30, atk: 50, attackSpeed: 2 }),
    });
    const fragile = mkTower({
      id: "fragile",
      baseStats: makeStats({ atk: 0, attackSpeed: 0, range: 0, maxHp: 60 }),
    });
    const b = world(
      [grunt],
      [fragile],
      mkStage(oneWave("grunt", 1), { castleHp: 1e6, slots: [{ x: 150, y: -35 }] }),
      {
        hero: { stats: makeStats({ maxHp: 100 }), startPos: { x: -500, y: -500 } },
      },
    );
    expect(b.placeTower("fragile", 0)).toBe(true);
    runFor(b, 12);
    // The tower took damage in passing and was destroyed; the grunt didn't stall
    // (castleHp huge, so it kept walking — the run completes with no tower left).
    expect(b.towers.length).toBe(0);
  });

  it("leave a tower set back from the lane untouched", () => {
    const grunt = mkEnemy({
      baseStats: makeStats({ maxHp: 1e6, moveSpeed: 30, atk: 50, attackSpeed: 2 }),
    });
    const safe = mkTower({
      id: "safe",
      baseStats: makeStats({ atk: 0, attackSpeed: 0, range: 0, maxHp: 60 }),
    });
    // y = -80 is well beyond MELEE_TOWER_RANGE (40) from the lane at y=0.
    const b = world(
      [grunt],
      [safe],
      mkStage(oneWave("grunt", 1), { castleHp: 1e6, slots: [{ x: 150, y: -80 }] }),
      {
        hero: { stats: makeStats({ maxHp: 100 }), startPos: { x: -500, y: -500 } },
      },
    );
    expect(b.placeTower("safe", 0)).toBe(true);
    runFor(b, 12);
    const t = b.towers.find((x) => x.def.id === "safe")!;
    expect(t.hp).toBe(t.stats.maxHp); // never hit
  });
});
