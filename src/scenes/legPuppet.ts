// Pure (Phaser-free) gait → leg-pose math. Each ground unit is one static
// sprite split at render time into a body + two leg crops (see enemyLegRig.ts);
// this module says how far each leg lifts and swings at a gait phase so the feet
// visibly alternate. Continuous in `phase` → effectively unlimited in-between
// poses (smoother than any baked frame count), and one texture deformed → no
// per-frame character flicker. This is what fixes the "feet never move" /
// floating complaint without re-introducing the reverted multi-frame strip.

export interface LegPose {
  /** Vertical offset, display px. <= 0 lifts the foot off the ground. */
  liftY: number;
  /** Horizontal offset relative to the body, display px. + = forward of body. */
  swingX: number;
  /** True while the foot is on (or near) the ground (the support phase). */
  planted: boolean;
}

export interface LegRigPose {
  left: LegPose;
  right: LegPose;
}

export interface LegPuppetOpts {
  /** Peak foot lift in display px (default 6). */
  lift?: number;
  /** Peak fore/aft swing in display px (default 5). */
  swing?: number;
  /** Global amplitude scale (bosses heavier → larger). Default 1. */
  amp?: number;
}

/** Below this lift fraction the foot counts as planted (support phase). */
const PLANT_THRESHOLD = 0.18;

function oneLeg(phase: number, lift: number, swing: number): LegPose {
  const s = Math.sin(phase);
  // Foot lifts on the forward half of the swing (sin > 0), stays grounded on the
  // support half. |sin| would lift twice per cycle; max(0, sin) lifts once → a
  // natural single step per cycle, the other leg covers the opposite half.
  const up = Math.max(0, s);
  return {
    liftY: -lift * up,
    swingX: swing * s, // leads forward while airborne, trails back while planted
    planted: up < PLANT_THRESHOLD,
  };
}

/** Both legs for a gait phase; the right leg is a half-cycle (π) behind the left. */
export function legPuppet(phase: number, opts: LegPuppetOpts = {}): LegRigPose {
  const amp = opts.amp ?? 1;
  const lift = (opts.lift ?? 6) * amp;
  const swing = (opts.swing ?? 5) * amp;
  return {
    left: oneLeg(phase, lift, swing),
    right: oneLeg(phase + Math.PI, lift, swing),
  };
}

/** Apply a leg pose to a body anchor → the leg piece's world position. */
export function legWorldPos(
  body: { x: number; y: number },
  pose: LegPose,
): { x: number; y: number } {
  return { x: body.x + pose.swingX, y: body.y + pose.liftY };
}
