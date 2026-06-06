import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { loadCatalog } from "../src/data/catalog.ts";
import { STAGE_1, defaultHeroStats } from "../src/data/stage.ts";

function freshBattle() {
  return new BattleState(STAGE_1, loadCatalog(), {
    seed: 3,
    hero: { stats: defaultHeroStats(), startPos: { x: 300, y: 120 }, damageType: "Physical" },
  });
}

describe("enemyAttack FX", () => {
  it("emits an enemyAttack event (and damages the hero) when an enemy reaches the body-blocking hero", () => {
    const b = freshBattle();
    // park the hero right on the lane near the start so marching enemies block on it
    b.commandHero({ x: 140, y: 120 });
    let sawAttack = false;
    const startHp = b.hero.hp;
    for (let i = 0; i < 2000 && !sawAttack; i++) {
      b.tick(0.05);
      if (b.fx.some((e) => e.type === "enemyAttack")) sawAttack = true;
    }
    expect(sawAttack).toBe(true);
    expect(b.hero.hp).toBeLessThan(startHp);
  });

  it("enemyAttack carries the attacker uid and target position", () => {
    const b = freshBattle();
    b.commandHero({ x: 140, y: 120 });
    let ev: { uid: number; at: { x: number; y: number }; targetAt: { x: number; y: number } } | undefined;
    for (let i = 0; i < 2000 && !ev; i++) {
      b.tick(0.05);
      const found = b.fx.find((e) => e.type === "enemyAttack");
      if (found && found.type === "enemyAttack") ev = found;
    }
    expect(ev).toBeDefined();
    expect(typeof ev!.uid).toBe("number");
    expect(ev!.targetAt).toBeDefined();
  });
});
