import { describe, expect, it } from "vitest";
import { STAGES } from "../src/data/stage.ts";
import { ENEMIES, BOSS_CASTLE_DAMAGE, castleLeakDamage } from "../src/data/enemies.ts";

const byId = new Map(ENEMIES.map((e) => [e.id, e]));
const isBossWave = (wave: { spawns: { enemyId: string }[] }) =>
  wave.spawns.some((s) => byId.get(s.enemyId)?.archetype === "Boss");

describe("stage wave structure", () => {
  it("every campaign stage has exactly 10 waves", () => {
    for (const stage of STAGES) {
      expect(stage.waves.length, stage.id).toBe(10);
    }
  });

  it("wave 5 and wave 10 are the only boss waves", () => {
    for (const stage of STAGES) {
      stage.waves.forEach((wave, i) => {
        const expectBoss = i === 4 || i === 9; // wave 5 and wave 10 (1-based)
        expect(isBossWave(wave), `${stage.id} wave ${i + 1}`).toBe(expectBoss);
      });
    }
  });

  it("every stage castle has only 15 HP", () => {
    for (const stage of STAGES) {
      expect(stage.castleHp, stage.id).toBe(15);
    }
  });
});

describe("boss castle damage", () => {
  it("a boss leak deals 10 (10x a normal enemy's 1)", () => {
    expect(BOSS_CASTLE_DAMAGE).toBe(10);
    const boss = ENEMIES.find((e) => e.archetype === "Boss")!;
    expect(castleLeakDamage(boss)).toBe(10);
  });

  it("a normal enemy leak deals its own castleDamage", () => {
    const grunt = byId.get("grunt")!;
    expect(grunt.archetype).not.toBe("Boss");
    expect(castleLeakDamage(grunt)).toBe(grunt.castleDamage);
  });
});
