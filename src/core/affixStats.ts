/**
 * Item affix → stat resolution. Each equipped item carries a rolled PRIMARY
 * affix plus 0–N rolled random affixes; these were previously stored but never
 * applied in battle. This module turns them into stat-pipeline contributions:
 *
 *  - Fractional/multiplier stats (crit, pen, %reductions, skillPower…) add FLAT
 *    — a rolled 0.12 means "+12% crit chance", "+0.12 skill power", etc.
 *  - Scalar stats (atk, maxHp, range, armor…) apply as INCREASED% — a rolled
 *    0.12 means "+12% attack", so it scales with the item/level base.
 *  - The non-stat primary types `physicalDamage`/`magicDamage` map to increased
 *    attack (the attack stat backs both; damage type only changes mitigation).
 */
import type { Stats } from "../data/schema.ts";
import { FRACTIONAL_STAT_KEYS } from "../data/schema.ts";
import type { HeroSave } from "./save.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";

/** Stat keys whose affix value is added FLAT (they are already fractions/multipliers). */
const FLAT_AFFIX_KEYS = FRACTIONAL_STAT_KEYS;

/** Primary-affix types that are not direct stat keys → (stat key, apply mode). */
const PRIMARY_AFFIX_MAP: Record<string, { key: keyof Stats; mode: "flat" | "increased" }> = {
  physicalDamage: { key: "atk", mode: "increased" },
  magicDamage: { key: "atk", mode: "increased" },
};

export interface AffixContribution {
  flat: Partial<Stats>[];
  increased: Partial<Stats>[];
}

function pushAffix(out: AffixContribution, type: string, value: number): void {
  const mapped = PRIMARY_AFFIX_MAP[type];
  if (mapped) {
    (mapped.mode === "flat" ? out.flat : out.increased).push({ [mapped.key]: value });
    return;
  }
  const key = type as keyof Stats;
  (FLAT_AFFIX_KEYS.has(key) ? out.flat : out.increased).push({ [key]: value });
}

/** Resolve all equipped items' primary + random affixes into flat/increased contributions. */
export function buildAffixStats(save: HeroSave): AffixContribution {
  const out: AffixContribution = { flat: [], increased: [] };
  for (const instanceId of Object.values(save.inventory.equipped)) {
    if (!instanceId) continue;
    const inst = save.inventory.items.find((it) => it.id === instanceId);
    if (!inst) continue;
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def) continue;
    pushAffix(out, def.primaryAffix.type, inst.rolledPrimaryAffix);
    for (const a of inst.rolledAffixes) pushAffix(out, a.type, a.value);
  }
  return out;
}
