// Pure (Phaser-free) procedural walk math for a single-frame enemy sprite.
// One source of truth for the gait amplitudes so the sprite transform and the
// ground-contact shadow can never drift out of sync.

/** Per-frame transform deltas for a walking enemy, derived from a gait phase. */
export interface WalkTransform {
  /** Vertical body bob in px (<=0; negative = lifted off the ground). */
  yOff: number;
  /** Lateral weight-shift waddle in px. */
  xOff: number;
  /** Body rock in degrees (+ caller lean). */
  angle: number;
  /** Multiply the sprite's base scale on X (stretch on foot-plant). */
  scaleMulX: number;
  /** Multiply the sprite's base scale on Y (squash on foot-plant). */
  scaleMulY: number;
  /** 0 (foot planted) .. 1 (peak of the bob); drives the shadow, amp-independent. */
  liftNorm: number;
}

export interface WalkOpts {
  /** Amplitude factor (bosses heavier → smaller, ~0.6); default 1. */
  amp?: number;
  /** Extra degrees added to angle for "lean into travel"; default 0. */
  lean?: number;
}

// Baked walk frames (enemyWalkBake.ts) now carry the vertical step + leg motion,
// so the procedural layer only adds a faint weight-shift on top — otherwise the
// body double-bobs over the frame motion.
const BOB = 1.5;     // was 5 — frames carry the step; keep a faint settle
const WADDLE = 1.5;  // lateral sway (px)
const ROCK = 1.5;    // was 4 — frames carry the body rock; keep a faint rock
const SQUASH = 0.06; // was 0.12 — lighter contact squash over the frame motion
const STRETCH = 0.04; // was 0.08

export function enemyWalkTransform(phase: number, opts: WalkOpts = {}): WalkTransform {
  const amp = opts.amp ?? 1;
  const lean = opts.lean ?? 0;
  const s = Math.sin(phase);
  const swing = Math.abs(s); // 0 at foot-plant, 1 mid-swing
  const plant = 1 - swing;   // weight settling on the planted foot
  return {
    yOff: -swing * BOB * amp,
    xOff: s * WADDLE * amp,
    angle: -Math.cos(phase) * ROCK * amp + lean,
    scaleMulX: 1 + STRETCH * plant * amp,
    scaleMulY: 1 - SQUASH * plant * amp,
    liftNorm: swing,
  };
}
