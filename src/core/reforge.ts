/**
 * Reforge / Affix Reroll — re-roll a Rare+ item's affixes for gold + Jewel of
 * Entropy. The affix re-roll uses the exact same logic as a fresh drop
 * (items.rollAffixes), so a reforged item is statistically identical to a freshly
 * rolled one of the same rarity. Only the SECONDARY affixes change; the primary
 * affix, base stats, enhance level, required level and Apex flag are the item's
 * identity and are left untouched.
 *
 * Cost rises with TWO axes:
 *   - rarity: a higher-rarity item has more affixes worth chasing (and smelts into
 *     more entropy), so it costs more to re-roll.
 *   - this item's reroll count: each successive re-roll of the SAME item costs more
 *     entropy (and gold), so chasing a perfect roll is a real, rising sink. The
 *     ramp is capped at REROLL_RAMP_CAP so a heavily-chased item stays
 *     expensive-but-possible rather than runaway.
 *
 * At count 0 the cost equals the historical flat reforge price exactly (no balance
 * regression for the first re-roll). Entropy is the headline cost; gold is the
 * secondary sink (reforge is the gold sink that selling used to be).
 *
 * Pure mutations on HeroSave; SaveManager wraps them with persistence + events.
 */
import type { HeroSave } from "./save.ts";
import type { Rarity } from "../data/schema.ts";
import type { Rng } from "./rng.ts";
import { ITEM_CATALOG_MAP, rollAffixes, APEX_STAT_MULT } from "../data/items.ts";
import { CHAOS_JEWEL } from "../data/materials.ts";

export interface ReforgeCost {
  gold: number;
  /** Jewels of Entropy (material id `chaos-jewel`). */
  entropy: number;
}

/** Per-rarity baseline (count 0) + per-reroll escalation. Common/Magic are absent
 *  — they aren't reforge-able. */
const REFORGE_BASE: Partial<Record<Rarity, { gold: number; entropy: number; step: number }>> = {
  Rare: { gold: 400, entropy: 3, step: 2 }, // ≈ smelting one Rare (4 entropy)
  Legendary: { gold: 900, entropy: 6, step: 3 }, // ≈ smelting one Legendary partway
  Unique: { gold: 2000, entropy: 10, step: 5 }, // a Unique smelts to 16 → ~1.6 first re-rolls
};

/** The reroll-count after which the price stops climbing. */
export const REROLL_RAMP_CAP = 10;
/** Gold grows 35% of its base per prior reroll (entropy grows by a flat step). */
const GOLD_RAMP = 0.35;

/**
 * Cost to reforge an item of `rarity` that has already been rerolled `rerollCount`
 * times (0 for a fresh item). Returns null for non-reforge-able rarities.
 */
export function reforgeCost(rarity: Rarity, rerollCount = 0): ReforgeCost | null {
  const base = REFORGE_BASE[rarity];
  if (!base) return null;
  const n = Math.min(Math.max(0, rerollCount), REROLL_RAMP_CAP);
  return {
    gold: Math.round(base.gold * (1 + GOLD_RAMP * n)),
    entropy: base.entropy + base.step * n,
  };
}

/** Only Rare and above carry enough affixes to be worth re-rolling. */
export function canReforge(rarity: Rarity): boolean {
  return REFORGE_BASE[rarity] !== undefined;
}

export interface ReforgeResult {
  ok: boolean;
  reason?: "no-item" | "not-eligible" | "no-gold" | "no-entropy";
}

/**
 * Re-roll one inventory item's secondary affixes, consuming gold + entropy that
 * scale with the item's current reroll count, then increment that count. Works on
 * equipped items too (like enhance) since the item itself is never removed. Mutates
 * `save`; deterministic given `rng`.
 */
export function reforgeItem(save: HeroSave, instanceId: string, rng: Rng): ReforgeResult {
  const inst = save.inventory.items.find((it) => it.id === instanceId);
  if (!inst) return { ok: false, reason: "no-item" };
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  if (!def) return { ok: false, reason: "no-item" };
  const cost = reforgeCost(def.rarity, inst.rerollCount ?? 0);
  if (!cost) return { ok: false, reason: "not-eligible" };
  if ((save.currency.gold ?? 0) < cost.gold) return { ok: false, reason: "no-gold" };
  if ((save.materials[CHAOS_JEWEL] ?? 0) < cost.entropy) return { ok: false, reason: "no-entropy" };

  save.currency.gold -= cost.gold;
  save.materials[CHAOS_JEWEL] -= cost.entropy;
  const apexMult = inst.apex ? APEX_STAT_MULT : 1;
  inst.rolledAffixes = rollAffixes(def, rng, apexMult);
  inst.rerollCount = (inst.rerollCount ?? 0) + 1;
  return { ok: true };
}
