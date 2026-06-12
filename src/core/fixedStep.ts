/**
 * Fixed-timestep accumulator ("Fix Your Timestep"). The battle sim always ticks
 * in SIM_STEP increments — the SAME discretization the test suite uses — so
 * production behavior is exactly what the tests verify, independent of frame
 * rate. The leftover fraction (`alpha`) lets the renderer interpolate entity
 * positions between the previous and current sim states.
 */
export const SIM_STEP = 0.05; // s — the canonical test-suite tick

export class FixedStepper {
  private acc = 0;

  constructor(
    private readonly step = SIM_STEP,
    /** Catch-up cap per frame; whole-step excess beyond it is dropped (spiral-of-death guard). */
    private readonly maxSteps = 5,
  ) {}

  /** Feed a frame's elapsed seconds (already speed-scaled); returns whole steps to run. */
  advance(dt: number): number {
    if (dt > 0) this.acc += dt;
    const owed = Math.floor(this.acc / this.step);
    const steps = Math.min(owed, this.maxSteps);
    this.acc = steps === this.maxSteps ? this.acc % this.step : this.acc - steps * this.step;
    return steps;
  }

  /** Fraction of a step accumulated but not yet simulated — render interpolation factor [0,1). */
  get alpha(): number {
    return this.acc / this.step;
  }

  reset(): void {
    this.acc = 0;
  }
}
