import { describe, expect, it } from "vitest";
import { heroActiveSkillDetail } from "../src/data/skillDescribe.ts";
import { createFreshSave } from "../src/core/save.ts";
import { heroSkillDamage } from "../src/core/skillDamage.ts";
import { skillEffectiveAoe } from "../src/core/hero.ts";
import { ACTIVE_SKILLS_MAP } from "../src/data/skills.ts";

/**
 * The in-battle hero info panel must show ALL information about an equipped active
 * skill — not just its one-line flavour. heroActiveSkillDetail composes the full,
 * value-rich tooltip from the SAME numbers the sim uses (heroSkillDamage +
 * skillEffectiveAoe), so what the player reads equals what the cast does.
 */
const equip = (skillId: string, level = 0) => {
  const save = createFreshSave();
  const existing = save.hero.obtainedSkills.find((e) => e.skillId === skillId);
  if (existing) existing.level = level;
  else save.hero.obtainedSkills.push({ skillId, level, useXp: 0 });
  save.hero.equippedSkillIds = [skillId];
  return save;
};

describe("heroActiveSkillDetail", () => {
  it("opens with the skill's prose description", () => {
    const def = ACTIVE_SKILLS_MAP.get("arcane-nova")!;
    const text = heroActiveSkillDetail(equip("arcane-nova"), "arcane-nova");
    expect(text.startsWith(def.description)).toBe(true);
  });

  it("shows the exact burst the sim deals (matches heroSkillDamage)", () => {
    const save = equip("arcane-nova", 4);
    const dmg = heroSkillDamage(save, "arcane-nova");
    const text = heroActiveSkillDetail(save, "arcane-nova");
    expect(text).toContain(`${Math.round(dmg.burst)}`);
    expect(text).toMatch(/Burst/);
  });

  it("shows the level-scaled AoE in px", () => {
    const def = ACTIVE_SKILLS_MAP.get("arcane-nova")!;
    const save = equip("arcane-nova", 6);
    const aoe = Math.round(skillEffectiveAoe(def.baseAoe, 6));
    const text = heroActiveSkillDetail(save, "arcane-nova");
    expect(text).toContain(`${aoe}px`);
  });

  it("states the weapon requirement (exact weapon, class, or any)", () => {
    // iron-cleave requires a Sword; arcane-nova needs a magic-class weapon;
    // valiant-strike works with any weapon.
    expect(heroActiveSkillDetail(equip("iron-cleave"), "iron-cleave")).toMatch(/Sword/);
    expect(heroActiveSkillDetail(equip("arcane-nova"), "arcane-nova")).toMatch(/magic/i);
    expect(heroActiveSkillDetail(equip("valiant-strike"), "valiant-strike")).toMatch(/Any weapon/);
  });

  it("describes conjured minions for summon skills", () => {
    const text = heroActiveSkillDetail(equip("conjure-flame-sprites"), "conjure-flame-sprites");
    expect(text).toMatch(/Flame Sprite/);
    expect(text).toMatch(/Summon/i);
  });

  it("reflects the skill's level and grows the AoE with it", () => {
    const lo = heroActiveSkillDetail(equip("arcane-nova", 1), "arcane-nova");
    const hi = heroActiveSkillDetail(equip("arcane-nova", 20), "arcane-nova");
    expect(lo).toMatch(/Lv\s*1\b/);
    expect(hi).toMatch(/Lv\s*20\b/);
    // higher level ⇒ strictly larger displayed AoE
    const aoeOf = (s: string) => Number(/(\d+)px/.exec(s)![1]);
    expect(aoeOf(hi)).toBeGreaterThan(aoeOf(lo));
  });

  it("returns empty string for an unknown skill id", () => {
    expect(heroActiveSkillDetail(createFreshSave(), "no-such-skill")).toBe("");
  });
});
