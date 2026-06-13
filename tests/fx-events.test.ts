import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { loadCatalog } from "../src/data/catalog.ts";
import { STAGE_1, defaultHeroStats } from "../src/data/stage.ts";

function freshBattle() {
  return new BattleState(STAGE_1, loadCatalog(), {
    seed: 7,
    hero: { stats: defaultHeroStats(), startPos: { x: 480, y: 270 }, damageType: "Physical" },
  });
}

describe("FX events", () => {
  it("exposes an fx array that starts empty", () => {
    const b = freshBattle();
    expect(Array.isArray(b.fx)).toBe(true);
    expect(b.fx.length).toBe(0);
  });

  it("emits attack + hit events when a tower fires at an enemy", () => {
    const b = freshBattle();
    // place a strong tower near the lane start and tick until it attacks something
    const towerId = b["cat"] ? null : null; // placeholder; use catalog tower
    // Use a known catalog tower id
    b.placeTower("zoran-thricedraw", 0);
    let sawAttack = false,
      sawHit = false;
    for (let i = 0; i < 600 && !(sawAttack && sawHit); i++) {
      b.tick(0.05);
      if (b.fx.some((e) => e.type === "attack")) sawAttack = true;
      if (b.fx.some((e) => e.type === "hit")) sawHit = true;
    }
    expect(sawAttack).toBe(true);
    expect(sawHit).toBe(true);
    void towerId;
  });

  it("clears fx at the start of each tick (one tick of events at a time)", () => {
    const b = freshBattle();
    b.placeTower("zoran-thricedraw", 0);
    // advance a bunch; fx should never grow unbounded
    let maxLen = 0;
    for (let i = 0; i < 300; i++) {
      b.tick(0.05);
      maxLen = Math.max(maxLen, b.fx.length);
    }
    expect(maxLen).toBeLessThan(500);
  });

  it("clears stale fx once the battle is over (no replayed gain effects)", () => {
    // Regression: tick() used to early-return on a finished battle BEFORE clearing
    // fx, so the final kill's killReward/loot events lingered in battle.fx. The
    // render loop kept re-pushing them every frame → a non-stop +XP/gold gain
    // shower on the victory screen. A no-op tick must leave fx empty.
    const b = freshBattle();
    b.outcome = "won";
    b.fx.push({ type: "loot", at: { x: 0, y: 0 }, to: { x: 0, y: 0 }, gold: 99 });
    b.tick(0.05);
    expect(b.fx.length).toBe(0);
  });

  it("emits a death event (and loot) when an enemy dies", () => {
    const b = freshBattle();
    b.placeTower("zoran-thricedraw", 0);
    b.placeTower("iron-bo-cannonarm", 1);
    let sawDeath = false,
      sawLoot = false;
    for (let i = 0; i < 1500 && !(sawDeath && sawLoot); i++) {
      b.tick(0.05);
      if (b.fx.some((e) => e.type === "death")) sawDeath = true;
      if (b.fx.some((e) => e.type === "loot")) sawLoot = true;
    }
    expect(sawDeath).toBe(true);
    expect(sawLoot).toBe(true);
  });
});
