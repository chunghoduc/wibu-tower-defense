// src/data/heroWeaponHold.ts
//
// Pure (Phaser-free) placement for the HELD weapon on the procedural skeleton
// hero. The weapon rides the weapon hand (handR) so it swings with the arm, but
// a raw bone transform alone reads wrong: an inventory icon is square with the
// blade drawn diagonally, so anchoring its centre at the fingertip and scaling it
// to the bone length makes a giant blade float off the body. This module pins the
// GRIP (icon lower-inner corner) into the palm, sizes the weapon to the body, and
// adds a family-specific resting tilt so a sword reads as held up-forward at rest
// and slashes through as the arm swings.

import type { BoneXform } from "./heroSkeleton.ts";
import type { WeaponType } from "./schema.ts";

export interface WeaponHold {
  /** Grip position (container-local px) — the icon's origin sits here. */
  x: number;
  y: number;
  /** Sprite rotation in degrees (already mirrored for facing). */
  angle: number;
  /** Display height in px (the presenter keeps the icon's aspect ratio). */
  displayH: number;
  /** Sprite origin so the grip — not the icon centre — lands at (x, y). */
  originX: number;
  originY: number;
  /** Horizontal flip (left facing). */
  flipX: boolean;
}

// Resting tilt (deg) added to the hand's world angle, right-facing. The hand
// hangs straight down at rest (angle ≈ 0) and a weapon icon points "up" from its
// grip, so a positive tilt leans the blade forward (toward the foe). Tuned per
// family: polearms/bows stand more upright, fists barely tilt.
const REST_TILT: Record<WeaponType, number> = {
  Sword: 24,
  Fist: 8,
  Bow: 8,
  Gun: 30,
  Staff: 14,
  Tome: 10,
  Any: 22,
};

// Weapon display height as a fraction of body height. Big two-handers read larger;
// fists/tomes are small. These keep the held weapon proportionate to the body
// instead of scaled to the (much longer) arm bone.
const SCALE: Record<WeaponType, number> = {
  Sword: 0.6,
  Fist: 0.3,
  Bow: 0.72,
  Gun: 0.4,
  Staff: 0.82,
  Tome: 0.36,
  Any: 0.58,
};

// Inventory icons draw the weapon diagonally with the hilt toward the lower-inner
// corner; pinning the origin there (not the centre) seats the grip in the palm.
const GRIP_X = 0.4;
const GRIP_Y = 0.82;

/**
 * Where to draw the held weapon this frame. `hand` is the resolved handR bone,
 * `size` the body height (px), `facing` +1 right / -1 left.
 */
export function weaponHold(
  hand: BoneXform,
  type: WeaponType | null,
  size: number,
  facing: number,
): WeaponHold {
  const side = facing < 0 ? -1 : 1;
  const t = type ?? "Any";
  const tilt = (REST_TILT[t] ?? REST_TILT.Any) * side;
  return {
    x: hand.x,
    y: hand.y,
    angle: hand.angle + tilt,
    displayH: (SCALE[t] ?? SCALE.Any) * size,
    // Mirror the grip's horizontal offset with facing so it stays on the palm side.
    originX: side < 0 ? 1 - GRIP_X : GRIP_X,
    originY: GRIP_Y,
    flipX: side < 0,
  };
}
