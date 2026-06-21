/**
 * Per-box LEVEL.
 *
 * A loot box now carries a LEVEL, frozen when it drops. Three linked ranges make
 * up the design the player asked for — each step is "in a range, not exactly the
 * same" as the previous:
 *
 *   hero level ──±BOX_LEVEL_BAND──▶ box level ──±ITEM_LEVEL_BAND──▶ gear level
 *
 * and the box level ALSO scales how much stackable material (gold, diamonds,
 * bless jewels) the box pours out — a higher-level box is a richer box.
 *
 * Pure + deterministic (seeded {@link Rng}) so the same functions drive both the
 * runtime roll and the tests, and the two can never drift apart.
 */
import type { Rng } from "./rng.ts";
import { MAX_ITEM_REQ_LEVEL } from "../data/items.ts";

/** Box levels never exceed the hero level cap. */
export const MAX_BOX_LEVEL = 100;

/** A box's level sits within ±15% of the hero level it dropped for. */
export const BOX_LEVEL_BAND = 0.15;

/** A box's gear lands within ±10% of the BOX's level (not the hero's directly). */
export const ITEM_LEVEL_BAND = 0.1;

/**
 * Extra stackable-material quantity per box level above 1 (linear). A level-1
 * box pours its base amount (×1.0); a level-100 box pours ~2.5×. Anchored so
 * {@link boxLevelQtyMul}(1) === 1 — early boxes are unchanged, late boxes richer.
 */
export const LEVEL_QTY_PER_LEVEL = 0.015;

/** Round `center` after a symmetric ±`band` jitter, clamped to [lo, hi]. */
function spread(center: number, band: number, rng: Rng, lo: number, hi: number): number {
  const f = 1 - band + rng.next() * band * 2; // uniform in [1-band, 1+band)
  return Math.max(lo, Math.min(hi, Math.round(Math.max(1, center) * f)));
}

/** Roll a box's level from the hero level it dropped for (±{@link BOX_LEVEL_BAND}). */
export function rollBoxLevel(heroLevel: number, rng: Rng): number {
  return spread(heroLevel, BOX_LEVEL_BAND, rng, 1, MAX_BOX_LEVEL);
}

/** Roll one gear piece's required level from the box's level (±{@link ITEM_LEVEL_BAND}). */
export function rollItemLevelFromBox(boxLevel: number, rng: Rng): number {
  return spread(boxLevel, ITEM_LEVEL_BAND, rng, 1, MAX_ITEM_REQ_LEVEL);
}

/** Multiplier on a box's stackable-material payout for its level (≥1). */
export function boxLevelQtyMul(boxLevel: number): number {
  return 1 + LEVEL_QTY_PER_LEVEL * (Math.max(1, boxLevel) - 1);
}

/**
 * The [lo, hi] required-level band a hero-level's box gear can compound into —
 * a true superset of `rollItemLevelFromBox(rollBoxLevel(heroLevel))`. Used by the
 * UI/tests so the displayed band always contains every roll.
 */
export function boxItemLevelBounds(heroLevel: number): [number, number] {
  const h = Math.max(1, heroLevel);
  const lo = Math.max(
    1,
    Math.round(Math.round(h * (1 - BOX_LEVEL_BAND)) * (1 - ITEM_LEVEL_BAND)),
  );
  const hi = Math.min(
    MAX_ITEM_REQ_LEVEL,
    Math.round(Math.round(h * (1 + BOX_LEVEL_BAND)) * (1 + ITEM_LEVEL_BAND)),
  );
  return [lo, hi];
}
