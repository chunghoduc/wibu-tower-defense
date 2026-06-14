/**
 * Formats the in-battle wave readout. Campaign stages have a fixed wave count, so
 * the denominator is `total`. Endless is infinite — there is no fixed target — so
 * the denominator is the player's highest wave achieved on this stage; once the
 * current wave passes that record the two numbers are identical (e.g. "Wave 23/23").
 */
export interface WaveCounterInput {
  /** True for endless survival; false for campaign / other modes. */
  endless: boolean;
  /** 1-based current wave, i.e. `Math.max(0, waveIndex + 1)`. */
  current: number;
  /** Campaign denominator (`stage.waves.length`); ignored in endless. */
  total: number;
  /** Stored historical best endless wave for this stage; ignored in campaign. */
  best: number;
}

export function waveCounterLabel(i: WaveCounterInput): string {
  const denom = i.endless ? Math.max(i.best, i.current) : i.total;
  return `Wave ${i.current}/${denom}`;
}
