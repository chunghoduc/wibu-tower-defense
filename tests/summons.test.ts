import { describe, expect, it } from "vitest";
import { SUMMONS, SUMMON_MAP, minionStatsFrom } from "../src/data/summons.ts";

describe("summon catalog", () => {
  it("has at least three distinct summon archetypes", () => {
    expect(SUMMONS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(SUMMONS.map((s) => s.id)).size).toBe(SUMMONS.length);
  });

  it("every summon has positive stats and a lifespan", () => {
    for (const s of SUMMONS) {
      expect(s.atkFrac).toBeGreaterThan(0);
      expect(s.hpFrac).toBeGreaterThan(0);
      expect(s.attackSpeed).toBeGreaterThan(0);
      expect(s.range).toBeGreaterThan(0);
      expect(s.count).toBeGreaterThanOrEqual(1);
      expect(s.lifespan).toBeGreaterThan(0);
    }
  });

  it("SUMMON_MAP resolves by id", () => {
    for (const s of SUMMONS) expect(SUMMON_MAP.get(s.id)).toBe(s);
  });
});

describe("minionStatsFrom", () => {
  const golem = SUMMON_MAP.get("frost-golem")!;

  it("scales atk and hp off the summoner", () => {
    const a = minionStatsFrom(golem, 1000, 5000);
    const b = minionStatsFrom(golem, 2000, 5000);
    expect(b.atk).toBeGreaterThan(a.atk);
    expect(a.atk).toBeCloseTo(1000 * golem.atkFrac, 5);
    expect(a.maxHp).toBeGreaterThanOrEqual(5000 * golem.hpFrac);
  });

  it("carries the summon's attackSpeed and range", () => {
    const s = minionStatsFrom(golem, 1000, 5000);
    expect(s.attackSpeed).toBe(golem.attackSpeed);
    expect(s.range).toBe(golem.range);
  });

  it("never produces a zero-hp minion even with a tiny summoner", () => {
    const s = minionStatsFrom(golem, 0, 0);
    expect(s.maxHp).toBeGreaterThan(0);
    expect(s.atk).toBeGreaterThanOrEqual(0);
  });
});
