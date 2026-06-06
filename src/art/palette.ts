/**
 * Sprite palette — symbol -> RGBA. Kept tiny and named so the LLM can place
 * pixels by meaning. paletteFor() narrows the set per entity and binds the
 * rarity accent to symbol "A".
 */
import type { Rarity } from "../data/schema.ts";
import type { ArtKind } from "../data/artSpec.ts";

export type Rgba = [number, number, number, number];

export const BASE_PALETTE: Record<string, Rgba> = {
  ".": [0, 0, 0, 0],        // transparent
  K: [22, 22, 30, 255],     // outline (near-black)
  W: [240, 240, 245, 255],  // white / highlight
  S: [232, 196, 160, 255],  // skin
  D: [150, 110, 84, 255],   // dark skin / leather
  M: [120, 128, 140, 255],  // metal mid
  L: [180, 188, 200, 255],  // metal light
  C: [70, 80, 110, 255],    // cloth base
  G: [80, 160, 90, 255],    // nature/green
  F: [240, 150, 50, 255],   // flame
  B: [90, 170, 230, 255],   // frost/blue
  P: [150, 90, 180, 255],   // arcane/purple
  Y: [235, 205, 90, 255],   // gold
};

export const RARITY_ACCENT: Record<Rarity, Rgba> = {
  Common: [138, 146, 160, 255],
  Magic: [47, 111, 219, 255],
  Rare: [142, 68, 173, 255],
  Legendary: [232, 144, 42, 255],
  Unique: [210, 59, 59, 255],
};

const KIND_FAMILIES: Record<ArtKind, string[]> = {
  tower: ["W", "S", "D", "M", "L", "C", "F", "B", "P"],
  hero: ["W", "S", "D", "M", "L", "C", "Y"],
  enemy: ["W", "D", "M", "C", "G", "P"],
  boss: ["W", "D", "M", "L", "C", "P", "F"],
  item: ["W", "M", "L", "Y", "P", "B"],
};

export interface PaletteRequest {
  kind: ArtKind;
  rarity: Rarity;
}

/** Allowed symbol -> RGBA for one entity, including transparent, outline, accent A. */
export function paletteFor(req: PaletteRequest): Record<string, Rgba> {
  const out: Record<string, Rgba> = { ".": BASE_PALETTE["."], K: BASE_PALETTE.K };
  for (const sym of KIND_FAMILIES[req.kind]) out[sym] = BASE_PALETTE[sym];
  out["A"] = RARITY_ACCENT[req.rarity];
  return out;
}
