/**
 * Pure adaptive-immunity math for Adapter enemies (e.g. the Prism Behemoth). The
 * enemy rotates which damage type it is immune to through `types`, switching every
 * `switchIntervalSec`. True damage and the off-type always land — never a hard
 * lock-and-key.
 */
import type { DamageType, EnemySpecial } from "../data/schema.ts";

/** The damage type the enemy is currently immune to for this phase index (null if not an Adapter). */
export function adaptiveImmuneType(special: EnemySpecial | undefined, phaseIndex: number): DamageType | null {
  const a = special?.adaptiveImmunity;
  if (!a || a.types.length === 0) return null;
  return a.types[phaseIndex % a.types.length];
}

/**
 * Advance the phase countdown by `dt`. Returns the new timer/index and whether a
 * switch occurred this step (so the caller can emit a telegraph). Crossing several
 * intervals in one big `dt` advances the index that many times.
 */
export function advanceAdaptivePhase(
  special: EnemySpecial | undefined,
  timer: number,
  index: number,
  dt: number,
): { timer: number; index: number; switched: boolean } {
  const a = special?.adaptiveImmunity;
  if (!a || a.types.length === 0) return { timer, index, switched: false };
  let t = timer - dt;
  let i = index;
  let switched = false;
  while (t <= 0) {
    t += a.switchIntervalSec;
    i = (i + 1) % a.types.length;
    switched = true;
  }
  return { timer: t, index: i, switched };
}
