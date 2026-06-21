import { describe, expect, it } from "vitest";
import { skillAtkMult, heroSkillDamage } from "../src/core/skillDamage.ts";
import { heroActiveBurst, skillEffectivePower } from "../src/core/hero.ts";
import { resolveHeroBattleStats } from "../src/core/heroStats.ts";
import { defaultHeroStats } from "../src/data/stage.ts";
import { createFreshSave } from "../src/core/save.ts";
import { ACTIVE_SKILLS_MAP } from "../src/data/skills.ts";

/**
 * The Skills screen must show the skill's damage multiplication AND the exact
 * number the cast deals in battle. Both are derived here from the same functions
 * the sim uses (heroActiveBurst + resolveHeroBattleStats), so display ≡ battle by
 * construction. See battleDamage.ts castActive: burst = atk × mult × max(1, skillPower).
 */
describe("skillAtkMult", () => {
  it("is the skill's effective Power over the legacy ×2 anchor (50)", () => {
    expect(skillAtkMult(250, 0)).toBeCloseTo(250 / 50, 6); // ×5.0
    expect(skillAtkMult(85, 0)).toBeCloseTo(85 / 50, 6); // ×1.7
  });

  it("rises with skill level, matching skillEffectivePower", () => {
    expect(skillAtkMult(250, 10)).toBeGreaterThan(skillAtkMult(250, 0));
    expect(skillAtkMult(250, 10)).toBeCloseTo(skillEffectivePower(250, 10) / 50, 6);
  });
});

describe("heroSkillDamage", () => {
  const equip = (skillId: string, level = 0) => {
    const save = createFreshSave();
    save.hero.obtainedSkills.push({ skillId, level, useXp: 0 });
    save.hero.equippedSkillIds = [skillId];
    return save;
  };

  it("reproduces the in-battle cast formula EXACTLY (atk × mult × max(1, skillPower))", () => {
    const save = equip("arcane-nova", 3);
    const info = heroSkillDamage(save, "arcane-nova");

    // The sim builds the burst from these exact primitives:
    const stats = resolveHeroBattleStats(save, defaultHeroStats()).stats;
    const mult = heroActiveBurst(save).mult; // = activeMult fed to castActive
    const expected = stats.atk * mult * Math.max(1, stats.skillPower);

    expect(info.burst).toBeCloseTo(expected, 6);
    expect(info.atk).toBeCloseTo(stats.atk, 6);
    expect(info.mult).toBeCloseTo(mult, 6);
    expect(info.skillPower).toBeCloseTo(Math.max(1, stats.skillPower), 6);
  });

  it("carries the skill's own damage type (the True/Magic override path)", () => {
    expect(heroSkillDamage(equip("void-palm"), "void-palm").damageType).toBe("True");
    expect(heroSkillDamage(equip("spirit-bolt"), "spirit-bolt").damageType).toBe("Magic");
  });

  it("a higher-Power skill yields a strictly bigger burst for the same hero", () => {
    const lo = heroSkillDamage(equip("spirit-bolt"), "spirit-bolt").burst;
    const hi = heroSkillDamage(equip("void-palm"), "void-palm").burst;
    expect(hi).toBeGreaterThan(lo);
  });

  it("clamps skillPower below 1 exactly as the sim does", () => {
    const save = equip("arcane-nova");
    const base = { ...defaultHeroStats(), skillPower: 0 };
    const info = heroSkillDamage(save, "arcane-nova", base);
    // resolved skillPower may be 0; the burst must use the max(1, …) floor.
    expect(info.skillPower).toBeGreaterThanOrEqual(1);
    expect(info.burst).toBeCloseTo(info.atk * info.mult * info.skillPower, 6);
  });

  it("matches the level-aware multiplier shown on the card", () => {
    const def = ACTIVE_SKILLS_MAP.get("arcane-nova")!;
    const info = heroSkillDamage(equip("arcane-nova", 7), "arcane-nova");
    expect(info.mult).toBeCloseTo(skillEffectivePower(def.basePower, 7) / 50, 6);
  });
});
