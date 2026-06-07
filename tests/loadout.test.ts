import { describe, expect, it } from "vitest";
import {
  equipItem,
  unequipSlot,
  equipSkill,
  unequipSkill,
} from "../src/core/loadout.ts";
import { createFreshSave, type ItemInstanceSave } from "../src/core/save.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { ACTIVE_SKILLS } from "../src/data/skills.ts";

function makeInstance(defId: string, acquiredLevel = 1): ItemInstanceSave {
  return {
    id: `inst-${defId}-${acquiredLevel}`,
    defId,
    acquiredLevel,
    rolledStats: {},
    rolledPrimaryAffix: 0,
    rolledAffixes: [], enhanceLevel: 0,
  };
}

describe("equipItem", () => {
  it("equips an item into its declared slot", () => {
    const save = createFreshSave();
    const def = ITEM_CATALOG.find((d) => d.id === "iron-sword")!;
    const inst = makeInstance(def.id);
    save.inventory.items.push(inst);

    const ok = equipItem(save, inst.id);
    expect(ok).toBe(true);
    expect(save.inventory.equipped[def.slot]).toBe(inst.id);
  });

  it("returns false for an unknown instance id", () => {
    const save = createFreshSave();
    expect(equipItem(save, "does-not-exist")).toBe(false);
  });

  it("returns false when hero level is below the item's required level", () => {
    const save = createFreshSave(); // hero level 1
    const def = ITEM_CATALOG.find((d) => d.requiredLevel > 1)!;
    const inst = makeInstance(def.id);
    save.inventory.items.push(inst);
    expect(equipItem(save, inst.id)).toBe(false);
    expect(save.inventory.equipped[def.slot]).toBeUndefined();
  });

  it("replaces an already-equipped item in the same slot", () => {
    const save = createFreshSave();
    const a = makeInstance("iron-sword");
    const b = makeInstance("iron-sword");
    save.inventory.items.push(a, b);
    equipItem(save, a.id);
    equipItem(save, b.id);
    expect(save.inventory.equipped.Weapon).toBe(b.id);
  });
});

describe("unequipSlot", () => {
  it("clears the slot", () => {
    const save = createFreshSave();
    const inst = makeInstance("iron-sword");
    save.inventory.items.push(inst);
    equipItem(save, inst.id);
    unequipSlot(save, "Weapon");
    expect(save.inventory.equipped.Weapon).toBeUndefined();
  });
});

describe("equipSkill", () => {
  it("equips a skill the hero owns", () => {
    const save = createFreshSave();
    const skill = ACTIVE_SKILLS[0];
    save.hero.obtainedSkills.push({ skillId: skill.id, level: 1, useXp: 0 });
    const ok = equipSkill(save, skill.id);
    expect(ok).toBe(true);
    expect(save.hero.equippedSkillId).toBe(skill.id);
  });

  it("returns false for a skill the hero does not own", () => {
    const save = createFreshSave();
    expect(equipSkill(save, ACTIVE_SKILLS[0].id)).toBe(false);
    expect(save.hero.equippedSkillId).toBeNull();
  });
});

describe("unequipSkill", () => {
  it("clears the equipped skill", () => {
    const save = createFreshSave();
    const skill = ACTIVE_SKILLS[0];
    save.hero.obtainedSkills.push({ skillId: skill.id, level: 1, useXp: 0 });
    equipSkill(save, skill.id);
    unequipSkill(save);
    expect(save.hero.equippedSkillId).toBeNull();
  });
});
