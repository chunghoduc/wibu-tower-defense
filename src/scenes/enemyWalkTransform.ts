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

// Enemies are a SINGLE static SDXL sprite — there are NO baked/authored walk
// frames (the old multi-frame warp bake was removed: it produced near-identical
// frames AND its wide canvas could flash as a strip). So this transform IS the
// whole walk: it must carry the full step. Amplitudes are sized to read as a
// lively, weighty stride at a 44px enemy, not a faint settle.
const BOB = 5; // vertical step — the body clearly lifts between footfalls
const WADDLE = 2.5; // lateral weight-shift sway (px)
const ROCK = 4; // body rock toward the planted side (deg)
const SQUASH = 0.12; // contact squash on the foot-plant
const STRETCH = 0.08; // anticipation stretch on the foot-plant

export function enemyWalkTransform(phase: number, opts: WalkOpts = {}): WalkTransform {
  const amp = opts.amp ?? 1;
  const lean = opts.lean ?? 0;
  const s = Math.sin(phase);
  const swing = Math.abs(s); // 0 at foot-plant, 1 mid-swing
  const plant = 1 - swing; // weight settling on the planted foot
  return {
    yOff: -swing * BOB * amp,
    xOff: s * WADDLE * amp,
    angle: -Math.cos(phase) * ROCK * amp + lean,
    scaleMulX: 1 + STRETCH * plant * amp,
    scaleMulY: 1 - SQUASH * plant * amp,
    liftNorm: swing,
  };
}
