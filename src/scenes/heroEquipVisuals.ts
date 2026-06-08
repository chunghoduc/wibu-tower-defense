// src/scenes/heroEquipVisuals.ts
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { ItemSlot, WeaponType } from "../data/schema.ts";
import type { InventorySave } from "../core/save.ts";

export interface HeroLayerConfig {
  weaponKey: string | null;
  /** Equipped weapon's family — drives the hero's hold pose & attack motion. */
  weaponType: WeaponType | null;
  wingKey: string | null;
  petKey: string | null;
  /** Worn-armour icon keys, body-anchored on the battle hero (null when bare). */
  helmetKey: string | null;
  bodyKey: string | null;
  glovesKey: string | null;
  bootsKey: string | null;
}

export function resolveHeroLayers(inventory: InventorySave): HeroLayerConfig {
  const weapon = _instanceDef(inventory, "Weapon");
  return {
    weaponKey: weapon ? `item__${weapon.id}` : null,
    weaponType: weapon?.weaponType ?? null,
    wingKey:   _resolveWing(inventory),
    petKey:    _resolvePet(inventory),
    helmetKey: _slotIcon(inventory, "Helmet"),
    bodyKey:   _slotIcon(inventory, "BodyArmor"),
    glovesKey: _slotIcon(inventory, "Gloves"),
    bootsKey:  _slotIcon(inventory, "Boots"),
  };
}

/** `item__<id>` icon key for the item in a slot, or null when nothing is equipped. */
function _slotIcon(inventory: InventorySave, slot: ItemSlot): string | null {
  const def = _instanceDef(inventory, slot);
  return def ? `item__${def.id}` : null;
}

function _instanceDef(inventory: InventorySave, slot: ItemSlot) {
  const instanceId = inventory.equipped[slot];
  if (!instanceId) return null;
  const instance = inventory.items.find((i) => i.id === instanceId);
  if (!instance) return null;
  return ITEM_CATALOG_MAP.get(instance.defId) ?? null;
}

function _resolveWing(inventory: InventorySave): string | null {
  const def = _instanceDef(inventory, "Wing");
  if (!def) return null;
  return def.appearanceRef ?? `item__${def.id}`;
}

function _resolvePet(inventory: InventorySave): string | null {
  const def = _instanceDef(inventory, "Pet");
  if (!def) return null;
  return `item__${def.id}`;
}
