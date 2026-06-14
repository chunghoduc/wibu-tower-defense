// src/data/rarityColors.ts
//
// THE single source of truth for the canonical rarity palette, in both CSS-hex
// string form (text styles) and integer form (Phaser tints/strokes). Phaser-free
// and in the data layer so both data and scene modules may import it. Local
// per-file copies of this 5-key table were deduplicated here — do not re-inline.
import type { Rarity } from "./schemaEnums.ts";

export const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

export const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e,
  Magic: 0x2196f3,
  Rare: 0x9c27b0,
  Legendary: 0xff9800,
  Unique: 0xf44336,
};

/**
 * Pick a legible label colour (`#101010` dark / `#ffffff` light) to draw ON TOP
 * of a filled swatch of `color` (0xRRGGBB), via the swatch's perceived
 * brightness. Use whenever text sits directly over a rarity (or any) fill — a
 * fixed dark label vanishes on the darker saturated rarities (Magic blue, Rare
 * purple, Unique red). Phaser-free.
 */
export function idealTextColor(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  // Rec. 601 luma — cheap and good enough for legibility decisions.
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma >= 150 ? "#101010" : "#ffffff";
}
