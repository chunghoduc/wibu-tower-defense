/**
 * Pure layout for the row of rarity gems that shows a quest's required tower-slot
 * rarities on the Expedition card. Left-to-right, fixed-size gems with a fixed
 * gap; Phaser-free so the geometry is unit-tested. The presenter draws a
 * rarity__<rarity> texture at each centre, falling back to a procedural gem.
 */
import type { Rarity } from "../data/schemaEnums.ts";

/** Gem diameter in px. */
export const GEM = 18;
/** Horizontal gap between gems in px. */
export const GAP = 4;

export interface RaritySlotGem {
  rarity: Rarity;
  /** Gem centre x. */
  cx: number;
  /** Gem centre y. */
  cy: number;
  /** Gem box size (== GEM). */
  size: number;
}

/** Place `slots` as a left-to-right gem row whose left edge is `x`, centred at `y`. */
export function raritySlotRow(slots: Rarity[], x: number, y: number): RaritySlotGem[] {
  return slots.map((rarity, i) => ({
    rarity,
    cx: x + GEM / 2 + i * (GEM + GAP),
    cy: y,
    size: GEM,
  }));
}
