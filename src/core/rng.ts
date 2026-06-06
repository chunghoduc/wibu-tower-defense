/**
 * Deterministic, seedable RNG (mulberry32). The battle simulation uses this for
 * every random decision (crit rolls, spawn jitter) so a battle is fully
 * reproducible and unit-testable from a seed.
 */
export class Rng {
  private state: number;

  constructor(seed = 1) {
    // Avoid a zero state, which would lock mulberry32 to a degenerate stream.
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** True with probability p (clamped to [0, 1]). */
  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }
}
