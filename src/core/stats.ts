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
import {
  defaultStats,
  FRACTIONAL_STAT_KEYS,
  type PassiveNodeDef,
  type Stats,
  type TowerRole,
} from "../data/schema.ts";
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
};

/** Level at which the neutral crit-chance growth reaches its cap. */
const HERO_CRIT_CAP_LEVEL = 90;
/** The capped neutral crit chance (reached at HERO_CRIT_CAP_LEVEL). */
const HERO_CRIT_CAP = 0.3;

/**
 * The hero's *neutral* crit chance from leveling alone: 0% at level 1, ramping
 * linearly to the 30% cap at level 90 and held there beyond. This is the growth
 * stat every hero gets for free — items, kills and passives add ON TOP of it
 * (as flat critRate), so the effective crit can exceed 30%. Crit *damage* is a
 * separate fixed 150% base that only gear/passives raise.
 */
export function heroBaseCritRate(level: number): number {
  const t = (level - 1) / (HERO_CRIT_CAP_LEVEL - 1);
  return HERO_CRIT_CAP * Math.min(1, Math.max(0, t));
}

/**
 * Gather the multiplicative more% bags from a hero's allocated passive nodes.
 * heroStatPipeline deliberately skips `node.more` (Layer 4), so the caller passes
 * the result back in as the `keystoneMore` argument. Any node that declares a
 * `more` bag is included — not just keystones: gating on `type === "keystone"`
 * silently dropped notable/gate nodes (e.g. the prestige Transcendent Gate's
 * +15% more ATK), so their multiplier never reached the hero.
 */
export function collectPassiveMore(nodes: Pick<PassiveNodeDef, "more">[]): Partial<Stats>[] {
  const out: Partial<Stats>[] = [];
  for (const node of nodes) if (node.more) out.push(node.more);
  return out;
}

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
  // Neutral crit-chance growth: 0% → 30% across levels 1..90, then capped.
  // Added as flat so gear/kill/passive critRate stacks on top of it.
  levelFlat.critRate = (levelFlat.critRate ?? 0) + heroBaseCritRate(level);
  acc = addFlat(acc, levelFlat);

  // Layers 2–3 — item base stats + affix stats (flat)
  for (const s of itemStats) acc = addFlat(acc, s);
  for (const s of affixStats) acc = addFlat(acc, s);

  // Layer 4 — passive grid nodes (flat + increased only; more% via keystoneMore param)
  for (const node of passiveNodes) {
    if (node.flat) acc = addFlat(acc, node.flat);
    if (node.increased) {
      // Fractional stats (crit, pen, %reductions, skillPower, omnivamp…) are
      // absolute fractions sitting on a ~0 base — a node's "+8% crit" means
      // +0.08, not "the tiny base ×1.08". Routing them through increased% would
      // multiply near-zero and apply almost nothing, so split a node's increased
      // bag: fractional keys add FLAT (matching how item affixes resolve them —
      // see affixStats.ts), scalar keys (atk, maxHp, moveSpeed…) stay increased%.
      const fracFlat: Partial<Stats> = {};
      const scalarInc: Partial<Stats> = {};
      for (const [k, v] of Object.entries(node.increased) as [keyof Stats, number][]) {
        if (v === undefined) continue;
        (FRACTIONAL_STAT_KEYS.has(k) ? fracFlat : scalarInc)[k] = v;
      }
      acc = addFlat(acc, fracFlat);
      acc = addIncreased(acc, scalarInc);
    }
    // node.more is intentionally skipped — caller extracts keystone more% into keystoneMore
  }

  // Layer 5 — keystone more% multipliers
  for (const m of keystoneMore ?? []) acc = addMore(acc, m);

  return resolveAcc(base, acc);
}

/** Fraction of the hero's resolved stats that flows into each tower they command. */
export const HERO_TOWER_SHARE = 0.6;

/**
 * Add a share of the hero's resolved stats onto a tower's resolved stats — the
 * hero's level, items and passives empower every tower they command. Each stat
 * contributes `rate × (heroStat − neutral baseline)`.
 *
 * Subtracting the baseline (defaultStats) is what keeps multiplier stats sane:
 * critDamage sits on a 1.5 base and skillPower on 1.0, so a hero with no crit-
 * damage/skill gear shares 0 of them rather than dumping +0.9 / +0.6 onto every
 * tower. Every other stat has a 0 baseline, so they share the plain `rate ×
 * heroStat`. moveSpeed AND range are excluded — both are positional: a tower is
 * static, so neither the hero's movement nor the hero's weapon reach may bleed
 * into it. (range is a tower's identity stat; letting a long-reach hero weapon
 * add ~0.6×reach made towers fire far beyond their drawn range indicator.)
 */
export function addHeroShare(towerStats: Stats, heroStats: Stats, rate = HERO_TOWER_SHARE): Stats {
  const baseline = defaultStats();
  const out = { ...towerStats };
  for (const k of Object.keys(out) as (keyof Stats)[]) {
    if (k === "moveSpeed" || k === "range") continue;
    out[k] = out[k] + (heroStats[k] - baseline[k]) * rate;
  }
  return out;
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
const STAR_STEP = [0, 0, 0.08, 0.14, 0.2, 0.26];

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
