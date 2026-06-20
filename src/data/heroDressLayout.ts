// src/data/heroDressLayout.ts
//
// Pure paper-doll dressing: map an equipped loadout to ordered worn-layer
// placements (helmet on the head, breastplate on the torso, weapon in hand,
// boots at the feet, wings behind), normalized to a body box. The single source
// of truth for both the equipment-screen doll and the home throne hero so the
// hero visibly WEARS its gear instead of showing square inventory tiles.
//
// Accessories (rings/amulet) and the pet are excluded — they don't read as worn
// on a body. Phaser-free, tested. See
// docs/superpowers/specs/2026-06-20-hero-worn-dressed-doll-design.md.
import type { ItemSlot } from "./schema.ts";
import type { InventorySave } from "../core/save.ts";
import { ITEM_CATALOG_MAP } from "./items.ts";
import { itemTex, wornTex } from "./assetKeys.ts";

export interface WornLayer {
  slot: ItemSlot;
  key: string; // preferred worn-art key (worn__<id>)
  iconKey: string; // fallback inventory icon (item__<id>)
  cx: number;
  cy: number;
  scale: number; // fraction of body height
  depth: number; // back→front
  behind: boolean; // drawn behind the body
}

// Body-region anchor (normalized within the body box), scale (× body height),
// depth, and behind flag per worn slot. Tuned to a front-facing full body.
interface Anchor {
  nx: number;
  ny: number;
  scale: number;
  depth: number;
  behind?: boolean;
}
// Tuned to the front-facing full-body mannequin (hero-base.png): head ≈13% down,
// torso ≈42%, fists ≈60%, boots ≈90%.
const ANCHORS: Partial<Record<ItemSlot, Anchor>> = {
  Wing: { nx: 0.5, ny: 0.34, scale: 0.66, depth: 0, behind: true },
  BodyArmor: { nx: 0.5, ny: 0.4, scale: 0.4, depth: 3 },
  Helmet: { nx: 0.5, ny: 0.1, scale: 0.18, depth: 5 },
  Boots: { nx: 0.5, ny: 0.9, scale: 0.2, depth: 4 },
  Gloves: { nx: 0.7, ny: 0.62, scale: 0.13, depth: 6 },
  Weapon: { nx: 0.25, ny: 0.54, scale: 0.5, depth: 7 },
};

// Stable iteration order (depth drives the actual draw order). Exported so the
// asset loader gates worn-art preloads to exactly these body slots (no drift).
export const WORN_SLOTS: ItemSlot[] = ["Wing", "BodyArmor", "Helmet", "Boots", "Gloves", "Weapon"];

function defFor(inventory: InventorySave, slot: ItemSlot) {
  const instId = inventory.equipped[slot];
  if (!instId) return null;
  const inst = inventory.items.find((i) => i.id === instId);
  if (!inst) return null;
  return ITEM_CATALOG_MAP.get(inst.defId) ?? null;
}

/**
 * Worn layers for a loadout, anchored within `body`. Each layer carries the
 * preferred worn-art key and an inventory-icon fallback; the presenter draws
 * whichever texture exists (so generated worn art swaps in transparently).
 */
export function heroDressLayout(
  inventory: InventorySave,
  body: { x: number; y: number; w: number; h: number },
): WornLayer[] {
  const out: WornLayer[] = [];
  for (const slot of WORN_SLOTS) {
    const a = ANCHORS[slot];
    if (!a) continue;
    const def = defFor(inventory, slot);
    if (!def) continue;
    out.push({
      slot,
      key: wornTex(def.id),
      iconKey: itemTex(def.id),
      cx: body.x + a.nx * body.w,
      cy: body.y + a.ny * body.h,
      scale: a.scale,
      depth: a.depth,
      behind: a.behind ?? false,
    });
  }
  return out;
}
