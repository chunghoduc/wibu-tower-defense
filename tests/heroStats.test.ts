import { describe, expect, it } from "vitest";
import { resolveHeroBattleStats } from "../src/core/heroStats.ts";
import { addHeroShare, HERO_TOWER_SHARE } from "../src/core/stats.ts";
import { createFreshSave, type HeroSave, type ItemInstanceSave } from "../src/core/save.ts";
import { makeStats, type RolledAffix } from "../src/data/schema.ts";

/** A clean base for exact hand-computation (makeStats fills the rest with defaults). */
const BASE = makeStats({ atk: 100, maxHp: 1000, critRate: 0 });

function inst(over: Partial<ItemInstanceSave> & { defId: string; id: string }): ItemInstanceSave {
  return { acquiredLevel: 1, enhanceLevel: 0, rolledStats: {}, rolledPrimaryAffix: 0, rolledAffixes: [], ...over };
}

/** Equip a single item instance into its slot on a fresh save. */
function withItem(slot: string, item: ItemInstanceSave): HeroSave {
  const s = createFreshSave();
  s.inventory.items = [item];
  s.inventory.equipped = { [slot]: item.id } as HeroSave["inventory"]["equipped"];
  return s;
}

describe("resolveHeroBattleStats — items + passives + jewels add up to hero stats", () => {
  it("no gear at level 1 returns the base unchanged", () => {
    expect(resolveHeroBattleStats(createFreshSave(), BASE).stats.atk).toBeCloseTo(100, 6);
  });

  it("an item's base stat adds FLAT (atk 100 + item atk 20 = 120)", () => {
    const s = withItem("Weapon", inst({ id: "w", defId: "iron-sword", rolledStats: { atk: 20 } }));
    expect(resolveHeroBattleStats(s, BASE).stats.atk).toBeCloseTo(120, 5);
  });

  it("a physicalDamage primary affix applies as INCREASED% (atk 100 ×1.10 = 110)", () => {
    const s = withItem("Weapon", inst({ id: "w", defId: "iron-sword", rolledPrimaryAffix: 0.10 }));
    expect(resolveHeroBattleStats(s, BASE).stats.atk).toBeCloseTo(110, 5);
  });

  it("a fractional affix (critRate) adds FLAT (0 + 0.05 = 0.05)", () => {
    const affixes: RolledAffix[] = [{ type: "critRate", value: 0.05 }];
    const s = withItem("Gloves", inst({ id: "g", defId: "worn-gloves", rolledAffixes: affixes }));
    expect(resolveHeroBattleStats(s, BASE).stats.critRate).toBeCloseTo(0.05, 6);
  });

  it("an enhanced item scales its base stat by the enhance bonus before adding", () => {
    // +5 enhance = ×(1 + 0.08*5) = ×1.40 → item atk 20 → 28; hero atk 100+28 = 128.
    const s = withItem("Weapon", inst({ id: "w", defId: "iron-sword", rolledStats: { atk: 20 }, enhanceLevel: 5 }));
    expect(resolveHeroBattleStats(s, BASE).stats.atk).toBeCloseTo(128, 5);
  });

  it("a passive node's increased% applies (Brutality +12% atk → 112; +8% crit flat)", () => {
    const s = createFreshSave();
    s.hero.unlockedNodes = ["brawler-notable-1"]; // Brutality: +12% atk, +8% critRate
    const out = resolveHeroBattleStats(s, BASE).stats;
    expect(out.atk).toBeCloseTo(112, 5);
    expect(out.critRate).toBeCloseTo(0.08, 6);
  });

  it("a socketed jewel in an ALLOCATED socket applies (+8% atk → 108)", () => {
    const s = createFreshSave();
    s.hero.unlockedNodes = ["brawler-jewel-1"];
    s.hero.jewels = [{ id: "j", defId: "crimson-shard" }];
    s.hero.socketedJewels = { "brawler-jewel-1": "j" };
    expect(resolveHeroBattleStats(s, BASE).stats.atk).toBeCloseTo(108, 5);
  });

  it("item flat, passive % and jewel % compose per the pipeline formula", () => {
    // (base 100 + item 20) × (1 + 0.12 passive + 0.08 jewel) = 120 × 1.20 = 144.
    const s = createFreshSave();
    s.inventory.items = [inst({ id: "w", defId: "iron-sword", rolledStats: { atk: 20 } })];
    s.inventory.equipped = { Weapon: "w" };
    s.hero.unlockedNodes = ["brawler-notable-1", "brawler-jewel-1"];
    s.hero.jewels = [{ id: "j", defId: "crimson-shard" }];
    s.hero.socketedJewels = { "brawler-jewel-1": "j" };
    expect(resolveHeroBattleStats(s, BASE).stats.atk).toBeCloseTo(144, 4);
  });

  it("level scaling adds flat atk per level (level 50 → +98 → 198)", () => {
    const s = createFreshSave();
    s.hero.level = 50;
    expect(resolveHeroBattleStats(s, BASE).stats.atk).toBeCloseTo(198, 5);
  });

  it("reports a pet's gold/sec utility", () => {
    const s = withItem("Pet", inst({ id: "p", defId: "coin-sprite" }));
    expect(resolveHeroBattleStats(s, BASE).petGoldPerSec).toBeGreaterThan(0);
  });
});

describe("hero stats add up to tower stats (the 60% share)", () => {
  it("an item that adds +100 hero atk reaches a commanded tower at 60% (+60)", () => {
    const bare = resolveHeroBattleStats(createFreshSave(), BASE).stats;
    const geared = resolveHeroBattleStats(
      withItem("Weapon", inst({ id: "w", defId: "iron-sword", rolledStats: { atk: 100 } })),
      BASE,
    ).stats;
    expect(geared.atk - bare.atk).toBeCloseTo(100, 5); // item → hero: +100

    const towerBase = makeStats({ atk: 500 });
    const reachedTower = addHeroShare(towerBase, geared).atk - addHeroShare(towerBase, bare).atk;
    expect(reachedTower).toBeCloseTo(100 * HERO_TOWER_SHARE, 5); // hero → tower: +60
  });
});
