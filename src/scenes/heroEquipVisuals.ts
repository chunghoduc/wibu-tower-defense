// src/scenes/heroEquipVisuals.ts
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { ItemSlot, WeaponType } from "../data/schema.ts";
import type { InventorySave } from "../core/save.ts";
import { itemTex, wornTex } from "../data/assetKeys.ts";
import { WORN_GEAR_SLOTS, type WornGearSlot } from "../data/heroBattleRig.ts";

/** Texture candidates for one worn-armour overlay (prefer worn art, fall back to icon). */
export interface GearLayer {
  /** Purpose-built worn-on-body art key (worn__<id>); may be absent at runtime. */
  wornKey: string;
  /** Inventory-icon fallback (item__<id>). */
  iconKey: string;
}

export interface HeroLayerConfig {
  weaponKey: string | null;
  /** Equipped weapon's family — drives the hero's hold pose & attack motion. */
  weaponType: WeaponType | null;
  wingKey: string | null;
  petKey: string | null;
  /** Worn-armour overlays composited on the body (null when the slot is empty). */
  gear: Record<WornGearSlot, GearLayer | null>;
}

// The battle hero composites the held weapon, wings, pet AND the four worn-armour
// pieces (helmet/body/gloves/boots) — each anchored to a body region by
// heroBattleRig so the gear follows the body's motion. Worn art is preferred; the
// inventory icon is the fallback when a piece has no purpose-built overlay yet.
export function resolveHeroLayers(inventory: InventorySave): HeroLayerConfig {
  const weapon = _instanceDef(inventory, "Weapon");
  const gear = {} as Record<WornGearSlot, GearLayer | null>;
  for (const slot of WORN_GEAR_SLOTS) {
    const def = _instanceDef(inventory, slot as ItemSlot);
    gear[slot] = def ? { wornKey: wornTex(def.id), iconKey: itemTex(def.id) } : null;
  }
  return {
    weaponKey: weapon ? itemTex(weapon.id) : null,
    weaponType: weapon?.weaponType ?? null,
    wingKey: _resolveWing(inventory),
    petKey: _resolvePet(inventory),
    gear,
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
