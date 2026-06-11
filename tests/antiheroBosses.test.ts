import { describe, expect, it } from "vitest";
import { world, mkTower, mkStage, runFor } from "./fixtures.ts";
import { ENEMIES, castleLeakDamage, BOSS_CASTLE_DAMAGE } from "../src/data/enemies.ts";
import { ANTIHERO_BOSSES } from "../src/data/enemiesAntiheroes.ts";
import { validateEnemy } from "../src/data/schema.ts";
import { SPRITE_MANIFEST } from "../src/data/spriteManifest.ts";

const IDS = [
  "gravemourn", "vindicator", "sundermark", "crownfall", "unkilling",
  "mawborn", "devourer", "crimsonlord", "fallenward", "ashghost",
];
const byId = (id: string) => ENEMIES.find((e) => e.id === id)!;

describe("Antihero Gallery — catalog integrity", () => {
  it("exports exactly the 10 new bosses", () => {
    expect(ANTIHERO_BOSSES.map((b) => b.id).sort()).toEqual([...IDS].sort());
  });
  it("all 10 are wired into ENEMIES and pass schema validation", () => {
    for (const id of IDS) {
      const def = byId(id);
      expect(def, id).toBeDefined();
      expect(() => validateEnemy(def)).not.toThrow();
    }
  });
  it("all are archetype Boss, never immune, and leak for the flat boss castle damage", () => {
    for (const id of IDS) {
      const def = byId(id);
      expect(def.archetype, id).toBe("Boss");
      expect(def.immunity, id).toBeNull();          // bosses must always be answerable
      expect(castleLeakDamage(def), id).toBe(BOSS_CASTLE_DAMAGE);
    }
  });
  it("each boss has a boss__<id> sprite-manifest entry (so it renders)", () => {
    const keys = new Set(SPRITE_MANIFEST.map((m: { key: string }) => m.key));
    for (const id of IDS) expect(keys.has(`boss__${id}`), id).toBe(true);
  });
  it("carries each boss's designed signature mechanic", () => {
    expect(byId("gravemourn").boss?.enrage).toBeDefined();
    expect(byId("gravemourn").special?.frenzy).toBeDefined();   // double sub-50% spike
    expect(byId("vindicator").special?.attacksTowers?.range).toBeGreaterThanOrEqual(160); // outranges the line
    expect(byId("sundermark").boss?.towerDisable).toBeDefined();
    expect(byId("crownfall").boss?.enrage?.atkMult).toBeGreaterThanOrEqual(1.9);
    expect(byId("crownfall").boss?.skill?.type).toBe("barrier");
    expect(byId("unkilling").baseStats.hpRegen).toBeGreaterThanOrEqual(40);
    expect(byId("unkilling").special?.frenzy).toBeDefined();
    expect(byId("mawborn").special?.splitInto).toBeDefined();
    expect(byId("devourer").boss?.summon?.enemyId).toBe("brute");
    expect(byId("crimsonlord").boss?.skill?.type).toBe("rally");
    expect(byId("fallenward").boss?.towerDisable?.duration).toBeGreaterThanOrEqual(3);
    expect(byId("ashghost").boss?.enrage).toBeDefined();
    expect(byId("ashghost").boss?.summon).toBeDefined();
    expect(byId("ashghost").boss?.towerDisable).toBeDefined();
    expect(byId("ashghost").boss?.skill?.type).toBe("quake");
  });
});

describe("Antihero Gallery — mechanics fire in-sim (smoke)", () => {
  // Drop the real catalog boss + a sturdy tower into a long lane and tick. Asserts
  // no throw and that summon/disable mechanics land.
  function bossWorld(bossId: string) {
    const boss = byId(bossId), imp = byId("imp"), brute = byId("brute");
    const tower = mkTower({ baseStats: { ...mkTower().baseStats, atk: 20, attackSpeed: 2, range: 9999, maxHp: 1e9 } });
    const stage = mkStage([{ spawns: [{ enemyId: bossId, count: 1, interval: 1, delay: 0 }] }],
      { slots: [{ x: 60, y: 0 }], path: [{ x: 0, y: 0 }, { x: 6000, y: 0 }] });
    const b = world([boss, imp, brute], [tower], stage, { seed: 7 });
    b.placeTower("turret", 0);
    return b;
  }

  it("every boss ticks for 12s without throwing", () => {
    for (const id of IDS) {
      const b = bossWorld(id);
      expect(() => runFor(b, 12)).not.toThrow();
    }
  });
  it("devourer summons brute adds", () => {
    const b = bossWorld("devourer");
    runFor(b, 12); // summon interval 9s → at least one wave of adds
    expect(b.enemies.some((e) => e.def.id === "brute")).toBe(true);
  });
  it("sundermark disables a nearby tower", () => {
    // Pin the boss in place (moveSpeed 0) so its disable pulse geometry is
    // deterministic — otherwise it walks out of its own radius before the timer fires.
    const sunder = { ...byId("sundermark"), baseStats: { ...byId("sundermark").baseStats, moveSpeed: 0 } };
    const tower = mkTower({ baseStats: { ...mkTower().baseStats, atk: 1, attackSpeed: 1, range: 9999, maxHp: 1e9 } });
    const stage = mkStage([{ spawns: [{ enemyId: "sundermark", count: 1, interval: 1, delay: 0 }] }],
      { slots: [{ x: 30, y: 0 }], path: [{ x: 0, y: 0 }, { x: 50, y: 0 }] });
    const b = world([sunder], [tower], stage, { seed: 7 });
    b.placeTower("turret", 0);
    runFor(b, 11); // towerDisable interval 9s + spawn delay
    expect(b.towers[0].disabledTimer).toBeGreaterThan(0);
  });
});
