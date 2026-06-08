import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { endlessEnemyMul, endlessMilestoneReward, bestEndlessWave, recordEndlessWave, ENDLESS_MILESTONE_EVERY } from "../src/core/endless.ts";
import { recordBossRushTier, bestBossRushTier, rolloverBossRush, bossRushReward, BOSS_RUSH_TIERS } from "../src/core/bossRush.ts";

describe("F11 endless survival", () => {
  it("enemy scaling rises with wave number", () => {
    expect(endlessEnemyMul(1)).toBeCloseTo(1, 5);
    expect(endlessEnemyMul(10)).toBeGreaterThan(endlessEnemyMul(5));
  });

  it("milestone reward only on every 5th wave", () => {
    expect(endlessMilestoneReward(3)).toBeNull();
    expect(endlessMilestoneReward(ENDLESS_MILESTONE_EVERY)).not.toBeNull();
    expect(endlessMilestoneReward(20)?.materials).toBeDefined(); // crystal at wave 20
  });

  it("records a new personal best only when beaten", () => {
    const s = createFreshSave();
    expect(recordEndlessWave(s, "stage-1", 7)).toBe(true);
    expect(bestEndlessWave(s, "stage-1")).toBe(7);
    expect(recordEndlessWave(s, "stage-1", 5)).toBe(false);
    expect(recordEndlessWave(s, "stage-1", 12)).toBe(true);
    expect(bestEndlessWave(s, "stage-1")).toBe(12);
  });
});

describe("F12 boss rush (weekly)", () => {
  it("rewards scale with tier and the full clear gives the top prize", () => {
    expect(bossRushReward(0).diamonds).toBe(0);
    expect(bossRushReward(BOSS_RUSH_TIERS).materials).toBeDefined();
    expect(bossRushReward(BOSS_RUSH_TIERS).diamonds).toBeGreaterThan(bossRushReward(1).diamonds!);
  });

  it("records best tier and grants only the incremental reward", () => {
    const s = createFreshSave();
    const r1 = recordBossRushTier(s, "2026-W24", 2);
    expect(bestBossRushTier(s)).toBe(2);
    expect(r1.diamonds).toBe(bossRushReward(2).diamonds);
    // Re-reaching a lower tier grants nothing.
    expect(recordBossRushTier(s, "2026-W24", 1)).toEqual({});
    // Pushing further grants only the difference.
    const r3 = recordBossRushTier(s, "2026-W24", 4);
    expect(r3.diamonds).toBe(bossRushReward(4).diamonds! - bossRushReward(2).diamonds!);
  });

  it("rolls over the best tier on a new week", () => {
    const s = createFreshSave();
    recordBossRushTier(s, "2026-W24", 5);
    rolloverBossRush(s, "2026-W25");
    expect(bestBossRushTier(s)).toBe(0);
  });
});
