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
