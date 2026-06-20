import { describe, it, expect } from "vitest";
import { DIFFICULTIES, DIFFICULTY_SCALING } from "../src/data/schema.ts";
import { ELITE_BATTLE_CHANCE } from "../src/core/elite.ts";
import { ENEMIES } from "../src/data/enemies.ts";

// The OLD values these assertions replace (for reference):
//   Normal hpMult 1.55, atkMult 1.25, bossHpMult 1.6
//   effective Normal boss factor (hpMult*bossHpMult) = 2.48
//   ELITE_BATTLE_CHANCE 0.25; apex base HP fallenward 3100 / meruon 3800 / ashghost 4200
const OLD_NORMAL_BOSS_FACTOR = 2.48;

const bossMaxHp = (id: string): number => {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new Error(`boss ${id} not found`);
  return def.baseStats.maxHp;
};

describe("difficulty rebalance — tougher trash, less-immortal bosses", () => {
  it("lifts the non-boss HP/atk floor (enemies harder to kill)", () => {
    const n = DIFFICULTY_SCALING.Normal;
    expect(n.hpMult).toBeGreaterThanOrEqual(2.0); // was 1.55
    expect(n.hpMult).toBeGreaterThan(1.55);
    expect(n.atkMult).toBeGreaterThanOrEqual(1.45); // was 1.25
  });

  it("closes the trash↔boss gap: effective Normal boss factor does not exceed the old wall", () => {
    const n = DIFFICULTY_SCALING.Normal;
    const effectiveBoss = n.hpMult * n.bossHpMult;
    // Trash rose (>1.55) while the boss factor did NOT rise above the old 2.48.
    expect(effectiveBoss).toBeLessThanOrEqual(OLD_NORMAL_BOSS_FACTOR);
  });

  it("trims the three apex boss HP-sponges", () => {
    expect(bossMaxHp("fallenward")).toBeLessThanOrEqual(2850);
    expect(bossMaxHp("fallenward")).toBeLessThan(3100);
    expect(bossMaxHp("meruon")).toBeLessThanOrEqual(3200);
    expect(bossMaxHp("meruon")).toBeLessThan(3800);
    expect(bossMaxHp("ashghost")).toBeLessThanOrEqual(3500);
    expect(bossMaxHp("ashghost")).toBeLessThan(4200);
  });

  it("keeps the apex bosses ascending by base HP (BOSS_HP_RANK order intact)", () => {
    expect(bossMaxHp("madarok")).toBeLessThan(bossMaxHp("fallenward"));
    expect(bossMaxHp("fallenward")).toBeLessThan(bossMaxHp("meruon"));
    expect(bossMaxHp("meruon")).toBeLessThan(bossMaxHp("ashghost"));
  });

  it("fields tanky elites more often", () => {
    expect(ELITE_BATTLE_CHANCE).toBeGreaterThanOrEqual(0.3); // was 0.25
  });

  it("preserves the tier monotonic law for hpMult and atkMult", () => {
    const hp = DIFFICULTIES.map((d) => DIFFICULTY_SCALING[d].hpMult);
    const atk = DIFFICULTIES.map((d) => DIFFICULTY_SCALING[d].atkMult);
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      expect(hp[i]).toBeGreaterThan(hp[i - 1]);
      expect(atk[i]).toBeGreaterThan(atk[i - 1]);
    }
  });
});
