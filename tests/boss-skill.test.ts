import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/data/enemies.ts";
import { BattleState } from "../src/core/battle.ts";
import { loadCatalog } from "../src/data/catalog.ts";
import { STAGE_1, defaultHeroStats } from "../src/data/stage.ts";
import type { StageDef } from "../src/data/schema.ts";

const bosses = ENEMIES.filter((e) => e.archetype === "Boss");

describe("T16 — boss active skills", () => {
  it("every boss has a valid, well-formed active skill", () => {
    for (const b of bosses) {
      const sk = b.boss?.skill;
      expect(sk, b.id).toBeDefined();
      expect(sk!.manaCost).toBeGreaterThan(0);
      expect(["quake", "rally", "barrier", "summon-surge"]).toContain(sk!.type);
      expect(sk!.name.length).toBeGreaterThan(0);
      expect(sk!.description.length).toBeGreaterThan(0);
    }
  });

  function bossBattle(bossId: string): BattleState {
    const stage: StageDef = {
      ...STAGE_1,
      castleHp: 99999,
      waves: [{ spawns: [{ enemyId: bossId, count: 1, interval: 1, delay: 0 }] }],
    };
    return new BattleState(stage, loadCatalog(), {
      seed: 1,
      hero: { stats: defaultHeroStats(), startPos: { x: 480, y: 270 }, damageType: "Physical" },
    });
  }

  it("a barrier boss casts when its mana fills, shielding itself, then resets mana", () => {
    const b = bossBattle("warden"); // warden = barrier skill
    // advance until the boss has spawned
    for (let i = 0; i < 60 && b.enemies.length === 0; i++) b.tick(0.1);
    const boss = b.enemies.find((e) => e.def.id === "warden")!;
    expect(boss).toBeDefined();
    const cost = boss.def.boss!.skill!.manaCost;
    boss.mana = cost; // on the brink of casting
    expect(boss.shield).toBe(0);
    b.tick(0.1);
    expect(boss.shield).toBeGreaterThan(0); // barrier applied to self
    expect(boss.mana).toBeLessThan(cost); // mana spent
  });

  it("a summon-surge boss spawns extra adds on cast", () => {
    const b = bossBattle("overlord");
    for (let i = 0; i < 60 && b.enemies.length === 0; i++) b.tick(0.1);
    const boss = b.enemies.find((e) => e.def.id === "overlord")!;
    // Neutralize the timed summon so the count change is attributable to the skill.
    boss.bossSummonTimer = 999;
    boss.mana = boss.def.boss!.skill!.manaCost;
    const before = b.enemies.length;
    b.tick(0.1);
    expect(b.enemies.length).toBeGreaterThan(before);
  });

  it("bosses accumulate mana over time", () => {
    const b = bossBattle("zabro");
    for (let i = 0; i < 60 && b.enemies.length === 0; i++) b.tick(0.1);
    const boss = b.enemies.find((e) => e.def.id === "zabro")!;
    boss.mana = 0;
    b.tick(1.0);
    expect(boss.mana).toBeGreaterThan(0);
  });

  it("a boss cast emits a bossCast FX event carrying the boss's element", () => {
    const b = bossBattle("warden");
    for (let i = 0; i < 60 && b.enemies.length === 0; i++) b.tick(0.1);
    const boss = b.enemies.find((e) => e.def.id === "warden")!;
    boss.mana = boss.def.boss!.skill!.manaCost;
    b.tick(0.1); // FX events for this tick land in b.fx (cleared at each tick start)
    const cast = b.fx.find((e) => e.type === "bossCast");
    expect(cast).toBeDefined();
    expect(cast).toMatchObject({ element: boss.def.damageType });
  });
});
