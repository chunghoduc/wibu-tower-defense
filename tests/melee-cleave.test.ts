/**
 * Melee cleave: melee-style towers (slash/flurry/punch/smash) trade reach for a
 * wide swing — every basic attack strikes ALL enemies within their short range
 * for the same damage, while ranged towers stay single-target.
 */
import { describe, expect, it } from "vitest";
import { isMeleeStyle, attackStyleFor } from "../src/data/attackStyle.ts";
import { TOWERS } from "../src/data/towers.ts";
import { makeStats } from "../src/data/schema.ts";
import { mkEnemy, mkTower, mkStage, world, runFor } from "./fixtures.ts";

const inertHero = {
  stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }),
  startPos: { x: -500, y: -500 },
};

// Two stationary grunts stacked at the path origin, a tower right next to them.
function stackedWorld(towerOver = {}) {
  const grunt = mkEnemy({ baseStats: makeStats({ maxHp: 5000, moveSpeed: 0, atk: 0 }) });
  const tower = mkTower({
    baseStats: makeStats({ atk: 50, attackSpeed: 4, range: 90, maxHp: 100 }),
    ...towerOver,
  });
  const stage = mkStage([{ spawns: [{ enemyId: "grunt", count: 2, interval: 0, delay: 0 }] }], {
    castleHp: 1e9,
    path: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ],
    slots: [{ x: 40, y: 0 }],
  });
  const b = world([grunt], [tower], stage, { hero: inertHero });
  return b;
}

describe("melee cleave", () => {
  it("classifies the hand-to-hand swing styles as melee (and hex/ranged as not)", () => {
    expect(isMeleeStyle("slash")).toBe(true);
    expect(isMeleeStyle("flurry")).toBe(true);
    expect(isMeleeStyle("punch")).toBe(true);
    expect(isMeleeStyle("smash")).toBe(true);
    expect(isMeleeStyle("hex")).toBe(false);
    expect(isMeleeStyle("arrow")).toBe(false);
    expect(isMeleeStyle("arcane")).toBe(false);
  });

  it("a melee tower's swing damages every enemy in range, not just the target", () => {
    // Fists at short reach → "punch" → melee → cleaves.
    const b = stackedWorld({ meta: { weapon: "iron fists" } });
    b.placeTower("turret", 0);
    runFor(b, 5);
    const [a, c] = b.enemies;
    expect(a.hp).toBeLessThan(a.stats.maxHp);
    expect(c.hp).toBeLessThan(c.stats.maxHp);
    // Both stacked at the same spot took the SAME total damage (equal cleave).
    expect(a.hp).toBeCloseTo(c.hp);
  });

  it("a ranged tower stays single-target — only one stacked enemy is hit", () => {
    // No weapon keyword + long reach → "arrow" → ranged → no cleave.
    const b = stackedWorld({
      baseStats: makeStats({ atk: 50, attackSpeed: 4, range: 400, maxHp: 100 }),
    });
    b.placeTower("turret", 0);
    runFor(b, 5);
    const hits = b.enemies.filter((e) => e.hp < e.stats.maxHp).length;
    expect(hits).toBe(1);
  });

  it("every melee-style tower in the catalog has a genuinely low (melee) reach", () => {
    for (const def of TOWERS) {
      if (!isMeleeStyle(attackStyleFor(def))) continue;
      expect(def.baseStats.range, `${def.id} reach`).toBeLessThanOrEqual(100);
    }
  });

  it("most melee-style towers deal Physical damage", () => {
    const melee = TOWERS.filter((d) => isMeleeStyle(attackStyleFor(d)));
    const physical = melee.filter((d) => d.damageType === "Physical").length;
    expect(physical).toBeGreaterThan(melee.length / 2);
  });
});
