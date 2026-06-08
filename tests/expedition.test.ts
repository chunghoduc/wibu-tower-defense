import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  startExpedition, collectExpedition, expeditionPendingGold, expeditionActive,
  expeditionGoldPerHour, EXPEDITION_CAP_MS, MAX_EXPEDITION_TOWERS,
} from "../src/core/expedition.ts";
import { Rng } from "../src/core/rng.ts";

const HOUR = 60 * 60 * 1000;
const BASE = 1_700_000_000_000; // a realistic epoch (startedAt must be > 0)

function withTowers(n: number) {
  const s = createFreshSave();
  for (let i = 0; i < n; i++) s.collection[`t${i}`] = { stars: 1, copies: 0 };
  return s;
}

describe("F2 idle expedition", () => {
  it("is inactive until started", () => {
    const s = createFreshSave();
    expect(expeditionActive(s)).toBe(false);
    expect(expeditionPendingGold(s, 1_000_000)).toBe(0);
  });

  it("caps the party at 3 owned towers", () => {
    const s = withTowers(5);
    startExpedition(s, ["t0", "t1", "t2", "t3", "t4"], BASE);
    expect(s.meta.expedition.towerIds).toHaveLength(MAX_EXPEDITION_TOWERS);
  });

  it("accrues gold over time", () => {
    const s = withTowers(3);
    startExpedition(s, ["t0", "t1", "t2"], BASE);
    const rate = expeditionGoldPerHour(s);
    expect(expeditionPendingGold(s, BASE + 2 * HOUR)).toBe(rate * 2);
  });

  it("caps accrual at 8 hours", () => {
    const s = withTowers(1);
    startExpedition(s, ["t0"], BASE);
    const rate = expeditionGoldPerHour(s);
    const capped = expeditionPendingGold(s, BASE + 100 * HOUR);
    expect(capped).toBe(Math.floor(rate * (EXPEDITION_CAP_MS / HOUR)));
  });

  it("collect grants gold and resets the baseline (expedition keeps running)", () => {
    const s = withTowers(2);
    startExpedition(s, ["t0", "t1"], BASE);
    const gold0 = s.currency.gold;
    const reward = collectExpedition(s, BASE + 3 * HOUR, new Rng(1));
    expect(reward.gold).toBeGreaterThan(0);
    expect(s.currency.gold).toBe(gold0 + reward.gold!);
    expect(expeditionActive(s)).toBe(true);
    // Immediately collecting again yields nothing (baseline was reset).
    expect(expeditionPendingGold(s, BASE + 3 * HOUR)).toBe(0);
  });
});
