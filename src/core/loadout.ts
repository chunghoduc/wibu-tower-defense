/**
 * Loadout helpers — equip / unequip hero items and the active skill.
 *
 * Pure mutations on HeroSave; no Phaser, no persistence. The SaveManager wraps
 * these with persistence, and BattleState reads the resulting equipped maps
 * through its hero stat pipeline.
 */
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import type { ItemSlot, WeaponType } from "../data/schema.ts";
import type { HeroSave } from "./save.ts";

/**
 * Equip an owned item instance into its declared slot.
 * Returns false if the instance is unknown, its def is missing, or the hero's
 * level is below the item's required level. Replaces any item already in slot.
 */
export function equipItem(save: HeroSave, instanceId: string): boolean {
  const inst = save.inventory.items.find((it) => it.id === instanceId);
  if (!inst) return false;
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  if (!def) return false;
  if (save.hero.level < def.requiredLevel) return false;
  save.inventory.equipped[def.slot] = instanceId;
  return true;
}

/** Clear an equipment slot. */
export function unequipSlot(save: HeroSave, slot: ItemSlot): void {
  delete save.inventory.equipped[slot];
}

/** The weapon type currently equipped in the hero's Weapon slot, if any. */
export function equippedWeaponType(save: HeroSave): WeaponType | undefined {
  const id = save.inventory.equipped.Weapon;
  const inst = id ? save.inventory.items.find((it) => it.id === id) : undefined;
  const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
  return def?.weaponType;
}

/** Whether the skill's weapon requirement is met by the currently-equipped weapon. */
export function skillWeaponMet(save: HeroSave, skillId: string): boolean {
  const skill = ACTIVE_SKILLS_MAP.get(skillId);
  if (!skill?.requiresWeapon) return true;           // no requirement → always ok
  return equippedWeaponType(save) === skill.requiresWeapon;
}

/**
 * Equip an active skill the hero has obtained. Returns false if the hero does
 * not own the skill, OR the skill requires a weapon type that isn't equipped.
 */
export function equipSkill(save: HeroSave, skillId: string): boolean {
  const owned = save.hero.obtainedSkills.some((s) => s.skillId === skillId);
  if (!owned) return false;
  if (!skillWeaponMet(save, skillId)) return false;  // requires a matching weapon
  save.hero.equippedSkillId = skillId;
  return true;
}

/** Clear the equipped active skill. */
export function unequipSkill(save: HeroSave): void {
  save.hero.equippedSkillId = null;
}
