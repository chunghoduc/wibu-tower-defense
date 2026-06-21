// src/data/uniqueTriggers.ts
//
// Per-INSTANCE triggered-effect roll. A Unique item's behaviour (its on-event
// proc) is no longer fixed by the ItemDef — each rolled copy picks one effect
// from a pool SUITABLE for that item, seeded by the instance's stable id. So two
// Dawnbreakers can proc different things, while both stay on-theme.
//
// Pure / Phaser-free: pools reference catalog keys and the roll is a deterministic
// hash, so the whole assignment is unit-testable. Zero save migration — the seed
// is the instance id that already exists on every owned item; an item with no
// instance id (a bare def, e.g. a tooltip preview) falls back to the def id.

import { archetypeFor, type ItemArchetype } from "./itemArchetype.ts";
import { TRIGGERED_EFFECTS, type TriggeredEffect } from "./triggeredEffects.ts";

/** Trigger keys suitable for each build archetype (a mix across events). */
export const TRIGGER_POOLS: Record<ItemArchetype, string[]> = {
  physical: [
    "executioner",
    "cull",
    "shatterblow",
    "deepwound",
    "detonate",
    "overkiller",
    "timewarp",
  ],
  magic: [
    "stormcaller",
    "venomstrike",
    "pyreburst",
    "cinderbloom",
    "castfrost",
    "echo",
    "contagion",
  ],
  defense: ["thornmail", "riposte", "glaciate", "painnova", "bloodfeast", "frostnova"],
  utility: ["goldfinger", "permafrost", "timewarp", "frostnova", "soulrend", "contagion"],
  hybrid: ["executioner", "stormcaller", "detonate", "frostnova", "deepwound", "echo", "painnova"],
};

/** Curated pools for hand-authored signature items — stays on-theme, still varies. */
export const SIGNATURE_TRIGGER_POOLS: Record<string, string[]> = {
  // radiant sun blade — execute / burn / burst
  dawnbreaker: ["executioner", "cull", "deepwound", "pyreburst", "shatterblow"],
  // holy aegis — retaliation / freeze
  "aegis-of-dawn": ["thornmail", "glaciate", "painnova", "riposte", "frostnova"],
  // greed — gold / sustain / spread
  "midas-paw": ["goldfinger", "overkiller", "soulrend", "contagion"],
};

/** Stable non-negative string hash (FNV-1a) — deterministic per-instance pick. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let k = 0; k < id.length; k++) {
    h ^= id.charCodeAt(k);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The pool of trigger keys an item draws from (signature override, else archetype). */
export function triggerPoolFor(def: {
  id: string;
  primaryAffix: { type: string };
  archetype?: ItemArchetype;
}): string[] {
  return (
    SIGNATURE_TRIGGER_POOLS[def.id] ?? TRIGGER_POOLS[archetypeFor(def)] ?? TRIGGER_POOLS.hybrid
  );
}

/**
 * The triggered effect a specific Unique instance carries, or `null` for any
 * non-Unique item. The pool is fixed by the item (suitability); the pick within
 * it is hashed from `instanceId` so each rolled copy is deterministic yet copies
 * differ. Without an instance id (a bare def preview) the def id seeds a stable
 * default.
 */
export function rollTrigger(
  def: { id: string; rarity: string; primaryAffix: { type: string }; archetype?: ItemArchetype },
  instanceId?: string,
): TriggeredEffect | null {
  if (def.rarity !== "Unique") return null;
  const pool = triggerPoolFor(def);
  if (pool.length === 0) return null;
  const seed = instanceId && instanceId.length > 0 ? instanceId : def.id;
  return TRIGGERED_EFFECTS[pool[hashId(seed) % pool.length]] ?? null;
}
