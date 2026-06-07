// src/scenes/heroEquipVisuals.ts
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { InventorySave } from "../core/save.ts";

export interface HeroLayerConfig {
  weaponKey: string | null;
  wingKey: string | null;
  petKey: string | null;
}

export function resolveHeroLayers(inventory: InventorySave): HeroLayerConfig {
  return {
    weaponKey: _resolveWeapon(inventory),
    wingKey:   _resolveWing(inventory),
    petKey:    _resolvePet(inventory),
  };
}

function _instanceDef(inventory: InventorySave, slot: string) {
  const instanceId = (inventory.equipped as Record<string, string | undefined>)[slot];
  if (!instanceId) return null;
  const instance = inventory.items.find((i) => i.id === instanceId);
  if (!instance) return null;
  return ITEM_CATALOG_MAP.get(instance.defId) ?? null;
}

function _resolveWeapon(inventory: InventorySave): string | null {
  const def = _instanceDef(inventory, "Weapon");
  if (!def) return null;
  return `item__${def.id}`;
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
