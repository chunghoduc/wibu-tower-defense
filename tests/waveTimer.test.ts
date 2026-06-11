/**
 * Fixed-cadence wave timer + the "call wave early for coins" skip mechanic.
 * A campaign stage launches its next wave WAVE_INTERVAL seconds after the
 * previous one *spawned* (not when it clears — so waves overlap if you stall),
 * and the player can skip the countdown to spawn now in exchange for bonus
 * in-battle gold proportional to the time skipped.
 */
import { describe, expect, it } from "vitest";
import { makeStats } from "../src/data/schema.ts";
import { WAVE_INTERVAL, SKIP_COIN_PER_SEC, INTER_WAVE_DELAY } from "../src/core/battle.ts";
import { world, mkEnemy, mkStage } from "./fixtures.ts";

// An inert enemy: never moves, never attacks, never dies (the test hero doesn't
// fire). This lets a wave stay un-cleared indefinitely so we can prove the next
// wave still launches on the timer — overlap — without the castle ever falling.
const inert = mkEnemy({ baseStats: makeStats({ maxHp: 100, moveSpeed: 0, atk: 0, attackSpeed: 0 }) });
const wave = (count: number) => ({ spawns: [{ enemyId: "grunt", count, interval: 0.5, delay: 0 }] });
const threeWaveStage = () =>
  mkStage([wave(3), wave(3), wave(3)], { castleHp: 15, startingGold: 100, path: [{ x: 0, y: 0 }, { x: 1e6, y: 0 }] });

describe("wave-timer constants", () => {
  it("waves are paced 30s apart and a full skip pays per remaining second", () => {
    expect(WAVE_INTERVAL).toBe(30);
    expect(SKIP_COIN_PER_SEC).toBeGreaterThan(0);
  });
});

describe("fixed-cadence wave spawning", () => {
  it("starts the countdown at 30s the instant a wave spawns", () => {
    const b = world([inert], [], threeWaveStage());
    b.tick(INTER_WAVE_DELAY + 0.01); // cross the opening delay → wave 1 launches
    expect(b.waveIndex).toBe(0);
    expect(b.getNextWaveIn()).toBeCloseTo(WAVE_INTERVAL, 1);
  });

  it("launches the next wave 30s after the last one spawned, even if it isn't cleared", () => {
    const b = world([inert], [], threeWaveStage());
    b.tick(INTER_WAVE_DELAY + 0.01); // wave 1
    expect(b.waveIndex).toBe(0);
    b.tick(WAVE_INTERVAL + 0.01); // 30s later → wave 2 spawns on top of the live wave 1
    expect(b.waveIndex).toBe(1);
    expect(b.outcome).toBe("ongoing");
    expect(b.enemies.length).toBeGreaterThan(0); // wave-1 enemies are still alive → overlap
  });
});

describe("call-wave-early skip", () => {
  it("spawns the next wave now and pays gold for the time skipped", () => {
    const b = world([inert], [], threeWaveStage());
    b.tick(INTER_WAVE_DELAY + 0.01); // wave 1, ~30s on the clock
    const remaining = b.getNextWaveIn();
    const goldBefore = b.gold;
    const bonus = b.callNextWave();
    expect(b.waveIndex).toBe(1); // advanced immediately
    expect(bonus).toBe(Math.round(remaining * SKIP_COIN_PER_SEC));
    expect(b.gold).toBe(goldBefore + bonus);
    expect(b.getNextWaveIn()).toBeCloseTo(WAVE_INTERVAL, 1); // timer reset for the new wave
  });

  it("pays less the longer you wait (reward tracks the remaining timer)", () => {
    const b = world([inert], [], threeWaveStage());
    b.tick(INTER_WAVE_DELAY + 0.01);
    const early = b.skipReward();
    b.tick(10); // burn 10 of the 30s
    const later = b.skipReward();
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThan(early);
    expect(later).toBe(Math.round(b.getNextWaveIn() * SKIP_COIN_PER_SEC));
  });

  it("cannot skip past the final wave", () => {
    const b = world([inert], [], threeWaveStage());
    b.tick(INTER_WAVE_DELAY + 0.01); // wave 1
    b.callNextWave(); // wave 2
    b.callNextWave(); // wave 3 (the last)
    expect(b.waveIndex).toBe(2);
    expect(b.canCallWave()).toBe(false);
    const gold = b.gold;
    expect(b.callNextWave()).toBe(0);
    expect(b.gold).toBe(gold);
    expect(b.waveIndex).toBe(2);
  });
});

describe("endless & boss rush keep their clear-then-delay pacing", () => {
  it("offer no early-call skip", () => {
    const endless = world([inert], [], threeWaveStage(), { endless: true });
    expect(endless.canCallWave()).toBe(false);
    expect(endless.callNextWave()).toBe(0);
    expect(endless.getNextWaveIn()).toBe(-1);

    const rush = world([inert], [], threeWaveStage(), { bossRush: true });
    expect(rush.canCallWave()).toBe(false);
    expect(rush.callNextWave()).toBe(0);
  });
});
