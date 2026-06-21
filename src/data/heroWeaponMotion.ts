// src/data/heroWeaponMotion.ts
//
// Pure per-frame transform for the single-sprite battle hero. SDXL gives us two
// static poses per weapon (stance + attack), so all motion is procedural — exactly
// how enemies (enemyWalkTransform) and towers (animateTower) animate one static
// sprite. This maps an animation state + 0..1 phase to a body offset, squash,
// tilt, pose swap and damage tint that a thin presenter applies to the body sprite.
// Phaser-free, tested.

export type WeaponMotionState = "idle" | "walk" | "attack" | "hurt" | "cast";

export interface WeaponMotion {
  /** Body offset within the hero container (px). */
  dx: number;
  dy: number;
  /** Squash/stretch multipliers (1 = neutral). */
  scaleX: number;
  scaleY: number;
  /** Body tilt (degrees). */
  angle: number;
  /** Swap to the attack-pose texture this frame. */
  useAttackPose: boolean;
  /** Damage flash colour, or null for the normal tint. */
  tint: number | null;
  /** Body alpha (1 = opaque). */
  alpha: number;
}

const HURT_TINT = 0xff5a5a;

/** A smooth 0→1→0 hump over phase∈[0,1] (peaks at 0.5). */
function hump(phase: number): number {
  return Math.sin(Math.max(0, Math.min(1, phase)) * Math.PI);
}

/**
 * Transform for one frame. `phase` is 0..1 within a one-shot (attack/hurt/cast) or
 * a free-running locomotion phase for idle/walk. `facing` is +1 right / -1 left.
 */
export function heroWeaponMotion(
  state: WeaponMotionState,
  phase: number,
  size: number,
  facing: number,
): WeaponMotion {
  const side = facing < 0 ? -1 : 1;
  const base: WeaponMotion = {
    dx: 0,
    dy: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    useAttackPose: false,
    tint: null,
    alpha: 1,
  };

  switch (state) {
    case "walk": {
      // A stride bob: feet plant twice per cycle → |sin| at double frequency, with
      // a gentle counter-lean so the run reads as forward momentum.
      const t = phase * Math.PI * 2;
      base.dy = -Math.abs(Math.sin(t)) * size * 0.06;
      base.angle = Math.sin(t) * 3 * side;
      base.scaleY = 1 + Math.abs(Math.sin(t)) * 0.03;
      return base;
    }
    case "attack": {
      // Lunge toward the foe then settle; a slight forward tip sells the swing.
      const h = hump(phase);
      base.dx = side * size * 0.16 * h;
      base.dy = -size * 0.02 * h;
      base.angle = side * 8 * h;
      base.scaleX = 1 + 0.06 * h;
      base.useAttackPose = true;
      return base;
    }
    case "cast": {
      // Rise and brace; hold the attack pose while channelling.
      const h = hump(phase);
      base.dy = -size * 0.07 * h;
      base.scaleY = 1 + 0.05 * h;
      base.useAttackPose = true;
      return base;
    }
    case "hurt": {
      // Snap back against facing, then ease home; red flash that fades out.
      const decay = 1 - Math.max(0, Math.min(1, phase));
      base.dx = -side * size * 0.14 * decay;
      base.angle = -side * 10 * decay;
      base.scaleY = 1 - 0.06 * decay;
      base.tint = phase < 0.6 ? HURT_TINT : null;
      return base;
    }
    case "idle":
    default: {
      // Breathing: a slow vertical bob.
      base.dy = Math.sin(phase * Math.PI * 2) * size * 0.015;
      base.scaleY = 1 + Math.sin(phase * Math.PI * 2) * 0.01;
      return base;
    }
  }
}
