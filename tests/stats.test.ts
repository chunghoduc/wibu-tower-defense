import { describe, expect, it } from "vitest";
import {
  makeAcc,
  addFlat,
  addIncreased,
  addMore,
  resolveAcc,
  heroStatPipeline,
  towerStatPipeline,
} from "../src/core/stats.ts";
import { makeStats, defaultStats } from "../src/data/schema.ts";

describe("StatAccumulator — resolve", () => {
  it("applies flat bonus correctly", () => {
    const base = makeStats({ atk: 100 });
    const acc = addFlat(makeAcc(), { atk: 50 });
    const result = resolveAcc(base, acc);
    expect(result.atk).toBe(150);
  });

  it("applies increased% additively (two 10% sources = +20%, not ×1.21)", () => {
    const base = makeStats({ atk: 100 });
    const acc = addIncreased(addIncreased(makeAcc(), { atk: 0.1 }), { atk: 0.1 });
    const result = resolveAcc(base, acc);
    expect(result.atk).toBeCloseTo(120, 5);
  });

  it("applies more% multiplicatively", () => {
    const base = makeStats({ atk: 100 });
    const acc = addMore(addMore(makeAcc(), { atk: 0.5 }), { atk: 0.5 });
    const result = resolveAcc(base, acc);
    // (100 + 0) * (1 + 0) * 1.5 * 1.5 = 225
    expect(result.atk).toBeCloseTo(225, 5);
  });

  it("flat + increased + more compose correctly", () => {
    const base = makeStats({ atk: 100 });
    let acc = makeAcc();
    acc = addFlat(acc, { atk: 20 });       // base+flat = 120
    acc = addIncreased(acc, { atk: 0.5 }); // × 1.5 = 180
    acc = addMore(acc, { atk: 0.2 });      // × 1.2 = 216
    const result = resolveAcc(base, acc);
    expect(result.atk).toBeCloseTo(216, 5);
  });

  it("unaffected stats pass through unchanged", () => {
    const base = makeStats({ atk: 100, maxHp: 500 });
    const acc = addFlat(makeAcc(), { atk: 10 });
    const result = resolveAcc(base, acc);
    expect(result.maxHp).toBe(500);
  });

  it("critDamage defaults to 1.5 and is preserved", () => {
    const base = defaultStats();
    const result = resolveAcc(base, makeAcc());
    expect(result.critDamage).toBe(1.5);
  });
});

describe("heroStatPipeline", () => {
  it("applies level scaling — level 10 gives atk=118, level 50 gives atk=198", () => {
    const base = makeStats({ atk: 100, maxHp: 500 });
    // level 10: flat atk added = 2 * (10-1) = 18 → atk = 118
    const lvl10 = heroStatPipeline(base, 10, [], [], [], null);
    // level 50: flat atk added = 2 * (50-1) = 98 → atk = 198
    const lvl50 = heroStatPipeline(base, 50, [], [], [], null);
    expect(lvl10.atk).toBeCloseTo(118, 5);
    expect(lvl50.atk).toBeCloseTo(198, 5);
    expect(lvl50.maxHp).toBeCloseTo(500 + 15 * 49, 5); // 1235
  });

  it("passive node increased% bonus: +20% on atk=100 → atk=120", () => {
    const base = makeStats({ atk: 100 });
    const node = { flat: undefined, increased: { atk: 0.2 }, more: undefined };
    const withNode = heroStatPipeline(base, 1, [node as any], [], [], null);
    // level 1: no level scaling; +20% increased → 100 * 1.2 = 120
    expect(withNode.atk).toBeCloseTo(120, 5);
  });

  it("item flat stat: +30 on atk=100 → atk=130", () => {
    const base = makeStats({ atk: 100 });
    const item = { atk: 30 };
    const withItem = heroStatPipeline(base, 1, [], [item as any], [], null);
    // level 1: no level scaling; flat +30 → 130 * 1.0 = 130
    expect(withItem.atk).toBeCloseTo(130, 5);
  });
});

describe("towerStatPipeline", () => {
  it("star bonus grows per tier: ★3 on atk=100 → atk=122 (+8% then +14%)", () => {
    const base = makeStats({ atk: 100 });
    // ★1 = 0%, ★2 = +8%, ★3 = +8%+14% = 22% → 122, ★5 = +68% → 168
    expect(towerStatPipeline(base, 1, 1).atk).toBeCloseTo(100, 5);
    expect(towerStatPipeline(base, 1, 2).atk).toBeCloseTo(108, 5);
    expect(towerStatPipeline(base, 1, 3).atk).toBeCloseTo(122, 5);
    expect(towerStatPipeline(base, 1, 5).atk).toBeCloseTo(168, 5);
  });

  it("tower level 20 scaling: atk=100 → atk=128.5 (1.5 flat/level × 19 levels)", () => {
    const base = makeStats({ atk: 100 });
    const lvl20 = towerStatPipeline(base, 20, 0);
    // flat += 1.5 * 19 = 28.5 → (100+28.5) * 1.0 = 128.5
    expect(lvl20.atk).toBeCloseTo(128.5, 5);
  });
});
