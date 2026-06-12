// src/scenes/heroEquipVisuals.ts
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { ItemSlot, WeaponType } from "../data/schema.ts";
import type { InventorySave } from "../core/save.ts";
import { itemTex } from "../data/assetKeys.ts";

export interface HeroLayerConfig {
  weaponKey: string | null;
  /** Equipped weapon's family — drives the hero's hold pose & attack motion. */
  weaponType: WeaponType | null;
  wingKey: string | null;
  petKey: string | null;
}

// The battle hero shows only the held weapon, wings and pet — worn armour isn't
// composited on the body (the rig already reads as armoured; flat icons pasted on
// top look like stickers). Equipped gear is surfaced as icon tiles + stats on the
// equipment screen instead.
export function resolveHeroLayers(inventory: InventorySave): HeroLayerConfig {
  const weapon = _instanceDef(inventory, "Weapon");
  return {
    weaponKey: weapon ? itemTex(weapon.id) : null,
    weaponType: weapon?.weaponType ?? null,
    wingKey:   _resolveWing(inventory),
    petKey:    _resolvePet(inventory),
  };
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
  return def.appearanceRef ?? itemTex(def.id);
}

function _resolvePet(inventory: InventorySave): string | null {
  const def = _instanceDef(inventory, "Pet");
  if (!def) return null;
  return itemTex(def.id);
}
