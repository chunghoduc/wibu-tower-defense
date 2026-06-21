// src/data/procCoefficient.ts
//
// Proc coefficient — the canonical balancing pattern for on-hit triggers (Risk of
// Rain 2). A faster attacker rolls its on-hit/on-crit procs MANY more times per
// second, which would trivialise an effect tuned for a normal-speed hit. So the
// effective trigger chance is scaled by a per-attacker coefficient derived from
// attack speed: a reference-speed attacker fires at the full listed chance, while
// a fast (attack-speed-capped) tower fires at a fraction of it. Per-second proc
// parity, not per-hit. Pure / Phaser-free so it is unit-testable.

/** Attack speed (atk/sec) that procs at the full listed chance (coefficient 1). */
export const PROC_REF_SPEED = 1.5;
/** Floor so even the fastest attacker keeps a meaningful share of its procs. */
export const PROC_MIN = 0.34;

/**
 * Multiplier in [PROC_MIN, 1] applied to an on-hit/on-crit trigger's chance.
 * At or below the reference speed it returns 1 (full chance). Above it returns
 * REF/speed, so a 2x faster attacker procs at half chance (same procs/second),
 * clamped to the floor. Non-positive or invalid speeds fall back to 1.
 */
export function procCoefficient(attackSpeed: number): number {
  if (!(attackSpeed > 0) || attackSpeed <= PROC_REF_SPEED) return 1;
  return Math.max(PROC_MIN, PROC_REF_SPEED / attackSpeed);
}
