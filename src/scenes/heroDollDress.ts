/**
 * Dress the equipment-screen mannequin: body gear (helmet/body/gloves/boots/
 * weapon/wings) renders as body-fitted worn layers ON the figure (worn art when
 * present, else the inventory icon); accessories (amulet/rings/pet) stay as small
 * chips at their slot anchors. Every piece is a draggable tile so unequip still
 * works. Keeps HeroScene under the file-size cap. See
 * docs/superpowers/specs/2026-06-20-hero-worn-dressed-doll-design.md.
 */
import type Phaser from "phaser";
import { heroDressLayout } from "../data/heroDressLayout.ts";
import { ITEM_SLOTS, type ItemSlot } from "../data/schema.ts";
import type { InventorySave } from "../core/save.ts";
import { makeItemTile, type ItemTileCallbacks } from "./heroItemTiles.ts";

type Box = { x: number; y: number; w: number; h: number };

/** Add the dressed-gear tiles for `inventory` into `tiles` (cleared by caller). */
export function dressDoll(
  scene: Phaser.Scene,
  tiles: Phaser.GameObjects.Container,
  inventory: InventorySave,
  body: Box,
  slotPos: Map<ItemSlot, { x: number; y: number }>,
  cb: ItemTileCallbacks,
): void {
  const layers = heroDressLayout(inventory, body);
  const wornSlots = new Set(layers.map((l) => l.slot));
  for (const L of layers) {
    const inst = inventory.items.find((it) => it.id === inventory.equipped[L.slot]);
    if (!inst) continue;
    const h = Math.max(20, Math.round(L.scale * body.h));
    tiles.add(makeItemTile(scene, inst, L.cx, L.cy, L.slot, cb, h, { preferWorn: true, frameless: true }));
  }
  for (const slot of ITEM_SLOTS) {
    if (wornSlots.has(slot)) continue;
    const instId = inventory.equipped[slot];
    if (!instId) continue;
    const inst = inventory.items.find((it) => it.id === instId);
    if (!inst) continue;
    const p = slotPos.get(slot);
    if (!p) continue;
    tiles.add(makeItemTile(scene, inst, p.x, p.y, slot, cb, 40));
  }
}
