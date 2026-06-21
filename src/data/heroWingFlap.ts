// src/data/heroWingFlap.ts
//
// Procedural wing-beat for the battle hero's worn wings. The wings are split into
// a LEFT and a RIGHT half (each a crop of the same back-view pair art) and pivoted
// at the spine, so this returns a real articulated flap — the two halves rotate up
// and down around the shoulders — instead of a crossfade between two static images
// (which only ever read as a morph/ghost, never a beat). Driven from the render
// clock so the wings never freeze if a scene's tweens are cleared.
// Pure / Phaser-free / deterministic — tested directly.

export interface WingFlap {
  /** 0 at the bottom of the beat (wings spread) → 1 at the top (wings raised). */
  rise: number;
  /**
   * Signed rotation for the LEFT wing half, in degrees. The right half uses the
   * mirror (`-beatDeg`). Spread/glide is the rest pose; the half sweeps UP through
   * the up-stroke. The numeric sign is mirrored again by the sprite's flipX when
   * the hero faces left.
   */
  beatDeg: number;
  /** Extra upward lift fraction (0..1), peaks at the top of the up-stroke. */
  lift: number;
  /** Horizontal squash — the span narrows a touch as the wings sweep up. */
  scaleX: number;
  /** Vertical stretch — the wings lengthen a touch as they sweep up. */
  scaleY: number;
}

const TAU = Math.PI * 2;
/** Rest (glide) pose of the left half: wings held high and spread over the back. */
const SPREAD_DEG = 8;
/** Bottom of the power-stroke: wings beat down for thrust (kept off the torso). */
const RAISED_DEG = -24;

/**
 * Flap state at `nowMs`. `periodMs` is one full beat (default 760ms ≈ a brisk
 * 1.3 Hz). The down-stroke is quick and the recovery slower (a skewed beat), which
 * reads more like a real wing than a pure sine.
 */
export function heroWingFlap(nowMs: number, periodMs = 760): WingFlap {
  const t = (((nowMs % periodMs) + periodMs) % periodMs) / periodMs; // 0..1, wraps safely
  // Skew the phase so the wings spend longer gliding/spread and snap up briskly.
  const skewed = t < 0.5 ? t * 0.7 : 0.35 + (t - 0.5) * 1.3;
  const rise = (1 - Math.cos(TAU * skewed)) / 2; // 0 → 1 → 0, smooth, asymmetric
  const beatDeg = SPREAD_DEG + (RAISED_DEG - SPREAD_DEG) * rise;
  return {
    rise,
    beatDeg,
    lift: rise,
    scaleX: 1 - rise * 0.06,
    scaleY: 1 + rise * 0.04,
  };
}
