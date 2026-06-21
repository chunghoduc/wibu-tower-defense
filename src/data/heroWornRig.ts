// src/data/heroWornRig.ts
//
// Pure mapping from the resolved hero skeleton to worn-gear placements. Each worn
// piece attaches to a bone and inherits that bone's world transform, so gear
// follows the movement of the body part it sits on. Whole-piece art (phase 1)
// pins boots/gloves to one representative limb; per-limb art (phase 2) splits them
// L/R across both foot/hand bones (one mirrored).

import type { BoneId, BoneXform } from "./heroSkeleton.ts";

export const WORN_GEAR_SLOTS = ["Helmet", "BodyArmor", "Pants", "Gloves", "Boots"] as const;
export type WornGearSlot = (typeof WORN_GEAR_SLOTS)[number];

export type WornPart = "single" | "L" | "R";

export interface WornPlacement {
  slot: WornGearSlot;
  part: WornPart;
  x: number;
  y: number;
  displayH: number;
  angle: number;
  flipX: boolean;
  depth: number;
  behind: boolean;
}

interface Attach {
  bone: BoneId;
  /** Local offset from the bone head, fraction of body height (right-facing). */
  ox: number;
  oy: number;
  /** Display height as a fraction of body height. */
  scale: number;
  depth: number;
}

// back→front draw order encoded in depth: boots(2) < pants(2.5) < body(3) < gloves(4) < helmet(5).
// Anchors are tuned to ANATOMY: each piece is seated on its bone so it sits ON the
// solid body (heroBodyShape) rather than floating beside a stick figure.
const SINGLE: Record<WornGearSlot, Attach> = {
  Boots: { bone: "pelvis", ox: 0, oy: 0.4, scale: 0.26, depth: 2 },
  // Legguards ride the pelvis and cover the upper legs (waist → knees).
  Pants: { bone: "pelvis", ox: 0, oy: 0.18, scale: 0.34, depth: 2.5 },
  // Breastplate covers shoulders→waist; draped low so its skirt hides the legguard
  // top at the waist (no bright sliver between trunk and legs).
  BodyArmor: { bone: "torso", ox: 0, oy: 0.12, scale: 0.54, depth: 3 },
  Gloves: { bone: "handR", ox: 0, oy: 0, scale: 0.15, depth: 4 },
  // Helmet caps the skull: raised slightly so its bottom edge meets the neck.
  Helmet: { bone: "head", ox: 0, oy: -0.03, scale: 0.34, depth: 5 },
};

// Per-limb (phase 2) overrides for the split slots: each piece seats on its own
// foot/hand bone so it tracks that limb and meets the solid leg/arm above it.
const PER_LIMB: Partial<Record<WornGearSlot, { L: Attach; R: Attach }>> = {
  Boots: {
    // Seated at the ankle (slightly up) so the cuff meets the shin — no float/gap.
    L: { bone: "footL", ox: 0, oy: -0.02, scale: 0.17, depth: 2 },
    R: { bone: "footR", ox: 0, oy: -0.02, scale: 0.17, depth: 2 },
  },
  Gloves: {
    L: { bone: "handL", ox: 0, oy: 0, scale: 0.14, depth: 4 },
    R: { bone: "handR", ox: 0, oy: 0, scale: 0.14, depth: 4 },
  },
};

function place(
  a: Attach,
  part: WornPart,
  slot: WornGearSlot,
  bones: Record<BoneId, BoneXform>,
  size: number,
  facing: number,
): WornPlacement {
  const b = bones[a.bone];
  const side = facing < 0 ? -1 : 1;
  // Offset authored right-facing; mirror its x with facing (matches resolveSkeleton).
  const ang = (b.angle * Math.PI) / 180;
  const ox = a.ox * 0.5 * size * side;
  const oy = a.oy * size;
  const x = b.x + ox * Math.cos(ang) - oy * Math.sin(ang);
  const y = b.y + ox * Math.sin(ang) + oy * Math.cos(ang);
  const flipX = part === "L" ? side > 0 : side < 0;
  return {
    slot,
    part,
    x,
    y,
    displayH: a.scale * size,
    angle: b.angle,
    flipX,
    depth: a.depth,
    behind: false,
  };
}

/**
 * Which sprite parts a slot actually renders in the given mode. Only these parts
 * are placed by `placeWorn`, so the presenter must only show these (a stray
 * `single` boot in perLimb mode would never be positioned → sits at the origin).
 */
export function partsForSlot(slot: WornGearSlot, perLimb: boolean): WornPart[] {
  return perLimb && PER_LIMB[slot] ? ["L", "R"] : ["single"];
}

/**
 * Per-frame placements for the four worn-armour slots. `perLimb` splits boots and
 * gloves across both limbs (phase 2 single-limb art); otherwise one piece per slot.
 */
export function placeWorn(
  bones: Record<BoneId, BoneXform>,
  size: number,
  facing: number,
  perLimb: boolean,
): WornPlacement[] {
  const out: WornPlacement[] = [];
  for (const slot of WORN_GEAR_SLOTS) {
    const split = perLimb ? PER_LIMB[slot] : undefined;
    if (split) {
      out.push(place(split.L, "L", slot, bones, size, facing));
      out.push(place(split.R, "R", slot, bones, size, facing));
    } else {
      out.push(place(SINGLE[slot], "single", slot, bones, size, facing));
    }
  }
  return out;
}
