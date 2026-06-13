// src/core/gesture.ts
//
// Pure gesture physics & constants shared across the input layer. No Phaser, no
// Date.now/Math.random — time is always passed in. The scene presenters
// (scrollDrag.ts, battleCamera.ts, battleSceneInput.ts) consume these so tap-vs-
// drag and list momentum behave identically everywhere.

/** Pointer travel (px) past which a press is a drag, not a tap. One source of
 *  truth across battle tap, list scroll, and camera pan. */
export const TAP_SLOP_PX = 8;

/** Exponential friction: fraction of velocity retained per ms (≈ halves every
 *  ~120ms). Lower = stops sooner. */
export const FLICK_FRICTION = 0.994;
/** px/ms below which a fling stops dead (snap to 0). */
export const MIN_FLICK_VEL = 0.05;
/** px/ms ceiling so a violent flick can't overshoot absurdly. */
export const MAX_FLICK_VEL = 6;
/** Only pointer samples newer than this (ms before release) feed release velocity,
 *  so a slow drag that pauses before lift-off does NOT fling. */
export const FLICK_SAMPLE_WINDOW_MS = 80;

/** A timestamped pointer sample: position (px) along the scroll axis, ms clock. */
export interface FlickSample {
  pos: number;
  t: number;
}

const clampMag = (v: number, max: number): number => (v > max ? max : v < -max ? -max : v);

/** Release velocity (px/ms) from the recent sample window. 0 if too sparse/stale. */
export function flickVelocity(samples: FlickSample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  // Oldest sample still inside the window relative to the final sample.
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > FLICK_SAMPLE_WINDOW_MS) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return clampMag((last.pos - first.pos) / dt, MAX_FLICK_VEL);
}

/** Advance a fling one frame: next velocity after `dtMs` of friction. Snaps to 0
 *  below MIN_FLICK_VEL; clamps input magnitude to MAX_FLICK_VEL. */
export function decayVelocity(vel: number, dtMs: number): number {
  const v = clampMag(vel, MAX_FLICK_VEL) * Math.pow(FLICK_FRICTION, dtMs);
  return Math.abs(v) < MIN_FLICK_VEL ? 0 : v;
}

/** True when a velocity is fast enough to start/continue a fling (sign-agnostic). */
export function isFlick(vel: number): boolean {
  return Math.abs(vel) >= MIN_FLICK_VEL;
}
