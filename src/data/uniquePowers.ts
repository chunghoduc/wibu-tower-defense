// src/data/uniquePowers.ts
//
// Unique Powers — the PASSIVE "affix" half of a Unique-rarity item (the BEHAVIOUR
// half is data/uniqueTriggers.ts). Every Unique item carries one named stat power
// a Legendary can never have. Signature items keep a fixed power (their identity);
// every other Unique rolls its power PER INSTANCE from an archetype pool, seeded by
// the instance id — so two copies of the same procedural Unique can grant different
// powers. Derived from id (not stored), so existing copies resolve with zero save
// migration.
//
// A power contributes to the hero stat pipeline through the SAME three buckets the
// affix/passive systems use (see core/uniquePowerStats.ts):
//   - flat       added to the base stat       (fractional stats: crit, omnivamp…)
//   - increased  additive   (1 + Σi)          (scalar % bonuses)
//   - more       multiplicative  Π(1 + m)     (THE distinction — only keystones,
//                                              Unique jewels, and these grant it)
// Pure / Phaser-free so the catalog + assignment can be unit-tested.

import type { Stats } from "./schema.ts";
import { archetypeFor, type ItemArchetype } from "./itemArchetype.ts";

/** What the game knows when resolving a power's magnitude (battle-start statics). */
export interface UniquePowerContext {
  /** Number of equipped Unique items (incl. the one carrying this power). */
  uniqueCount: number;
}

export interface UniquePowerContribution {
  flat?: Partial<Stats>;
  increased?: Partial<Stats>;
  more?: Partial<Stats>;
}

export interface UniquePowerDef {
  id: string;
  name: string;
  /** Player-facing one-liner with magnitudes embedded; ctx lets count-scaled powers read true. */
  describe(ctx: UniquePowerContext): string;
  contribution(ctx: UniquePowerContext): UniquePowerContribution;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ── The catalog ─────────────────────────────────────────────────────────────
// Magnitudes are deliberately conservative: `more` stacks multiplicatively on
// top of every other source, and 60% of the hero's stats are shared to towers.

export const UNIQUE_POWERS: Record<string, UniquePowerDef> = {
  // — Signatures (hand-authored items) —
  sunflare: {
    id: "sunflare",
    name: "Sunflare",
    describe: () => `+${pct(0.18)} more Attack and +${pct(0.25)} Critical Damage`,
    contribution: () => ({ more: { atk: 0.18 }, flat: { critDamage: 0.25 } }),
  },
  bulwark: {
    id: "bulwark",
    name: "Aegis Bulwark",
    describe: () => `+${pct(0.2)} more Max Health and +${pct(0.08)} Damage Reduction`,
    contribution: () => ({ more: { maxHp: 0.2 }, flat: { damageReduction: 0.08 } }),
  },
  midas: {
    id: "midas",
    name: "Midas Touch",
    describe: () => `+${pct(0.5)} more Gold Found`,
    contribution: () => ({ more: { goldFind: 0.5 } }),
  },

  // — Archetype pool (procedural Uniques) —
  bloodthirst: {
    id: "bloodthirst",
    name: "Bloodthirst",
    describe: () => `Heals ${pct(0.12)} of damage dealt (lifesteal)`,
    contribution: () => ({ flat: { omnivamp: 0.12 } }),
  },
  deadeye: {
    id: "deadeye",
    name: "Deadeye",
    describe: () => `+${pct(0.3)} Critical Damage and ignores ${pct(0.15)} of enemy Armor`,
    contribution: () => ({ flat: { critDamage: 0.3, armorPen: 0.15 } }),
  },
  warlord: {
    id: "warlord",
    name: "Warlord's Aura",
    describe: (ctx) =>
      `+${pct(0.08)} more Attack per Unique equipped (currently +${pct(0.08 * ctx.uniqueCount)})`,
    contribution: (ctx) => ({ more: { atk: 0.08 * Math.max(1, ctx.uniqueCount) } }),
  },
  juggernaut: {
    id: "juggernaut",
    name: "Juggernaut",
    describe: () => `+${pct(0.2)} more Max Health and +${pct(0.15)} Tenacity`,
    contribution: () => ({ more: { maxHp: 0.2 }, flat: { tenacity: 0.15 } }),
  },
  arcane_overflow: {
    id: "arcane_overflow",
    name: "Arcane Overflow",
    describe: () => `+${pct(0.25)} more Skill Power and +6 Mana on Hit`,
    contribution: () => ({ more: { skillPower: 0.25 }, flat: { manaOnHit: 6 } }),
  },
  spellweave: {
    id: "spellweave",
    name: "Spellweave",
    describe: () => `+${pct(0.2)} more Skill Power and ignores ${pct(0.15)} of Magic Resist`,
    contribution: () => ({ more: { skillPower: 0.2 }, flat: { magicPen: 0.15 } }),
  },
  tempest: {
    id: "tempest",
    name: "Tempest",
    describe: () => `+${pct(0.06)} Attack Speed and +${pct(0.3)} more Move Speed`,
    contribution: () => ({ flat: { attackSpeed: 0.06 }, more: { moveSpeed: 0.3 } }),
  },
  colossus: {
    id: "colossus",
    name: "Colossus",
    describe: () => `+${pct(0.12)} more Attack and +${pct(0.12)} more Max Health`,
    contribution: () => ({ more: { atk: 0.12, maxHp: 0.12 } }),
  },
  bastion: {
    id: "bastion",
    name: "Bastion",
    describe: () => `+${pct(0.2)} more Magic Resist and +${pct(0.1)} Damage Reduction`,
    contribution: () => ({ more: { magicResist: 0.2 }, flat: { damageReduction: 0.1 } }),
  },
  fortune: {
    id: "fortune",
    name: "Fortune's Favor",
    describe: () => `+${pct(0.4)} more Gold Found`,
    contribution: () => ({ more: { goldFind: 0.4 } }),
  },
};

/** Hand-authored items → their signature power id. */
export const SIGNATURE_POWERS: Record<string, string> = {
  dawnbreaker: "sunflare",
  "aegis-of-dawn": "bulwark",
  "midas-paw": "midas",
};

/** Per-archetype stat-power pool for procedural Uniques (instance-hash picks within). */
const ARCHETYPE_POWERS: Record<ItemArchetype, string[]> = {
  physical: ["deadeye", "bloodthirst", "warlord", "colossus"],
  magic: ["arcane_overflow", "spellweave"],
  defense: ["juggernaut", "bulwark", "bastion"],
  utility: ["tempest", "fortune"],
  hybrid: ["colossus", "warlord", "deadeye"],
};

/** Stable non-negative string hash (FNV-1a) — deterministic power selection. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let k = 0; k < id.length; k++) {
    h ^= id.charCodeAt(k);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The Unique Power of an item, or `null` for any non-Unique item. Signature items
 * use their authored power; every other Unique draws from its archetype pool by a
 * hash of `instanceId` (so copies vary) — or, with no instance id (a bare def
 * preview), by the def id for a stable default.
 */
export function uniquePowerFor(
  def: {
    id: string;
    rarity: string;
    primaryAffix: { type: string };
    archetype?: ItemArchetype;
  },
  instanceId?: string,
): UniquePowerDef | null {
  if (def.rarity !== "Unique") return null;
  const signature = SIGNATURE_POWERS[def.id];
  if (signature) return UNIQUE_POWERS[signature];
  const pool = ARCHETYPE_POWERS[archetypeFor(def)] ?? ARCHETYPE_POWERS.hybrid;
  const seed = instanceId && instanceId.length > 0 ? instanceId : def.id;
  return UNIQUE_POWERS[pool[hashId(seed) % pool.length]];
}
