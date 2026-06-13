/**
 * uiMotion — pure, Phaser-free motion math + shared timing tokens for the UI
 * smoothness layer. Kept dependency-free so it is unit-testable; the Phaser
 * presenters that consume it live in uiKit.ts.
 */

/** Shared motion-timing tokens (ms). */
export const MOTION = { popOut: 160, stagger: 40, staggerMax: 360 } as const;

export interface StaggerOpts {
  /** Ideal ms between consecutive items (default MOTION.stagger). */
  step?: number;
  /** Cap on the LAST item's delay (default MOTION.staggerMax). */
  maxTotal?: number;
  /** Delay before the first item (default 0). */
  from?: number;
}

/**
 * Per-index entrance delays (ms). When `(count-1)*step` would exceed `maxTotal`
 * the step is compressed so the last item still starts by `from + maxTotal`, so
 * a large grid assembles quickly instead of trickling in for seconds.
 */
export function staggerDelays(count: number, opts: StaggerOpts = {}): number[] {
  if (count <= 0) return [];
  const { step = MOTION.stagger, maxTotal = MOTION.staggerMax, from = 0 } = opts;
  if (count === 1) return [from];
  const span = (count - 1) * step;
  const effStep = span <= maxTotal ? step : maxTotal / (count - 1);
  return Array.from({ length: count }, (_, i) => from + i * effStep);
}
