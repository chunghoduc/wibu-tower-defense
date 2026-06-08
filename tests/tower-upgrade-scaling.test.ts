import { describe, expect, it } from "vitest";
import { effectiveBehavior, upgradeIncreased, battleLevelAtkMul } from "../src/core/towerUpgrade.ts";
import { towerStatPipeline } from "../src/core/stats.ts";
import { BattleState } from "../src/core/battle.ts";
import { loadCatalog } from "../src/data/catalog.ts";
import { STAGE_1, defaultHeroStats } from "../src/data/stage.ts";
import { TOWERS } from "../src/data/towers.ts";
import type { CharacterDef } from "../src/data/schema.ts";

const def = (id: string): CharacterDef => TOWERS.find((t) => t.id === id)!;

describe("T12 — per-role tower upgrade scaling", () => {
  it("every star adds a general hp increased% bump", () => {
    const inc = upgradeIncreased("damage", 5);
    expect(inc.maxHp).toBeGreaterThan(0);
  });

  it("each star multiplies final attack by ~+60% (additive, hero-share-proof)", () => {
    expect(battleLevelAtkMul(0)).toBe(1);
    expect(battleLevelAtkMul(1)).toBeCloseTo(1.6, 5);   // first star: +60%
    expect(battleLevelAtkMul(5)).toBeCloseTo(4.0, 5);   // ★5: 4× base attack
  });

  it("stat emphasis grows range with battleLevel (towerStatPipeline)", () => {
    const base = def("doro-mire-spirit").baseStats; // debuff: big range emphasis
    const r0 = towerStatPipeline(base, 1, 1, "debuff", 0).range;
    const r5 = towerStatPipeline(base, 1, 1, "debuff", 5).range;
    expect(r5).toBeGreaterThan(r0 * 1.2);
  });

  it("splash radius scales with battleLevel", () => {
    const d = def("pip-powderkeg");
    const r0 = effectiveBehavior(d, 0).splashRadius!;
    const r5 = effectiveBehavior(d, 5).splashRadius!;
    expect(r5).toBeGreaterThan(r0);
  });

  it("chain gains bounces at ★2 and ★4", () => {
    const d = def("tobi-skipstone");
    const base = effectiveBehavior(d, 0).chainTargets!;
    expect(effectiveBehavior(d, 1).chainTargets).toBe(base);
    expect(effectiveBehavior(d, 2).chainTargets).toBe(base + 1);
    expect(effectiveBehavior(d, 4).chainTargets).toBe(base + 2);
  });

  it("dot dps and duration grow", () => {
    const d = def("bram-thornling");
    const b0 = effectiveBehavior(d, 0).dot!;
    const b5 = effectiveBehavior(d, 5).dot!;
    expect(b5.dps).toBeGreaterThan(b0.dps);
    expect(b5.duration).toBeGreaterThan(b0.duration);
  });

  it("debuff slow strengthens and lengthens (capped)", () => {
    const d = def("doro-mire-spirit");
    const s0 = effectiveBehavior(d, 0).slow!;
    const s5 = effectiveBehavior(d, 5).slow!;
    expect(s5.pct).toBeGreaterThan(s0.pct);
    expect(s5.pct).toBeLessThanOrEqual(0.85);
    expect(s5.duration).toBeGreaterThan(s0.duration);
  });

  it("support aura widens and strengthens", () => {
    const d = def("mochi-morale-sprite");
    const a0 = effectiveBehavior(d, 0).buffAura!;
    const a5 = effectiveBehavior(d, 5).buffAura!;
    expect(a5.radius).toBeGreaterThan(a0.radius);
    expect(a5.atkPct ?? 0).toBeGreaterThan(a0.atkPct ?? 0);
  });

  it("never mutates the shared CharacterDef.behavior", () => {
    const d = def("pip-powderkeg");
    const before = JSON.stringify(d.behavior);
    effectiveBehavior(d, 5);
    expect(JSON.stringify(d.behavior)).toBe(before);
  });

  it("upgrading a debuff tower in battle scales its runtime behavior + range", () => {
    const b = new BattleState(STAGE_1, loadCatalog(), {
      seed: 1, hero: { stats: defaultHeroStats(), startPos: { x: 480, y: 270 }, damageType: "Physical" },
    });
    b.placeTower("doro-mire-spirit", 0);
    const t = b.towers[0];
    const slow0 = t.behavior.slow!.pct, range0 = t.stats.range;
    b.gold = 100000;
    for (let i = 0; i < 5; i++) b.upgradeTower(t.uid);
    expect(t.battleLevel).toBe(5);
    expect(t.behavior.slow!.pct).toBeGreaterThan(slow0);
    expect(t.stats.range).toBeGreaterThan(range0);
  });
});
