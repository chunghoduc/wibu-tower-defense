import { describe, expect, it } from "vitest";
import {
  heroSkillBadgeTooltip,
  heroActiveSkillDetail,
} from "../src/data/skillDescribe.ts";
import { createFreshSave } from "../src/core/save.ts";
import { ACTIVE_SKILLS_MAP } from "../src/data/skills.ts";

/**
 * The always-visible in-battle "Skill" HUD badge is hoverable: its tooltip is the
 * COMPLETE detail for every equipped active (name + the same value-rich body the
 * info panel shows), so a player reading the badge sees level, damage calc and AoE
 * without opening the unit panel.
 */
const equip = (skillIds: string[], level = 0) => {
  const save = createFreshSave();
  for (const id of skillIds) {
    const existing = save.hero.obtainedSkills.find((e) => e.skillId === id);
    if (existing) existing.level = level;
    else save.hero.obtainedSkills.push({ skillId: id, level, useXp: 0 });
  }
  save.hero.equippedSkillIds = skillIds;
  return save;
};

describe("heroSkillBadgeTooltip", () => {
  it("is empty when no skill is equipped", () => {
    const save = createFreshSave();
    save.hero.equippedSkillIds = [];
    expect(heroSkillBadgeTooltip(save)).toBe("");
  });

  it("leads with the skill name then the full detail body", () => {
    const def = ACTIVE_SKILLS_MAP.get("arcane-nova")!;
    const save = equip(["arcane-nova"], 5);
    const text = heroSkillBadgeTooltip(save);
    expect(text).toContain(def.name);
    // contains the same value-rich body the panel uses
    expect(text).toContain(heroActiveSkillDetail(save, "arcane-nova"));
    expect(text).toMatch(/Burst/);
    expect(text).toMatch(/px/);
    expect(text).toMatch(/Lv\s*5\b/);
  });

  it("lists every equipped skill, blank-line separated", () => {
    const save = equip(["arcane-nova", "iron-cleave"]);
    const text = heroSkillBadgeTooltip(save);
    expect(text).toContain(ACTIVE_SKILLS_MAP.get("arcane-nova")!.name);
    expect(text).toContain(ACTIVE_SKILLS_MAP.get("iron-cleave")!.name);
    expect(text).toContain("\n\n");
  });

  it("skips unknown skill ids without crashing", () => {
    const save = equip(["arcane-nova"]);
    save.hero.equippedSkillIds = ["no-such-skill", "arcane-nova"];
    const text = heroSkillBadgeTooltip(save);
    expect(text).toContain(ACTIVE_SKILLS_MAP.get("arcane-nova")!.name);
    expect(text.startsWith("⚡")).toBe(true);
  });
});
