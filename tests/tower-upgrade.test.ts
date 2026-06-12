import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { loadCatalog } from "../src/data/catalog.ts";
import { STAGE_1, defaultHeroStats } from "../src/data/stage.ts";

function battle() {
  return new BattleState(STAGE_1, loadCatalog(), {
    seed: 1,
    hero: { stats: defaultHeroStats(), startPos: { x: 480, y: 270 }, damageType: "Physical" },
  });
}

describe("tower upgrade / sell", () => {
  it("upgradeTower raises battleLevel + stats and deducts gold", () => {
    const b = battle();
    b.placeTower("zoran-thricedraw", 0);
    const t = b.towers[0];
    b.gold = 1000;
    const atk0 = t.stats.atk,
      hp0 = t.stats.maxHp,
      goldBefore = b.gold;
    const cost = b.upgradeCost(t.uid);
    expect(cost).toBeGreaterThan(0);
    expect(b.upgradeTower(t.uid)).toBe(true);
    expect(t.battleLevel).toBe(1);
    expect(t.stats.atk).toBeGreaterThan(atk0);
    expect(t.stats.maxHp).toBeGreaterThan(hp0);
    expect(b.gold).toBe(goldBefore - cost);
  });

  it("upgrade preserves the tower's HP fraction", () => {
    const b = battle();
    b.placeTower("zoran-thricedraw", 0);
    const t = b.towers[0];
    b.gold = 1000;
    t.hp = t.stats.maxHp * 0.5;
    b.upgradeTower(t.uid);
    expect(t.hp / t.stats.maxHp).toBeCloseTo(0.5, 1);
  });

  it("upgrade fails without enough gold", () => {
    const b = battle();
    b.placeTower("zoran-thricedraw", 0);
    const t = b.towers[0];
    b.gold = 0;
    expect(b.upgradeTower(t.uid)).toBe(false);
    expect(t.battleLevel).toBe(0);
  });

  it("previewUpgradeRange returns the range the tower will have after one upgrade", () => {
    const b = battle();
    b.placeTower("zoran-thricedraw", 0);
    const t = b.towers[0];
    b.gold = 10000;
    const preview = b.previewUpgradeRange(t.uid);
    expect(preview).not.toBeNull();
    b.upgradeTower(t.uid);
    expect(t.stats.range).toBeCloseTo(preview!, 5);
  });

  it("previewUpgradeRange is null when the tower is maxed", () => {
    const b = battle();
    b.placeTower("zoran-thricedraw", 0);
    const t = b.towers[0];
    b.gold = 1e9;
    while (b.upgradeCost(t.uid) > 0) b.upgradeTower(t.uid);
    expect(b.previewUpgradeRange(t.uid)).toBeNull();
  });

  it("previewUpgradeRange is null for an unknown tower", () => {
    expect(battle().previewUpgradeRange(9999)).toBeNull();
  });

  it("sellTower refunds gold and removes the tower", () => {
    const b = battle();
    b.placeTower("zoran-thricedraw", 0);
    const t = b.towers[0];
    const refund = b.sellValue(t.uid);
    const goldBefore = b.gold;
    expect(refund).toBeGreaterThan(0);
    expect(b.sellTower(t.uid)).toBe(refund);
    expect(b.gold).toBe(goldBefore + refund);
    expect(b.towers.some((x) => x.uid === t.uid)).toBe(false);
  });
});
