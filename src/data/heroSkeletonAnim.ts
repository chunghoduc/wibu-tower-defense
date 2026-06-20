// src/data/heroSkeletonAnim.ts
//
// Pure per-state animation for the hero skeleton: maps an animation state + phase
// to per-bone angle DELTAS (deg) and a vertical bob (fraction of body height). The
// presenter resolves these through heroSkeleton's forward kinematics each frame.
//   - idle/walk: `phase` is the locomotion phase in radians (walk advances it with
//     distance travelled, so a stopped hero stops stepping).
//   - attack/cast/hurt: `phase` is a normalized 0..1 one-shot progress that starts
//     and ends near rest, so the limb returns home when the one-shot finishes.

import type { BoneId } from "./heroSkeleton.ts";

export type AnimState = "idle" | "walk" | "attack" | "cast" | "hurt";

export interface PoseOutput {
  deltas: Partial<Record<BoneId, number>>;
  /** Vertical bob as a fraction of body height (added to hover; <=0 lifts). */
  bob: number;
}

const WALK_THIGH = 22; // deg peak leg swing
const WALK_ARM = 16; // deg peak arm counter-swing
const WALK_KNEE = 14; // foot/shin counter-bend so the lifted leg clears

export function poseSkeleton(state: AnimState, phase: number): PoseOutput {
  switch (state) {
    case "walk": {
      const s = Math.sin(phase);
      const lift = Math.max(0, Math.sin(phase)); // L leg lifts on the up half
      const liftR = Math.max(0, -Math.sin(phase));
      return {
        deltas: {
          thighL: WALK_THIGH * s,
          thighR: -WALK_THIGH * s,
          footL: -WALK_KNEE * lift,
          footR: -WALK_KNEE * liftR,
          armUpperL: -WALK_ARM * s,
          armUpperR: WALK_ARM * s,
          torso: 2 * Math.sin(phase * 2),
        },
        bob: -0.018 * Math.abs(Math.sin(phase * 2)),
      };
    }
    case "attack": {
      // Forward swing arc that returns to rest, with a brief wind-up dip first.
      const t = clamp01(phase);
      const swing = 70 * Math.sin(Math.PI * t);
      const wind = t < 0.3 ? 38 * Math.sin((Math.PI * t) / 0.3) : 0;
      const arm = swing - wind;
      return {
        deltas: { armUpperR: arm, handR: arm * 0.4, torso: 6 * Math.sin(Math.PI * t) },
        bob: 0,
      };
    }
    case "cast": {
      const t = clamp01(phase);
      const raise = -90 * Math.sin(Math.PI * t); // arm overhead and back, returns to rest
      return {
        deltas: { armUpperR: raise, handR: raise * 0.2, torso: -4 * Math.sin(Math.PI * t) },
        bob: -0.02 * Math.sin(Math.PI * t),
      };
    }
    case "hurt": {
      const t = clamp01(phase);
      const k = Math.sin(Math.PI * t);
      return { deltas: { torso: -10 * k, head: -6 * k, pelvis: 4 * k }, bob: 0 };
    }
    case "idle":
    default: {
      return {
        deltas: { torso: 0.6 * Math.sin(phase) },
        bob: -0.012 * Math.abs(Math.sin(phase)),
      };
    }
  }
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
