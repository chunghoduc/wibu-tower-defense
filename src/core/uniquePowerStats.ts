// src/core/uniquePowerStats.ts
//
// Resolve the hero's equipped Unique Powers into stat-pipeline contributions.
// Mirrors core/affixStats.ts: it walks the equipped items, looks up each one's
// Unique Power (from its def — see data/uniquePowers.ts), and accumulates the
// flat / increased / more buckets. resolveHeroBattleStats folds these into the
// SAME pipeline buckets the affix and passive systems already use.

import type { Stats } from "../data/schema.ts";
import type { HeroSave } from "./save.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { uniquePowerFor } from "../data/uniquePowers.ts";

export interface UniquePowerStats {
  flat: Partial<Stats>[];
  increased: Partial<Stats>[];
  more: Partial<Stats>[];
}

/** Equipped items that resolve to a Unique Power, keeping the instance id. The id
 *  seeds the per-instance power/trigger roll, so two copies can differ. */
export function equippedUniqueInstances(save: HeroSave) {
  const out: { def: ReturnType<typeof ITEM_CATALOG_MAP.get>; instanceId: string }[] = [];
  for (const instanceId of Object.values(save.inventory.equipped)) {
    if (!instanceId) continue;
    const inst = save.inventory.items.find((it) => it.id === instanceId);
    if (!inst) continue;
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def) continue;
    if (uniquePowerFor(def, inst.id)) out.push({ def, instanceId: inst.id });
  }
  return out;
}

/**
 * Build the hero's Unique-Power contributions. The context's `uniqueCount` is
 * the number of equipped Unique items, so count-scaled powers (Warlord) read
 * the whole loadout consistently.
 */
export function buildUniquePowerStats(save: HeroSave): UniquePowerStats {
  const out: UniquePowerStats = { flat: [], increased: [], more: [] };
  const insts = equippedUniqueInstances(save);
  const ctx = { uniqueCount: insts.length };
  for (const { def, instanceId } of insts) {
    const power = def ? uniquePowerFor(def, instanceId) : null;
    if (!power) continue;
    const c = power.contribution(ctx);
    if (c.flat) out.flat.push(c.flat);
    if (c.increased) out.increased.push(c.increased);
    if (c.more) out.more.push(c.more);
  }
  return out;
}
