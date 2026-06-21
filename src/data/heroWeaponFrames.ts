// src/data/heroWeaponFrames.ts
//
// Pure frame-selection for the battle hero's per-weapon ANIMATION art. Each weapon
// archetype now has real drawn frames per state (idle/walk/attack/hurt/cast) instead
// of two static poses — this maps an animation state + a 0..1 phase to a frame index
// the presenter swaps in. Looping states (idle, walk) wrap; one-shots (attack, hurt,
// cast) play through once and hold the last frame. Phaser-free, tested.

import type { WeaponMotionState } from "./heroWeaponMotion.ts";

/** How many drawn frames exist per state. Idle has its own 2-beat breathing loop
 *  drawn in the same heroanim family as the action frames (no longer the off-style
 *  stance reuse), so every state reads as the same character. */
export const FRAME_COUNTS: Record<WeaponMotionState, number> = {
  idle: 2,
  walk: 4,
  attack: 4,
  hurt: 2,
  cast: 4,
};

/** States that loop continuously; the rest are one-shots that hold the last frame. */
export const LOOPING_STATES: ReadonlySet<WeaponMotionState> = new Set<WeaponMotionState>([
  "idle",
  "walk",
]);

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Frame index for one render tick. `phase` is the locomotion phase for looping
 * states (wrapped) or the 0..1 progress of a one-shot (clamped). Always returns an
 * integer in [0, FRAME_COUNTS[state]).
 */
export function heroWeaponFrame(
  state: WeaponMotionState,
  phase: number,
  counts: Record<WeaponMotionState, number> = FRAME_COUNTS,
): number {
  const n = counts[state];
  if (n <= 1) return 0;
  if (LOOPING_STATES.has(state)) {
    if (phase < 0) return 0;
    const wrapped = ((phase % 1) + 1) % 1; // 0..1 even for negative/over-1 phase
    return Math.min(n - 1, Math.floor(wrapped * n));
  }
  // One-shot: clamp into the last frame on/after completion.
  return Math.min(n - 1, Math.floor(clamp01(phase) * n));
}
