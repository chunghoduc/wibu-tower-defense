// src/data/heroSkeleton.ts
//
// Pure (Phaser-free) procedural hero SKELETON. A small bone hierarchy whose
// per-frame world transforms drive both the procedural base body and the worn-gear
// attachments — so equipped gear follows the movement of individual body parts
// (the limitation of the old painted-sheet rig). Coordinates are LOCAL to the
// HeroSkeletonSprite container; local y = 0 sits 0.78 down the body (ORIGIN_NY),
// matching the previous rig, so feet ≈ +0.22·H and head-top ≈ −0.78·H. Every bone
// is shifted by `hover` and, for left facing, mirrored across x (which negates
// drawn angles — a rigid reflection of the whole figure).

export type BoneId =
  | "pelvis"
  | "torso"
  | "head"
  | "armUpperL"
  | "armUpperR"
  | "handL"
  | "handR"
  | "thighL"
  | "thighR"
  | "footL"
  | "footR";

export interface Bone {
  id: BoneId;
  parent: BoneId | null;
  /** Rest head position, signed fraction of body WIDTH from centre (x) … */
  nx: number;
  /** … and fraction of body HEIGHT from the TOP (y). */
  ny: number;
}

// Body width is modelled as 0.5·H (a slim chibi). Bones ordered parent-before-child.
const W_OVER_H = 0.5;
const ORIGIN_NY = 0.78; // local y 0 is this far down the body (matches the container origin)

export const BONES: readonly Bone[] = [
  { id: "pelvis", parent: null, nx: 0, ny: 0.52 },
  { id: "torso", parent: "pelvis", nx: 0, ny: 0.34 },
  { id: "head", parent: "torso", nx: 0, ny: 0.1 },
  { id: "armUpperL", parent: "torso", nx: -0.26, ny: 0.26 },
  { id: "armUpperR", parent: "torso", nx: 0.26, ny: 0.26 },
  { id: "handL", parent: "armUpperL", nx: -0.3, ny: 0.5 },
  { id: "handR", parent: "armUpperR", nx: 0.3, ny: 0.5 },
  { id: "thighL", parent: "pelvis", nx: -0.16, ny: 0.54 },
  { id: "thighR", parent: "pelvis", nx: 0.16, ny: 0.54 },
  { id: "footL", parent: "thighL", nx: -0.16, ny: 0.96 },
  { id: "footR", parent: "thighR", nx: 0.16, ny: 0.96 },
] as const;

export interface BoneXform {
  x: number;
  y: number;
  /** Accumulated world angle in degrees (clockwise, y-down). */
  angle: number;
}

export interface SkeletonInput {
  /** Body height in px (scale reference). */
  size: number;
  /** Vertical body offset this frame (idle/float bob + gait bob); <=0 lifts. */
  hover: number;
  /** Facing: +1 right, -1 left. */
  facing: number;
  /** Per-bone angle deltas (deg) from the animation pose. */
  deltas: Partial<Record<BoneId, number>>;
}

const BY_ID = new Map<BoneId, Bone>(BONES.map((b) => [b.id, b]));

// Rest head offset from a bone's PARENT head, in px (right-facing).
function restOffset(b: Bone, size: number): { x: number; y: number } {
  const p = b.parent ? BY_ID.get(b.parent)! : null;
  const px = p ? p.nx : 0;
  const py = p ? p.ny : ORIGIN_NY; // root measured from the origin row
  return { x: (b.nx - px) * W_OVER_H * size, y: (b.ny - py) * size };
}

function rot(x: number, y: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r),
    s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Forward kinematics: every bone's world (container-local) transform. Computed
 * right-facing, then mirrored across x for left facing (negating drawn angles).
 */
export function resolveSkeleton(input: SkeletonInput): Record<BoneId, BoneXform> {
  const { size, hover, facing, deltas } = input;
  const out = {} as Record<BoneId, BoneXform>;
  for (const b of BONES) {
    const delta = deltas[b.id] ?? 0;
    if (!b.parent) {
      out[b.id] = { x: 0, y: hover, angle: delta };
      continue;
    }
    const parent = out[b.parent];
    const off = restOffset(b, size);
    const r = rot(off.x, off.y, parent.angle);
    out[b.id] = { x: parent.x + r.x, y: parent.y + r.y, angle: parent.angle + delta };
  }
  if (facing < 0) {
    for (const id of Object.keys(out) as BoneId[]) {
      out[id] = { x: -out[id].x, y: out[id].y, angle: -out[id].angle };
    }
  }
  return out;
}
