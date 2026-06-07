import { describe, expect, it } from "vitest";
import { equipSkill, equipItem, unequipSlot, skillWeaponMet, equippedWeaponType } from "../src/core/loadout.ts";
import { createFreshSave } from "../src/core/save.ts";
import { rollItem, ITEM_CATALOG } from "../src/data/items.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";

const swordDef = ITEM_CATALOG.find((d) => d.weaponType === "Sword")!;
const bowDef = ITEM_CATALOG.find((d) => d.weaponType === "Bow")!;

function withSkill(skillId: string) {
  const save = createFreshSave();
  save.hero.level = 50;
  save.hero.obtainedSkills.push({ skillId, level: 1, useXp: 0 });
  return save;
}
function giveAndEquip(save: any, def: any) {
  const inst = toItemInstanceSave(rollItem(def, 1, 1));
  save.inventory.items.push(inst);
  equipItem(save, inst.id);
  return inst;
}

describe("skill weapon requirement on equip", () => {
  it("cannot equip a Sword skill without a Sword equipped", () => {
    const save = withSkill("iron-cleave"); // requires Sword
    expect(skillWeaponMet(save, "iron-cleave")).toBe(false);
    expect(equipSkill(save, "iron-cleave")).toBe(false);
    expect(save.hero.equippedSkillId).toBeNull();
  });

  it("can equip once the required weapon is worn, and breaks if it's removed before re-equip", () => {
    const save = withSkill("iron-cleave");
    giveAndEquip(save, swordDef);
    expect(equippedWeaponType(save)).toBe("Sword");
    expect(equipSkill(save, "iron-cleave")).toBe(true);
    expect(save.hero.equippedSkillId).toBe("iron-cleave");

    // wrong weapon → can't (re-)equip
    save.hero.equippedSkillId = null;
    unequipSlot(save, "Weapon");
    giveAndEquip(save, bowDef);
    expect(equipSkill(save, "iron-cleave")).toBe(false);
  });

  it("a skill with no weapon requirement equips with any/no weapon", () => {
    // true-strike requires no weapon
    const save = withSkill("true-strike");
    expect(skillWeaponMet(save, "true-strike")).toBe(true);
    expect(equipSkill(save, "true-strike")).toBe(true);
  });
});
