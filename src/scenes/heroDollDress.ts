/**
 * Dress the equipment-screen mannequin: every equipped piece renders as its own
 * inventory ICON in its slot box (helmet/body/weapon/accessory alike) — the
 * item's catalog icon, NOT body-fitted worn art, sized to sit inside the slot
 * frame. Every piece is a draggable tile so unequip still works. Keeps HeroScene
 * under the file-size cap.
 */
import type Phaser from "phaser";
import { ITEM_SLOTS, type ItemSlot } from "../data/schema.ts";
import type { InventorySave } from "../core/save.ts";
import { makeItemTile, type ItemTileCallbacks } from "./heroItemTiles.ts";

type Box = { x: number; y: number; w: number; h: number };

/** Slot-box icon size — fits inside the 40px doll slot frame drawn by HeroScene. */
const DOLL_TILE = 38;

/** Add the equipped-gear icon tiles for `inventory` into `tiles` (cleared by caller). */
export function dressDoll(
  scene: Phaser.Scene,
  tiles: Phaser.GameObjects.Container,
  inventory: InventorySave,
  _body: Box,
  slotPos: Map<ItemSlot, { x: number; y: number }>,
  cb: ItemTileCallbacks,
): void {
  for (const slot of ITEM_SLOTS) {
    const instId = inventory.equipped[slot];
    if (!instId) continue;
    const inst = inventory.items.find((it) => it.id === instId);
    if (!inst) continue;
    const p = slotPos.get(slot);
    if (!p) continue;
    tiles.add(makeItemTile(scene, inst, p.x, p.y, slot, cb, DOLL_TILE));
  }
}
