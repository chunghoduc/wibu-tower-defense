import { describe, expect, it } from "vitest";
import {
  equipItem,
  unequipSlot,
  equipSkill,
  unequipSkill,
} from "../src/core/loadout.ts";
import { createFreshSave, type ItemInstanceSave } from "../src/core/save.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { equipSlotsFor } from "../src/data/schema.ts";
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
    expect(save.inventory.equipped[equipSlotsFor(def.slot)[0]]).toBe(inst.id);
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
    expect(save.inventory.equipped[equipSlotsFor(def.slot)[0]]).toBeUndefined();
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

  it("a ring fits either ring slot: two rings fill Ring1 then Ring2", () => {
    const save = createFreshSave();
    const ring = ITEM_CATALOG.find((d) => d.slot === "Ring")!;
    expect(equipSlotsFor(ring.slot)).toEqual(["Ring1", "Ring2"]);
    const r1 = makeInstance(ring.id), r2 = makeInstance(ring.id);
    save.inventory.items.push(r1, r2);
    equipItem(save, r1.id);                       // first → Ring1
    equipItem(save, r2.id);                       // second → Ring2 (Ring1 taken)
    expect(save.inventory.equipped.Ring1).toBe(r1.id);
    expect(save.inventory.equipped.Ring2).toBe(r2.id);
  });

  it("a ring can target a specific ring slot", () => {
    const save = createFreshSave();
    const ring = ITEM_CATALOG.find((d) => d.slot === "Ring")!;
    const r = makeInstance(ring.id);
    save.inventory.items.push(r);
    equipItem(save, r.id, "Ring2");
    expect(save.inventory.equipped.Ring2).toBe(r.id);
    expect(save.inventory.equipped.Ring1).toBeUndefined();
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
  it("equips a skill the hero owns (no weapon requirement)", () => {
    const save = createFreshSave();
    const skill = ACTIVE_SKILLS.find((s) => !s.requiresWeapon) ?? ACTIVE_SKILLS[0];
    save.hero.obtainedSkills.push({ skillId: skill.id, level: 1, useXp: 0 });
    const ok = equipSkill(save, skill.id);
    expect(ok).toBe(true);
    expect(save.hero.equippedSkillIds).toContain(skill.id);
  });

  it("returns false for a skill the hero does not own", () => {
    const save = createFreshSave();
    expect(equipSkill(save, ACTIVE_SKILLS[0].id)).toBe(false);
    expect(save.hero.equippedSkillIds).toHaveLength(0);
  });

  it("holds at most two skills, bumping the oldest", () => {
    const save = createFreshSave();
    const free = ACTIVE_SKILLS.filter((s) => !s.requiresWeapon).slice(0, 3);
    for (const s of free) save.hero.obtainedSkills.push({ skillId: s.id, level: 1, useXp: 0 });
    equipSkill(save, free[0].id);
    equipSkill(save, free[1].id);
    equipSkill(save, free[2].id); // bumps free[0]
    expect(save.hero.equippedSkillIds).toEqual([free[1].id, free[2].id]);
  });
});

describe("unequipSkill", () => {
  it("removes one skill, or clears all when no id is given", () => {
    const save = createFreshSave();
    const free = ACTIVE_SKILLS.filter((s) => !s.requiresWeapon).slice(0, 2);
    for (const s of free) save.hero.obtainedSkills.push({ skillId: s.id, level: 1, useXp: 0 });
    equipSkill(save, free[0].id);
    equipSkill(save, free[1].id);
    unequipSkill(save, free[0].id);
    expect(save.hero.equippedSkillIds).toEqual([free[1].id]);
    unequipSkill(save);
    expect(save.hero.equippedSkillIds).toHaveLength(0);
  });
});
