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
  it("applies level scaling — higher level gives more stats", () => {
    const base = makeStats({ atk: 100, maxHp: 500 });
    const lvl10 = heroStatPipeline(base, 10, [], [], [], null);
    const lvl50 = heroStatPipeline(base, 50, [], [], [], null);
    expect(lvl50.atk).toBeGreaterThan(lvl10.atk);
    expect(lvl50.maxHp).toBeGreaterThan(lvl10.maxHp);
  });

  it("passive node increased% bonus adds to final stats", () => {
    const base = makeStats({ atk: 100 });
    const node = { increased: { atk: 0.2 } };
    const withNode = heroStatPipeline(base, 1, [node as any], [], [], null);
    const withoutNode = heroStatPipeline(base, 1, [], [], [], null);
    expect(withNode.atk).toBeGreaterThan(withoutNode.atk);
  });

  it("item flat stat adds to final stats", () => {
    const base = makeStats({ atk: 100 });
    const item = { atk: 30 };
    const withItem = heroStatPipeline(base, 1, [], [item as any], [], null);
    const withoutItem = heroStatPipeline(base, 1, [], [], [], null);
    expect(withItem.atk).toBeGreaterThan(withoutItem.atk);
  });
});

describe("towerStatPipeline", () => {
  it("star bonus increases stats", () => {
    const base = makeStats({ atk: 100 });
    const star0 = towerStatPipeline(base, 1, 0);
    const star3 = towerStatPipeline(base, 1, 3);
    expect(star3.atk).toBeGreaterThan(star0.atk);
  });

  it("tower level scaling increases stats", () => {
    const base = makeStats({ atk: 100 });
    const lvl1 = towerStatPipeline(base, 1, 0);
    const lvl20 = towerStatPipeline(base, 20, 0);
    expect(lvl20.atk).toBeGreaterThan(lvl1.atk);
  });
});
