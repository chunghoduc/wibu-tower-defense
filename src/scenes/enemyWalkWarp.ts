// Pure (Phaser-free) walk/flap warp math. One source of truth for how a
// horizontal band of an enemy sprite is displaced at a cycle phase, shared by
// the unit test and the preload canvas baker (enemyWalkBake.ts). Synthesizes a
// real, silhouette-changing gait from a single static sprite — no diffusion.

export type MotionProfile = "walk" | "flap";

export interface BandWarp {
  /** Horizontal pixel offset for this band. */
  dx: number;
  /** Vertical pixel offset for this band (<=0 lifts the body). */
  dy: number;
}

export interface WarpOpts {
  /** Max foot shear in px (alternating legs). Default 20. */
  legSwing?: number;
  /** Body lift between footfalls, px. Default 6. */
  bob?: number;
  /** Wing-beat travel for flyers, px. Default 16. */
  flap?: number;
}

const WAIST = 0.5; // yNorm above which there are no legs

/** Ramp 0 at the waist → 1 at the feet (clamped). */
function legWeight(yNorm: number): number {
  if (yNorm <= WAIST) return 0;
  return (yNorm - WAIST) / (1 - WAIST);
}

/**
 * Per-band displacement for one cycle phase.
 * @param yNorm 0 = top, 1 = feet/bottom.
 * @param side  -1 = left half of the sprite, +1 = right half (walk only).
 * @param phase 0..2π around the gait cycle (0 = foot-plant/contact).
 */
export function bandWarp(
  profile: MotionProfile,
  yNorm: number,
  side: -1 | 1,
  phase: number,
  opts: WarpOpts = {},
): BandWarp {
  const s = Math.sin(phase);
  if (profile === "flap") {
    const flap = opts.flap ?? 7;
    // wings = upper body; weight ramps from mid-line upward
    const w = yNorm >= 0.5 ? 0 : (0.5 - yNorm) / 0.5;
    return { dx: 0, dy: -flap * w * s };
  }
  const legSwing = opts.legSwing ?? 9;
  const bob = opts.bob ?? 4;
  const lw = legWeight(yNorm);
  // torso weight: 0 at the waist → 1 at the top, so both contributions vanish at
  // the waist (continuous, no shear seam there).
  const tw = yNorm >= WAIST ? 0 : (WAIST - yNorm) / WAIST;
  // legs: opposite shear per side (alternating step); torso: gentle counter-lead.
  const dx = side * legSwing * lw * s - 0.25 * legSwing * tw * s;
  // body lifts between footfalls (peaks mid-swing, |sin|)
  const dy = -bob * Math.abs(s);
  return { dx, dy };
}
