/**
 * Early-clear auto-skip: when a campaign wave is wiped out before its 30s cadence
 * elapses, the next wave should auto-launch after a short countdown (AUTO_SKIP_
 * COUNTDOWN seconds), and the player banks the same time-saved bonus a manual ⏩
 * tap would have paid — no button press required.
 */
import { describe, expect, it } from "vitest";
import { makeStats } from "../src/data/schema.ts";
import {
  WAVE_INTERVAL,
  SKIP_COIN_PER_SEC,
  INTER_WAVE_DELAY,
  AUTO_SKIP_COUNTDOWN,
} from "../src/core/battle.ts";
import { world, mkEnemy, mkTower } from "./fixtures.ts";

// A fragile enemy a turret one-shots, on a very long lane so it never leaks.
const grunt = mkEnemy({
  baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 0, attackSpeed: 0 }),
});
const wave = (count: number) => ({
  spawns: [{ enemyId: "grunt", count, interval: 0.3, delay: 0 }],
});
const stage = () => ({
  id: "test",
  name: "Test",
  path: [
    { x: 0, y: 0 },
    { x: 1e6, y: 0 },
  ],
  airSpawns: [],
  castleHp: 50,
  startingGold: 100,
  towerSlots: [{ x: 120, y: 36 }],
  waves: [wave(2), wave(2), wave(2)],
});

/** A turret on the slot that mows the wave down quickly. */
function armed() {
  const b = world([grunt], [mkTower()], stage());
  b.tick(INTER_WAVE_DELAY + 0.01); // wave 1 launches
  b.placeTowerAt("turret", { x: 120, y: 36 });
  return b;
}

describe("early-clear auto-skip", () => {
  it("arms a 3s countdown and banks the time-saved bonus when the field is cleared early", () => {
    const b = armed();
    expect(b.waveIndex).toBe(0);
    const goldBefore = b.gold;
    const remaining = b.getNextWaveIn();
    // Tick until the turret has wiped the wave; the auto-skip should arm.
    for (let i = 0; i < 60 && b.getAutoSkipIn() < 0; i++) b.tick(0.1);
    expect(b.enemies.length).toBe(0);
    expect(b.getAutoSkipIn()).toBeGreaterThan(0);
    expect(b.getAutoSkipIn()).toBeLessThanOrEqual(AUTO_SKIP_COUNTDOWN);
    // Bonus equals the manual-skip bounty for the cadence time still on the clock.
    expect(b.gold).toBeGreaterThanOrEqual(
      goldBefore + Math.round((remaining - 6) * SKIP_COIN_PER_SEC),
    );
    // While the auto-countdown runs the manual ⏩ stands aside.
    expect(b.canCallWave()).toBe(false);
    expect(b.getNextWaveIn()).toBe(-1);
  });

  it("auto-launches the next wave after the countdown elapses", () => {
    const b = armed();
    for (let i = 0; i < 60 && b.getAutoSkipIn() < 0; i++) b.tick(0.1);
    expect(b.waveIndex).toBe(0);
    b.tick(AUTO_SKIP_COUNTDOWN + 0.02); // run out the countdown
    expect(b.waveIndex).toBe(1); // next wave launched automatically
    expect(b.getAutoSkipIn()).toBe(-1); // countdown consumed
    expect(b.getNextWaveIn()).toBeCloseTo(WAVE_INTERVAL, 0); // fresh cadence
  });
});
