// src/core/touchInput.ts
//
// Declare that an element owns all touch gestures on mobile web. Pure (no
// Phaser, no DOM globals): operates on any object exposing a writable `style`,
// so it unit-tests against a plain stub and works on the real Phaser canvas.
//
// Why: the browser otherwise co-owns pinch / double-tap-zoom / scroll on the
// canvas. `touch-action: none` hands every gesture to the game (MDN), and
// `overscroll-behavior: none` kills pull-to-refresh and scroll-chain bounce.
// Phaser sets `input.touch.capture = true` (preventDefault on touch events) but
// does NOT set `touch-action`, so we must.

/** Minimal element shape we mutate — keeps this unit testable with a stub. */
export interface StyleHost {
  style: { touchAction?: string; overscrollBehavior?: string };
}

/** Suppress native scroll, pinch, double-tap-zoom, and overscroll on `el`.
 *  Idempotent. */
export function hardenTouchInput(el: StyleHost): void {
  el.style.touchAction = "none";
  el.style.overscrollBehavior = "none";
}
