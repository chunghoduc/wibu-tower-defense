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
import { defaultStats, type PassiveNodeDef, type Stats, type TowerRole } from "../data/schema.ts";
import { upgradeIncreased } from "./towerUpgrade.ts";

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
 * @param passiveNodes  Unlocked PassiveNodeDef entries. Only flat and increased% are applied
 *                      here; if a node has a more% bonus (keystones only), the caller must
 *                      extract it into the keystoneMore parameter — it is intentionally not
 *                      read from passiveNodes to keep keystone handling explicit.
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

  // Layer 4 — passive grid nodes (flat + increased only; more% via keystoneMore param)
  for (const node of passiveNodes) {
    if (node.flat) acc = addFlat(acc, node.flat);
    if (node.increased) acc = addIncreased(acc, node.increased);
    // node.more is intentionally skipped — caller extracts keystone more% into keystoneMore
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

// Star ascension increased%. Each star-up grants a BIGGER bonus than the last —
// +8% / +14% / +20% / +26% for reaching ★2..★5 — so the higher a tower's star,
// the more stats each upgrade gives. STAR_STEP[s] = the bonus added by REACHING
// star s. Cumulative by tier: ★1 0% · ★2 8% · ★3 22% · ★4 42% · ★5 68%.
const STAR_STEP = [0, 0, 0.08, 0.14, 0.20, 0.26];

/** Total star "increased%" a tower has at the given star tier. */
export function starIncreasedPct(stars: number): number {
  let total = 0;
  for (let s = 2; s <= stars && s < STAR_STEP.length; s++) total += STAR_STEP[s];
  return total;
}

/** The increased% the NEXT star-up will add (0 if already maxed). */
export function starUpStepPct(stars: number): number {
  return STAR_STEP[stars + 1] ?? 0;
}

/**
 * Tower final stats. `towerLevel` is the collection/hero-driven base level (flat
 * growth) and `stars` the collection star tier (increased%). `role` + `battleLevel`
 * drive the in-battle upgrade emphasis (T12): a general bump plus role-specific
 * increased% per purchased star. Behavior scaling is separate (effectiveBehavior).
 */
export function towerStatPipeline(
  base: Stats,
  towerLevel: number,
  stars: number,
  role?: TowerRole,
  battleLevel = 0,
): Stats {
  let acc = makeAcc();

  // Layer 1 — level scaling (flat)
  const levelFlat: Partial<Stats> = {};
  for (const [k, v] of Object.entries(TOWER_LEVEL_FLAT_PER_LEVEL) as [keyof Stats, number][]) {
    levelFlat[k] = v * (towerLevel - 1);
  }
  acc = addFlat(acc, levelFlat);

  // Layer 2 — star bonus (increased%), with a per-star step that grows by tier
  const starPct = starIncreasedPct(stars);
  if (starPct > 0) {
    const starInc: Partial<Stats> = {};
    for (const k of Object.keys(base) as (keyof Stats)[]) {
      starInc[k] = starPct;
    }
    acc = addIncreased(acc, starInc);
  }

  // Layer 3 — in-battle upgrade emphasis (general + role), increased%
  if (role && battleLevel > 0) {
    acc = addIncreased(acc, upgradeIncreased(role, battleLevel));
  }

  return resolveAcc(base, acc);
}

// Suppress unused import warning — defaultStats is re-exported for consumers
// who want the canonical zero-baseline without importing schema directly.
export { defaultStats };
