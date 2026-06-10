// src/scenes/dressHero.ts
//
// Overlay a hero figure with the player's equipped OUTFIT — weapon (held), wings
// (back) and pet — at body-anchored positions. Worn armour and accessories are
// intentionally skipped: the hero figure is already drawn as an armoured knight,
// so flat inventory icons pasted on top read as stickers. Used on the main menu
// so the throne hero visibly wields its weapon, wings and companion.
import Phaser from "phaser";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { InventorySave } from "../core/save.ts";
import type { ItemSlot } from "../data/schema.ts";

interface OutfitAnchor {
  slot: ItemSlot;
  nx: number;   // horizontal, 0.5 = centre (offset scales with the hero's half-width)
  ny: number;   // vertical, 0 = top of the hero box, 1 = bottom
  scale: number; // icon height as a fraction of the hero height
  depth: number; // relative to the hero sprite's depth
}

// Draw order back→front: wings behind the body, then the held weapon and pet in
// front. Worn armour (helmet/body/gloves/boots) is intentionally NOT overlaid:
// the hero figure already reads as a fully-armoured knight, and pasting flat
// inventory icons on top reads as stickers (helmet over the face, boots on the
// thigh). Rings + Amulet are likewise excluded — they don't read at a glance.
const OUTFIT: OutfitAnchor[] = [
  { slot: "Wing",      nx: 0.50, ny: 0.30, scale: 0.85, depth: -1 },
  { slot: "Weapon",    nx: 0.14, ny: 0.52, scale: 0.52, depth: 3 },
  { slot: "Pet",       nx: 0.92, ny: 0.84, scale: 0.42, depth: 4 },
];

/**
 * Add outfit overlays for `inventory` around a hero figure whose visual box is
 * centred at `cx`, spans `[topY, topY+heroH]` vertically and is `heroH` tall.
 * Returns the created images (so the caller can clear them on refresh).
 */
export function dressHero(
  scene: Phaser.Scene, inventory: InventorySave,
  cx: number, topY: number, heroH: number, baseDepth: number,
): Phaser.GameObjects.Image[] {
  const halfW = heroH * 0.42; // the character is narrower than the (square) frame
  const out: Phaser.GameObjects.Image[] = [];
  for (const a of OUTFIT) {
    const instId = inventory.equipped[a.slot];
    if (!instId) continue;
    const inst = inventory.items.find((it) => it.id === instId);
    const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
    if (!def) continue;
    const key = (a.slot === "Wing" && def.appearanceRef) ? def.appearanceRef : `item__${def.id}`;
    if (!scene.textures.exists(key)) continue;
    const img = scene.add.image(cx + (a.nx - 0.5) * 2 * halfW, topY + a.ny * heroH, key)
      .setOrigin(0.5)
      .setDepth(baseDepth + a.depth);
    img.setScale((a.scale * heroH) / img.height);
    out.push(img);
  }
  return out;
}
