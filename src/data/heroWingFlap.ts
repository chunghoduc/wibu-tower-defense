// src/data/heroWingFlap.ts
//
// Procedural flap motion for the battle hero's two-frame worn wings. Returns the
// crossfade alphas for the down/up frames plus subtle transform multipliers that
// sell a real wing-beat (the wings rise, narrow and stretch at the top of the
// stroke) rather than a single static image rotated back and forth. Driven from
// the render clock so the wings never freeze if a scene's tweens are cleared.
// Pure / Phaser-free / deterministic — tested directly.

export interface WingFlap {
  /** 0 at the bottom of the beat → 1 at the top of the up-stroke → 0. */
  rise: number;
  /** Alpha for the raised/up frame (0..1). upAlpha + downAlpha === 1. */
  upAlpha: number;
  /** Alpha for the swept-down/glide frame (0..1). */
  downAlpha: number;
  /** Horizontal display multiplier — wings narrow slightly at the top of the beat. */
  scaleX: number;
  /** Vertical display multiplier — wings stretch slightly at the top of the beat. */
  scaleY: number;
  /** Small banking sway in degrees, for life. */
  swayDeg: number;
}

const TAU = Math.PI * 2;

/**
 * Flap state at `nowMs`. `periodMs` is one full beat (default ~900ms ≈ a graceful
 * 1.1 Hz). The crossfade is sharpened so the wings spend most of the cycle reading
 * as a clean down or up pose and only blend briefly through the middle.
 */
export function heroWingFlap(nowMs: number, periodMs = 900): WingFlap {
  const t = (((nowMs % periodMs) + periodMs) % periodMs) / periodMs; // 0..1, wraps safely
  const rise = (1 - Math.cos(TAU * t)) / 2; // 0 → 1 → 0, smooth
  // Push the crossfade toward the endpoints so mid-beat ghosting is brief.
  const upAlpha = Math.max(0, Math.min(1, (rise - 0.5) * 2 + 0.5));
  return {
    rise,
    upAlpha,
    downAlpha: 1 - upAlpha,
    scaleX: 1 - rise * 0.08,
    scaleY: 1 + rise * 0.05,
    swayDeg: Math.sin(TAU * t) * 2,
  };
}
