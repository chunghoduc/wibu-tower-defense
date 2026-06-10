/**
 * Item homage + visual + flavour metadata — the single source of truth for an
 * item's identity. Each entry drives:
 *   - the inventory icon AND the in-battle worn overlay (via `appearance`), and
 *   - the SDXL art prompt (via `appearance.look`, fed verbatim).
 *
 * Items are ORIGINAL HOMAGES to iconic anime gear: the name and look *evoke* a
 * famous item without copying its real name or likeness (a legal requirement —
 * mirrors the create-character skill). The real source lives only in the
 * designer-only `homage` field; it is never shown to players.
 *
 * Keyed by item id. Two shapes share one record:
 *   - BASE / signature items keyed by their item id carry `name` (display name).
 *   - Generated LINES keyed by their line id carry `base` (the homage base name;
 *     the catalog renders `${rarityPrefix} ${base}`, e.g. "Mythic Hollowmoon
 *     Cleaver"). Tiers inherit appearance/specialty/lore unchanged — rarity is a
 *     rim-glow layer applied in the art pipeline, never a body re-tint.
 */
import type { ItemAppearance } from "./schema.ts";
import { ITEM_LORE_BASE } from "./itemLoreBase.ts";
import { ITEM_LORE_LINES } from "./itemLoreLines.ts";
import { ITEM_LORE_EXPANSION } from "./itemLoreExpansion.ts";

export interface ItemLoreEntry {
  /** Display name for a base/signature item (overrides the catalog default). */
  name?: string;
  /** Homage base name for a generated line (rendered with the rarity prefix). */
  base?: string;
  appearance: ItemAppearance;
  /** Designer-only — the anime item this evokes. Never shipped to players. */
  homage: { source: string; original: string };
  specialty: string;
  lore: string;
}

/** Merged catalog: hand-authored base/signature items + generated lines. */
export const ITEM_LORE: Record<string, ItemLoreEntry> = {
  ...ITEM_LORE_BASE,
  ...ITEM_LORE_LINES,
  ...ITEM_LORE_EXPANSION,
};

/** Tier prefixes that the generator strips to map a generated id to its line. */
const TIER_PREFIXES = ["worn", "fine", "masterwork", "heroic", "mythic"];

/** Resolve the lore entry for any catalog id (base id, signature id, or a
 *  generated `${prefix}-${lineId}`). Returns null when no homage is authored. */
export function loreFor(id: string): ItemLoreEntry | null {
  if (ITEM_LORE[id]) return ITEM_LORE[id];
  const dash = id.indexOf("-");
  if (dash > 0 && TIER_PREFIXES.includes(id.slice(0, dash))) {
    const lineId = id.slice(dash + 1);
    return ITEM_LORE[lineId] ?? null;
  }
  return null;
}
