import { describe, expect, it } from "vitest";
import { heroActiveBurst, skillEffectivePower } from "../src/core/hero.ts";
import { createFreshSave } from "../src/core/save.ts";
import { ACTIVE_SKILLS_MAP } from "../src/data/skills.ts";

/**
 * The hero's active cast must reflect the *equipped* skill: its levelled power
 * drives the burst multiplier and its damageType drives the burst type. Before
 * this wiring every skill cast for a flat ×2 of the weapon's damage type, so a
 * Unique True-damage skill was indistinguishable from a starter.
 */
describe("heroActiveBurst", () => {
  it("anchors a Power-100 skill at level 0 to the legacy ×2", () => {
    const save = createFreshSave();
    // Spirit Bolt is basePower 85 → at lvl 0, mult = 85/50 = 1.7 (not 2).
    save.hero.obtainedSkills.push({ skillId: "spirit-bolt", level: 0, useXp: 0 });
    save.hero.equippedSkillIds = ["spirit-bolt"];
    const r = heroActiveBurst(save);
    expect(r.skillId).toBe("spirit-bolt");
    expect(r.mult).toBeCloseTo(85 / 50, 5);
    expect(r.damageType).toBe("Magic"); // the skill's type, not the weapon's
  });

  it("a higher-basePower skill hits harder", () => {
    const save = createFreshSave();
    save.hero.obtainedSkills.push({ skillId: "true-strike", level: 0, useXp: 0 });
    save.hero.equippedSkillIds = ["true-strike"];
    const trueStrike = heroActiveBurst(save);

    const save2 = createFreshSave();
    save2.hero.obtainedSkills.push({ skillId: "valiant-strike", level: 0, useXp: 0 });
    save2.hero.equippedSkillIds = ["valiant-strike"];
    const valiant = heroActiveBurst(save2);

    expect(trueStrike.mult).toBeGreaterThan(valiant.mult);
    expect(trueStrike.damageType).toBe("True"); // True Strike deals True
  });

  it("skill level raises the burst (the leveling loop now matters)", () => {
    const lvl0 = createFreshSave();
    lvl0.hero.obtainedSkills.push({ skillId: "arcane-nova", level: 0, useXp: 0 });
    lvl0.hero.equippedSkillIds = ["arcane-nova"];

    const lvl10 = createFreshSave();
    lvl10.hero.obtainedSkills.push({ skillId: "arcane-nova", level: 10, useXp: 0 });
    lvl10.hero.equippedSkillIds = ["arcane-nova"];

    const def = ACTIVE_SKILLS_MAP.get("arcane-nova")!;
    expect(heroActiveBurst(lvl10).mult).toBeGreaterThan(heroActiveBurst(lvl0).mult);
    expect(heroActiveBurst(lvl10).mult).toBeCloseTo(skillEffectivePower(def.basePower, 10) / 50, 5);
  });

  it("falls back to the legacy ×2 / weapon type when nothing is equipped", () => {
    const save = createFreshSave();
    save.hero.equippedSkillIds = [];
    const r = heroActiveBurst(save);
    expect(r.mult).toBe(2);
    expect(r.damageType).toBeUndefined(); // caller falls back to the weapon type
  });
});
