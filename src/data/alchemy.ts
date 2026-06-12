/**
 * F18 — Alchemy / Surplus Exchange recipes. Convert overflow materials (and
 * banked dupe copies) into scarcer ones at deliberately lossy rates — friction =
 * meaning, so it's an overflow valve, never a faucet that trivializes drops.
 */
import { BLESS_JEWEL, SOUL_JEWEL, SUMMON_SCROLL, AWAKENING_CRYSTAL } from "./materials.ts";

export interface AlchemyRecipe {
  id: string;
  name: string;
  /** materialId → count consumed per craft. */
  inputs: Record<string, number>;
  /** materialId → count produced per craft. */
  outputs: Record<string, number>;
}

export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  {
    id: "bless-to-soul",
    name: "Transmute Bless → Soul",
    inputs: { [BLESS_JEWEL]: 5 },
    outputs: { [SOUL_JEWEL]: 1 },
  },
  {
    id: "soul-to-crystal",
    name: "Transmute Soul → Awakening Crystal",
    inputs: { [SOUL_JEWEL]: 3 },
    outputs: { [AWAKENING_CRYSTAL]: 1 },
  },
  {
    id: "bless-to-scroll",
    name: "Transmute Bless → Summon Scroll",
    inputs: { [BLESS_JEWEL]: 8 },
    outputs: { [SUMMON_SCROLL]: 1 },
  },
  {
    id: "scroll-to-crystal",
    name: "Transmute Scrolls → Awakening Crystal",
    inputs: { [SUMMON_SCROLL]: 4 },
    outputs: { [AWAKENING_CRYSTAL]: 1 },
  },
];

export const ALCHEMY_RECIPES_MAP = new Map<string, AlchemyRecipe>(
  ALCHEMY_RECIPES.map((r) => [r.id, r]),
);

/** Banked dupe copies consumed to mint one Awakening Crystal (the copy-overflow sink). */
export const COPIES_PER_CRYSTAL = 3;
