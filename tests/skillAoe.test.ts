import { describe, expect, it } from "vitest";
import {
  skillEffectiveAoe,
  heroActiveBurst,
  DEFAULT_SKILL_AOE,
  ACTIVE_AOE_PER_LEVEL,
} from "../src/core/hero.ts";
import { createFreshSave } from "../src/core/save.ts";
import { ACTIVE_SKILLS, ACTIVE_SKILLS_MAP } from "../src/data/skills.ts";

/**
 * Skills carry a base damage (basePower) AND a base AoE (baseAoe); BOTH grow with
 * the skill's level. The cast's true hit-radius is the level-scaled AoE, and the
 * cast VFX is sized from that very same radius (so the spectacle matches the zone
 * that actually takes damage).
 */
describe("skillEffectiveAoe", () => {
  it("defaults to DEFAULT_SKILL_AOE when no base is authored (level 0)", () => {
    expect(skillEffectiveAoe(undefined, 0)).toBe(DEFAULT_SKILL_AOE);
  });

  it("uses the authored base at level 0", () => {
    expect(skillEffectiveAoe(100, 0)).toBe(100);
  });

  it("grows with skill level by the documented per-level factor", () => {
    expect(skillEffectiveAoe(100, 10)).toBeCloseTo(100 * (1 + ACTIVE_AOE_PER_LEVEL * 10), 6);
    expect(skillEffectiveAoe(100, 20)).toBeGreaterThan(skillEffectiveAoe(100, 10));
    expect(skillEffectiveAoe(100, 50)).toBeGreaterThan(skillEffectiveAoe(100, 20));
  });
});

describe("every active skill authors a positive base AoE", () => {
  it("baseAoe is present and > 0 on every catalog skill", () => {
    for (const def of ACTIVE_SKILLS) {
      expect(def.baseAoe, def.id).toBeGreaterThan(0);
    }
  });

  it("area nukes have a wider base AoE than focused single-target skills", () => {
    const nova = ACTIVE_SKILLS_MAP.get("arcane-nova")!.baseAoe!;
    const round = ACTIVE_SKILLS_MAP.get("concussion-round")!.baseAoe!;
    expect(nova).toBeGreaterThan(round);
  });
});

describe("heroActiveBurst carries the level-scaled effective AoE", () => {
  const equip = (skillId: string, level = 0) => {
    const save = createFreshSave();
    save.hero.obtainedSkills.push({ skillId, level, useXp: 0 });
    save.hero.equippedSkillIds = [skillId];
    return save;
  };

  it("returns the skill's base AoE at level 0", () => {
    const def = ACTIVE_SKILLS_MAP.get("arcane-nova")!;
    expect(heroActiveBurst(equip("arcane-nova")).aoe).toBeCloseTo(
      skillEffectiveAoe(def.baseAoe, 0),
      6,
    );
  });

  it("a higher skill level yields a strictly larger AoE", () => {
    const lo = heroActiveBurst(equip("arcane-nova", 0)).aoe;
    const hi = heroActiveBurst(equip("arcane-nova", 12)).aoe;
    expect(hi).toBeGreaterThan(lo);
  });

  it("falls back to DEFAULT_SKILL_AOE when nothing is equipped", () => {
    const save = createFreshSave();
    save.hero.equippedSkillIds = [];
    expect(heroActiveBurst(save).aoe).toBe(DEFAULT_SKILL_AOE);
  });
});
