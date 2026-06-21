/**
 * Loadout helpers — equip / unequip hero items and the active skill.
 *
 * Pure mutations on HeroSave; no Phaser, no persistence. The SaveManager wraps
 * these with persistence, and BattleState reads the resulting equipped maps
 * through its hero stat pipeline.
 */
import { ITEM_CATALOG_MAP, instanceReqLevel } from "../data/items.ts";
import { ACTIVE_SKILLS_MAP, MAX_ACTIVE_SKILLS } from "../data/skills.ts";
import { equipSlotsFor, type ItemSlot, type WeaponType } from "../data/schema.ts";
import { weaponClassMet } from "./weaponClass.ts";
import type { HeroSave } from "./save.ts";

/**
 * Equip an owned item instance into its declared slot.
 * Returns false if the instance is unknown, its def is missing, or the hero's
 * level is below the item's required level. Replaces any item already in slot.
 */
export function equipItem(save: HeroSave, instanceId: string, targetSlot?: ItemSlot): boolean {
  const inst = save.inventory.items.find((it) => it.id === instanceId);
  if (!inst) return false;
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  if (!def) return false;
  if (save.hero.level < instanceReqLevel(inst, def)) return false;
  // A ring fits either ring slot: honour an explicit target (drop onto Ring1/Ring2),
  // otherwise fill the first empty fitting slot (else replace the first).
  const candidates = equipSlotsFor(def.slot);
  const slot =
    targetSlot && candidates.includes(targetSlot)
      ? targetSlot
      : (candidates.find((s) => !save.inventory.equipped[s]) ?? candidates[0]);
  save.inventory.equipped[slot] = instanceId;
  return true;
}

/** Clear an equipment slot. */
export function unequipSlot(save: HeroSave, slot: ItemSlot): void {
  delete save.inventory.equipped[slot];
}

/** The equipped weapon def in the hero's Weapon slot, if any. */
function equippedWeaponDef(save: HeroSave) {
  const id = save.inventory.equipped.Weapon;
  const inst = id ? save.inventory.items.find((it) => it.id === id) : undefined;
  return inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
}

/** The weapon type currently equipped in the hero's Weapon slot, if any. */
export function equippedWeaponType(save: HeroSave): WeaponType | undefined {
  return equippedWeaponDef(save)?.weaponType;
}

/** Whether the skill's weapon requirement is met by the currently-equipped weapon. */
export function skillWeaponMet(save: HeroSave, skillId: string): boolean {
  const skill = ACTIVE_SKILLS_MAP.get(skillId);
  if (!skill) return true;
  const def = equippedWeaponDef(save);
  // Flexible class gate (preferred for spells) — magic, melee, or ranged.
  // Magic requires a dedicated spell weapon (staff/tome/scepter), never a gun/bow/sword.
  if (skill.weaponClass) {
    return weaponClassMet(skill.weaponClass, def?.weaponType);
  }
  // Legacy exact-weapon gate.
  if (!skill.requiresWeapon) return true;
  return def?.weaponType === skill.requiresWeapon;
}

/**
 * Equip an active skill the hero has obtained into one of the MAX_ACTIVE_SKILLS
 * slots. Returns false if the hero doesn't own the skill or it needs a weapon
 * that isn't equipped. When all slots are full, the oldest is bumped out.
 */
export function equipSkill(save: HeroSave, skillId: string): boolean {
  const owned = save.hero.obtainedSkills.some((s) => s.skillId === skillId);
  if (!owned) return false;
  if (!skillWeaponMet(save, skillId)) return false; // requires a matching weapon
  const eq = save.hero.equippedSkillIds;
  if (eq.includes(skillId)) return true; // already equipped
  if (eq.length >= MAX_ACTIVE_SKILLS) eq.shift(); // drop the oldest slot
  eq.push(skillId);
  return true;
}

/** Unequip a specific active skill, or clear all slots when no id is given. */
export function unequipSkill(save: HeroSave, skillId?: string): void {
  if (skillId === undefined) {
    save.hero.equippedSkillIds = [];
    return;
  }
  save.hero.equippedSkillIds = save.hero.equippedSkillIds.filter((id) => id !== skillId);
}
