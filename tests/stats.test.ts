import { describe, expect, it } from "vitest";
import {
  makeAcc,
  addFlat,
  addIncreased,
  addMore,
  resolveAcc,
  heroStatPipeline,
  towerStatPipeline,
  heroBaseCritRate,
  collectPassiveMore,
  addHeroShare,
  HERO_TOWER_SHARE,
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
    acc = addFlat(acc, { atk: 20 }); // base+flat = 120
    acc = addIncreased(acc, { atk: 0.5 }); // × 1.5 = 180
    acc = addMore(acc, { atk: 0.2 }); // × 1.2 = 216
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

  it("neutral crit growth: 0% at L1, ramps linearly to 30% at L90, capped beyond", () => {
    expect(heroBaseCritRate(1)).toBeCloseTo(0, 6);
    expect(heroBaseCritRate(90)).toBeCloseTo(0.3, 6);
    // Linear: level 45.5 is the midpoint of 1..90 → ~15%; check the exact L46 step.
    expect(heroBaseCritRate(46)).toBeCloseTo((0.3 * 45) / 89, 6);
    // Held at the cap past level 90.
    expect(heroBaseCritRate(100)).toBeCloseTo(0.3, 6);
  });

  it("pipeline applies neutral crit growth as flat, with gear critRate stacking on top", () => {
    const base = makeStats({ critRate: 0 });
    // L90 alone → 30% crit chance from level scaling.
    expect(heroStatPipeline(base, 90, [], [], [], null).critRate).toBeCloseTo(0.3, 6);
    // +12% critRate from an item adds on top → 42%.
    const withGear = heroStatPipeline(base, 90, [], [{ critRate: 0.12 } as any], [], null);
    expect(withGear.critRate).toBeCloseTo(0.42, 6);
  });

  it("passive node fractional stat in `increased` is applied FLAT (a '+10% crit' node adds 0.10, not ~0)", () => {
    // critRate has a ~0 base, so routing it through increased% would multiply a
    // near-zero number and apply almost nothing. Fractional stats must add flat,
    // matching how item affixes resolve them.
    const base = makeStats({ critRate: 0 });
    const node = { flat: undefined, increased: { critRate: 0.1 }, more: undefined };
    const withNode = heroStatPipeline(base, 1, [node as any], [], [], null);
    expect(withNode.critRate).toBeCloseTo(0.1, 6);
  });

  it("passive node critDamage in `increased` adds flat onto the 1.5 base (+0.20 → 1.70)", () => {
    const base = makeStats({ critDamage: 1.5 });
    const node = { flat: undefined, increased: { critDamage: 0.2 }, more: undefined };
    const withNode = heroStatPipeline(base, 1, [node as any], [], [], null);
    expect(withNode.critDamage).toBeCloseTo(1.7, 6);
  });

  it("passive node SCALAR stat in `increased` still applies as a percentage (+12% atk)", () => {
    const base = makeStats({ atk: 100 });
    const node = { flat: undefined, increased: { atk: 0.12 }, more: undefined };
    const withNode = heroStatPipeline(base, 1, [node as any], [], [], null);
    expect(withNode.atk).toBeCloseTo(112, 6);
  });

  it("mixed passive node: scalar increased% and fractional flat resolve independently", () => {
    // Brutality: +12% atk (scalar → increased%) and +8% crit (fractional → flat).
    const base = makeStats({ atk: 100, critRate: 0 });
    const node = { flat: undefined, increased: { atk: 0.12, critRate: 0.08 }, more: undefined };
    const withNode = heroStatPipeline(base, 1, [node as any], [], [], null);
    expect(withNode.atk).toBeCloseTo(112, 6);
    expect(withNode.critRate).toBeCloseTo(0.08, 6);
  });
});

describe("collectPassiveMore", () => {
  it("gathers more% from keystone nodes", () => {
    const nodes = [{ type: "keystone", more: { atk: 0.5 } }];
    expect(collectPassiveMore(nodes as any)).toEqual([{ atk: 0.5 }]);
  });

  it("also gathers more% from non-keystone nodes (a notable's more% must not be dropped)", () => {
    // prestige-gate-90 is a `notable` with more: { atk: 0.15 } — gating on
    // type === 'keystone' silently dropped it, so its +15% never applied.
    const nodes = [{ type: "notable", more: { atk: 0.15 } }];
    expect(collectPassiveMore(nodes as any)).toEqual([{ atk: 0.15 }]);
  });

  it("skips nodes without a more% bag", () => {
    const nodes = [
      { type: "path", increased: { atk: 0.03 } },
      { type: "keystone", more: { atk: 0.5 } },
      { type: "notable", flat: { maxHp: 30 } },
    ];
    expect(collectPassiveMore(nodes as any)).toEqual([{ atk: 0.5 }]);
  });
});

describe("addHeroShare", () => {
  it("exposes the share rate as 60%", () => {
    expect(HERO_TOWER_SHARE).toBeCloseTo(0.6, 6);
  });

  it("adds 60% of a scalar hero stat onto the tower's stat (atk 100 + 0.6*200 = 220)", () => {
    const tower = makeStats({ atk: 100 });
    const hero = makeStats({ atk: 200 });
    expect(addHeroShare(tower, hero).atk).toBeCloseTo(220, 6);
  });

  it("shares fractional stats directly (hero 0.5 crit → +0.30 on tower)", () => {
    const tower = makeStats({ critRate: 0 });
    const hero = makeStats({ critRate: 0.5 });
    expect(addHeroShare(tower, hero).critRate).toBeCloseTo(0.3, 6);
  });

  it("shares only critDamage ABOVE the 1.5 baseline (hero 2.0 → tower 1.5 + 0.6*0.5 = 1.8)", () => {
    const tower = makeStats({ critDamage: 1.5 });
    const hero = makeStats({ critDamage: 2.0 });
    expect(addHeroShare(tower, hero).critDamage).toBeCloseTo(1.8, 6);
  });

  it("a hero with no crit-damage gear adds nothing (both at the 1.5 baseline)", () => {
    const tower = makeStats({ critDamage: 1.5 });
    const hero = makeStats({ critDamage: 1.5 });
    expect(addHeroShare(tower, hero).critDamage).toBeCloseTo(1.5, 6);
  });

  it("shares only skillPower ABOVE the 1.0 baseline (hero 1.5 → tower 1.0 + 0.6*0.5 = 1.3)", () => {
    const tower = makeStats({ skillPower: 1 });
    const hero = makeStats({ skillPower: 1.5 });
    expect(addHeroShare(tower, hero).skillPower).toBeCloseTo(1.3, 6);
  });

  it("does NOT share moveSpeed — towers are static, so a moving hero never mobilizes them", () => {
    const tower = makeStats({ moveSpeed: 0 });
    const hero = makeStats({ moveSpeed: 300 });
    expect(addHeroShare(tower, hero).moveSpeed).toBeCloseTo(0, 6);
  });

  it("does NOT share range — a tower's reach is its own; a long-reach hero weapon must not extend it past its indicator", () => {
    const tower = makeStats({ range: 130 });
    const hero = makeStats({ range: 240 }); // e.g. a Bow hero
    expect(addHeroShare(tower, hero).range).toBeCloseTo(130, 6);
  });

  it("honours a custom rate", () => {
    const tower = makeStats({ atk: 100 });
    const hero = makeStats({ atk: 100 });
    expect(addHeroShare(tower, hero, 0.25).atk).toBeCloseTo(125, 6);
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
