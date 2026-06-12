// Pure (Phaser-free) walk/flap/stomp warp math: how a horizontal band of a
// sprite is displaced at a cycle phase. Now used only by the BOSS stomp baker
// (bossWalkBake.ts) — regular enemies walk via enemyWalkTransform.ts on their
// single static sprite. The "walk"/"flap" profiles are kept for tests + reuse.

export type MotionProfile = "walk" | "flap" | "stomp";

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
  /** Upper-torso lateral lumber for the boss stomp, px. Default 2.5. */
  sway?: number;
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
  if (profile === "stomp") {
    const legSwing = opts.legSwing ?? 12;   // wider stride than walk's 9
    const bob = opts.bob ?? 8;              // heavier lift than walk's 4
    const sway = opts.sway ?? 2.5;
    const lw = legWeight(yNorm);
    const tw = yNorm >= WAIST ? 0 : (WAIST - yNorm) / WAIST;
    // legs shear opposite per side; torso counter-leads AND sways side-to-side
    // (sway rides cos(phase) and is weighted to the torso only, so the feet — tw=0 —
    // still rest neutral at phase 0, keeping the contact pose clean).
    const dx = side * legSwing * lw * s - 0.25 * legSwing * tw * s + sway * tw * Math.cos(phase);
    const dy = -bob * Math.abs(s);
    return { dx, dy };
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
