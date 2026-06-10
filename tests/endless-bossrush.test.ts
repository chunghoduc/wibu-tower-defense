import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  endlessEnemyMul, endlessMilestoneReward, bestEndlessWave, recordEndlessWave, ENDLESS_MILESTONE_EVERY,
  endlessWave, isEndlessBossWave, endlessBossId, endlessRunReward, claimEndlessRun, ENDLESS_BOSS_EVERY,
  endlessEntryCost, payEndlessEntry, ENDLESS_ENTRY_CAP,
} from "../src/core/endless.ts";
import { BOSS_BY_STAGE } from "../src/data/stage.ts";
import { isEmptyReward } from "../src/core/rewards.ts";
import { recordBossRushTier, bestBossRushTier, rolloverBossRush, bossRushReward, BOSS_RUSH_TIERS } from "../src/core/bossRush.ts";
import { world, mkEnemy, mkStage, oneWave } from "./fixtures.ts";

const waveCount = (w: { spawns: { count: number }[] }) => w.spawns.reduce((n, s) => n + s.count, 0);

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

  it("every Nth wave is a boss wave carrying a roster boss", () => {
    expect(isEndlessBossWave(ENDLESS_BOSS_EVERY)).toBe(true);
    expect(isEndlessBossWave(ENDLESS_BOSS_EVERY + 1)).toBe(false);
    expect(isEndlessBossWave(0)).toBe(false);
    expect(BOSS_BY_STAGE).toContain(endlessBossId(ENDLESS_BOSS_EVERY));
    const w = endlessWave(ENDLESS_BOSS_EVERY);
    expect(w.spawns.some((s) => BOSS_BY_STAGE.includes(s.enemyId))).toBe(true);
  });

  it("boss roster rotates with depth", () => {
    expect(endlessBossId(ENDLESS_BOSS_EVERY)).not.toBe(endlessBossId(ENDLESS_BOSS_EVERY * 2));
  });

  it("generates a non-empty wave for any depth and grows denser over time", () => {
    for (const w of [1, 5, 13, 27, 50, 100, 500]) {
      expect(endlessWave(w).spawns.length).toBeGreaterThan(0);
    }
    expect(waveCount(endlessWave(30))).toBeGreaterThan(waveCount(endlessWave(2)));
  });

  it("scaling compounds every wave and never overflows to non-finite", () => {
    expect(endlessEnemyMul(2)).toBeGreaterThan(endlessEnemyMul(1));
    expect(endlessEnemyMul(101)).toBeGreaterThan(endlessEnemyMul(100));
    expect(Number.isFinite(endlessEnemyMul(1000))).toBe(true);
  });

  it("run reward covers only the (from, to] band — boss chests + milestone gems", () => {
    expect(isEmptyReward(endlessRunReward(0, 3))).toBe(true); // no milestone/boss reached yet
    const firstFive = endlessRunReward(0, ENDLESS_MILESTONE_EVERY);
    expect(firstFive.diamonds).toBeGreaterThan(0);
    const throughBoss = endlessRunReward(0, ENDLESS_BOSS_EVERY);
    expect(throughBoss.materials).toBeDefined(); // a boss chest dropped at the boss wave
    // Banding: a deeper run grants strictly more than a shallow one.
    expect((endlessRunReward(0, 40).diamonds ?? 0)).toBeGreaterThan(endlessRunReward(0, 10).diamonds ?? 0);
  });

  it("the sim keeps generating waves past the authored count and never declares victory", () => {
    // A 1-wave stage with an unbreakable castle: in endless mode the run must keep
    // spawning fresh procedural waves forever and never flip to "won".
    const stage = mkStage(oneWave("grunt", 2), { castleHp: 1e9, path: [{ x: 0, y: 0 }, { x: 300, y: 0 }] });
    const b = world([mkEnemy()], [], stage, { endless: true });
    for (let i = 0; i < 4000 && b.outcome === "ongoing"; i++) b.tick(0.05);
    expect(b.outcome).toBe("ongoing"); // castle stands → run never resolves on its own
    expect(b.waveIndex).toBeGreaterThan(stage.waves.length); // generated well beyond the single authored wave
  });

  it("endless spawns compound in strength as the run deepens", () => {
    const stage = mkStage(oneWave("grunt", 1), { castleHp: 1e9, path: [{ x: 0, y: 0 }, { x: 200, y: 0 }] });
    const b = world([mkEnemy()], [], stage, { endless: true });
    // Record the toughest grunt HP seen at each waveIndex as the run progresses.
    const hpByWave = new Map<number, number>();
    for (let i = 0; i < 5000; i++) {
      b.tick(0.05);
      for (const e of b.enemies) hpByWave.set(b.waveIndex, Math.max(hpByWave.get(b.waveIndex) ?? 0, e.stats.maxHp));
    }
    const early = hpByWave.get(0)!;
    const late = [...hpByWave.entries()].filter(([w]) => w >= 6).map(([, hp]) => hp)[0];
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early); // a wave-7+ grunt is meaningfully tougher than a wave-1 grunt
  });

  it("claim grants only newly-reached depth (farm-resistant, like boss rush)", () => {
    const s = createFreshSave();
    const first = claimEndlessRun(s, "stage-1", 12);
    expect(first.isBest).toBe(true);
    expect(isEmptyReward(first.reward)).toBe(false);
    expect(bestEndlessWave(s, "stage-1")).toBe(12);
    // Replaying a shallower run grants nothing.
    const replay = claimEndlessRun(s, "stage-1", 8);
    expect(replay.isBest).toBe(false);
    expect(isEmptyReward(replay.reward)).toBe(true);
    // Pushing deeper grants only the incremental band (waves 13..25).
    const deeper = claimEndlessRun(s, "stage-1", 25);
    expect(deeper.isBest).toBe(true);
    expect(deeper.reward).toEqual(endlessRunReward(12, 25));
  });

  it("entry cost rises with best wave, has a cheap floor and a hard cap", () => {
    expect(endlessEntryCost(0)).toBe(150);                        // cheap first taste
    expect(endlessEntryCost(20)).toBeGreaterThan(endlessEntryCost(10)); // scales with record
    expect(endlessEntryCost(20)).toBe(850);                      // 150 + 35*20, round10
    expect(endlessEntryCost(100000)).toBe(ENDLESS_ENTRY_CAP);    // never locks you out
    expect(endlessEntryCost(50) % 10).toBe(0);                   // always a round number
  });

  it("paying entry deducts gold and is refused when too poor", () => {
    const s = createFreshSave();
    s.currency.gold = 1000;
    recordEndlessWave(s, "stage-1", 20); // best 20 → cost 850
    const paid = payEndlessEntry(s, "stage-1");
    expect(paid).toBe(850);
    expect(s.currency.gold).toBe(150);
    // Now broke for the 850 fee → refused, no further deduction.
    const again = payEndlessEntry(s, "stage-1");
    expect(again).toBe(-1);
    expect(s.currency.gold).toBe(150);
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
