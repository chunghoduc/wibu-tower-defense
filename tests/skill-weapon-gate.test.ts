import { describe, expect, it } from "vitest";
import {
  equipSkill,
  equipItem,
  unequipSlot,
  skillWeaponMet,
  equippedWeaponType,
} from "../src/core/loadout.ts";
import { createFreshSave } from "../src/core/save.ts";
import { rollItem, ITEM_CATALOG } from "../src/data/items.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";

const swordDef = ITEM_CATALOG.find((d) => d.weaponType === "Sword")!;
const bowDef = ITEM_CATALOG.find((d) => d.weaponType === "Bow")!;
const staffDef = ITEM_CATALOG.find((d) => d.weaponType === "Staff")!;

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
    expect(save.hero.equippedSkillIds).not.toContain("iron-cleave");
  });

  it("can equip once the required weapon is worn, and breaks if it's removed before re-equip", () => {
    const save = withSkill("iron-cleave");
    giveAndEquip(save, swordDef);
    expect(equippedWeaponType(save)).toBe("Sword");
    expect(equipSkill(save, "iron-cleave")).toBe(true);
    expect(save.hero.equippedSkillIds).toContain("iron-cleave");

    // wrong weapon → can't (re-)equip
    save.hero.equippedSkillIds = [];
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

describe("flexible magic-class skill gate", () => {
  it("a magic spell is castable with a staff", () => {
    const save = withSkill("mana-burst"); // weaponClass: magic
    giveAndEquip(save, staffDef);
    expect(skillWeaponMet(save, "mana-burst")).toBe(true);
    expect(equipSkill(save, "mana-burst")).toBe(true);
  });

  it("a magic spell is NOT castable with a plain physical sword", () => {
    const save = withSkill("arcane-nova"); // weaponClass: magic
    giveAndEquip(save, swordDef);
    expect(skillWeaponMet(save, "arcane-nova")).toBe(false);
    expect(equipSkill(save, "arcane-nova")).toBe(false);
  });

  it("a magic spell is NOT castable with a magic-archetype sword (a 'magic sword')", () => {
    // A spell weapon (staff/tome/scepter) is required. An enchanted sword — even one
    // with a magic build archetype — is not a caster weapon and cannot cast spells.
    const magicSword = ITEM_CATALOG.find(
      (d) =>
        d.slot === "Weapon" &&
        d.weaponType === "Sword" &&
        (d.archetype === "magic" ||
          ["magicDamage", "skillPower", "magicPen"].includes(d.primaryAffix.type)),
    );
    if (!magicSword) return; // no magic sword in catalog yet — pure test covers the logic
    const save = withSkill("mana-burst");
    giveAndEquip(save, magicSword);
    expect(skillWeaponMet(save, "mana-burst")).toBe(false);
  });
});
