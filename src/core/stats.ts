/**
 * Layered stat pipeline — Phase 3a.
 *
 * Stats flow through an accumulator with three buckets:
 *   final = (base + Σflat) × (1 + Σincreased%) × Π(1 + more%)
 *
 * - flat: level scaling, item base stats, primary affixes
 * - increased%: additive — most passive nodes and random affixes
 * - more%: multiplicative — reserved for ~5 powerful keystones
 *
 * Keeping bonuses additive within their bucket prevents runaway stacking.
 */
import { defaultStats, type PassiveNodeDef, type Stats } from "../data/schema.ts";

export interface StatAccumulator {
  flat: Partial<Stats>;
  increased: Partial<Stats>;
  more: Partial<Stats>[];
}

export function makeAcc(): StatAccumulator {
  return { flat: {}, increased: {}, more: [] };
}

export function addFlat(acc: StatAccumulator, s: Partial<Stats>): StatAccumulator {
  const flat = { ...acc.flat };
  for (const [k, v] of Object.entries(s) as [keyof Stats, number][]) {
    if (v !== undefined) flat[k] = (flat[k] ?? 0) + v;
  }
  return { ...acc, flat };
}

export function addIncreased(acc: StatAccumulator, s: Partial<Stats>): StatAccumulator {
  const increased = { ...acc.increased };
  for (const [k, v] of Object.entries(s) as [keyof Stats, number][]) {
    if (v !== undefined) increased[k] = (increased[k] ?? 0) + v;
  }
  return { ...acc, increased };
}

export function addMore(acc: StatAccumulator, s: Partial<Stats>): StatAccumulator {
  return { ...acc, more: [...acc.more, s] };
}

export function resolveAcc(base: Stats, acc: StatAccumulator): Stats {
  const result = { ...base };
  for (const key of Object.keys(base) as (keyof Stats)[]) {
    const b = base[key];
    const f = acc.flat[key] ?? 0;
    const i = acc.increased[key] ?? 0;
    let val = (b + f) * (1 + i);
    for (const moreEntry of acc.more) {
      const m = moreEntry[key];
      if (m !== undefined) val *= 1 + m;
    }
    (result as Record<keyof Stats, number>)[key] = val;
  }
  return result;
}

// Per-level flat stat growth for the hero
const HERO_LEVEL_FLAT_PER_LEVEL: Partial<Stats> = {
  atk: 2,
  maxHp: 15,
  armor: 0.3,
  magicResist: 0.3,
  maxMana: 1,
};

/**
 * Compute the hero's final pre-battle Stats from all persistent sources.
 *
 * @param base          Hero's base stats
 * @param level         Hero's current level
 * @param passiveNodes  Unlocked PassiveNodeDef entries
 * @param itemStats     rolledStats from each equipped ItemInstance (as Partial<Stats>[])
 * @param affixStats    Primary + random affix contributions (Partial<Stats>[])
 * @param keystoneMore  More-% contributions from keystone nodes only (or null)
 */
export function heroStatPipeline(
  base: Stats,
  level: number,
  passiveNodes: Pick<PassiveNodeDef, "flat" | "increased" | "more">[],
  itemStats: Partial<Stats>[],
  affixStats: Partial<Stats>[],
  keystoneMore: Partial<Stats>[] | null,
): Stats {
  let acc = makeAcc();

  // Layer 1 — level scaling (flat)
  const levelFlat: Partial<Stats> = {};
  for (const [k, v] of Object.entries(HERO_LEVEL_FLAT_PER_LEVEL) as [keyof Stats, number][]) {
    levelFlat[k] = v * (level - 1);
  }
  acc = addFlat(acc, levelFlat);

  // Layers 2–3 — item base stats + affix stats (flat)
  for (const s of itemStats) acc = addFlat(acc, s);
  for (const s of affixStats) acc = addFlat(acc, s);

  // Layer 4 — passive grid nodes
  for (const node of passiveNodes) {
    if (node.flat) acc = addFlat(acc, node.flat);
    if (node.increased) acc = addIncreased(acc, node.increased);
  }

  // Layer 5 — keystone more% multipliers
  for (const m of keystoneMore ?? []) acc = addMore(acc, m);

  return resolveAcc(base, acc);
}

// Per-level flat stat growth for towers
const TOWER_LEVEL_FLAT_PER_LEVEL: Partial<Stats> = {
  atk: 1.5,
  maxHp: 10,
};

const STAR_INCREASED_PER_STAR = 0.08;

export function towerStatPipeline(base: Stats, towerLevel: number, stars: number): Stats {
  let acc = makeAcc();

  // Layer 1 — level scaling (flat)
  const levelFlat: Partial<Stats> = {};
  for (const [k, v] of Object.entries(TOWER_LEVEL_FLAT_PER_LEVEL) as [keyof Stats, number][]) {
    levelFlat[k] = v * (towerLevel - 1);
  }
  acc = addFlat(acc, levelFlat);

  // Layer 2 — star bonus (increased%)
  if (stars > 0) {
    const starInc: Partial<Stats> = {};
    for (const k of Object.keys(base) as (keyof Stats)[]) {
      starInc[k] = STAR_INCREASED_PER_STAR * stars;
    }
    acc = addIncreased(acc, starInc);
  }

  return resolveAcc(base, acc);
}

// Suppress unused import warning — defaultStats is re-exported for consumers
// who want the canonical zero-baseline without importing schema directly.
export { defaultStats };
