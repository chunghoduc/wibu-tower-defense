// src/data/heroBodyShape.ts
//
// Pure (Phaser-free) geometry for the procedural hero's SOLID base body. The old
// body was a stick figure (thin colored line segments + a skin circle) so the
// blue scaffolding and a bare skin neck showed BETWEEN the worn-gear pieces and
// the whole hero read as a clip-art collage. This module turns the resolved
// skeleton bones into filled primitives — a torso polygon, rounded-capsule limbs,
// joint discs, a neck and a head — that a thin presenter strokes + fills in ONE
// coherent palette. Gaps now read as "body", not "missing texture". When a slot
// is covered by worn gear the segment underneath is dropped (no poke-through).

import type { BoneId, BoneXform } from "./heroSkeleton.ts";

/** A rounded-capsule limb: a thick stroke from a→b, capped by discs at each end. */
export interface BodyCapsule {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  width: number;
  color: number;
}

/** A filled disc (joint cap / head). */
export interface BodyDisc {
  x: number;
  y: number;
  r: number;
  color: number;
}

/** A filled convex polygon (flat [x0,y0,x1,y1,…]). */
export interface BodyPoly {
  points: number[];
  color: number;
}

export interface BodyShadow {
  x: number;
  y: number;
  rx: number;
  ry: number;
  alpha: number;
}

export interface BodyShape {
  shadow: BodyShadow;
  /** back→front: capsules then polys then discs (head/joints last so they cap cleanly). */
  capsules: BodyCapsule[];
  polys: BodyPoly[];
  discs: BodyDisc[];
  /** thin dark outline stroked under every fill so the figure reads as one silhouette. */
  outline: { color: number; width: number };
}

/** Which body parts are hidden because worn gear covers them. */
export interface BodyCover {
  torso?: boolean;
  legs?: boolean;
  feet?: boolean;
  hands?: boolean;
  head?: boolean;
}

export interface BodyInput {
  bones: Record<BoneId, BoneXform>;
  size: number;
  cover: BodyCover;
}

// One coherent palette: a dark undersuit (cloth) + warm skin. Worn gear sits ON
// TOP of this, so any peek-through is body-colored, never a blue capsule.
const SKIN = 0xe6b48a;
const CLOTH = 0x3b3650; // dark undersuit
const CLOTH_DK = 0x2c2840; // shaded undersuit (legs read behind torso)
const OUTLINE = 0x161320;

/**
 * Solid-body primitives for one frame. The skeleton is already posed + facing-
 * mirrored, so this is pure layout: thicken bones into capsules, bridge the torso
 * with a filled trapezoid, cap joints + head with discs, and drop a soft contact
 * shadow under the lower foot.
 */
export function heroBodyShape(input: BodyInput): BodyShape {
  const { bones: b, size, cover } = input;
  const capsules: BodyCapsule[] = [];
  const discs: BodyDisc[] = [];
  const polys: BodyPoly[] = [];

  const legW = size * 0.17;
  const armW = size * 0.11;
  const neckW = size * 0.1;
  const headR = size * 0.13;

  // Legs (behind the torso). Hip disc → thigh→foot capsule → ankle disc.
  if (!cover.legs) {
    for (const [thigh, foot] of [
      [b.thighL, b.footL],
      [b.thighR, b.footR],
    ] as const) {
      capsules.push({
        ax: thigh.x,
        ay: thigh.y,
        bx: foot.x,
        by: foot.y,
        width: legW,
        color: CLOTH_DK,
      });
      discs.push({ x: thigh.x, y: thigh.y, r: legW * 0.5, color: CLOTH_DK });
      if (!cover.feet) discs.push({ x: foot.x, y: foot.y, r: legW * 0.5, color: CLOTH_DK });
    }
  }

  // Arms. Shoulder disc → upper-arm→hand capsule → hand disc.
  for (const [up, hand] of [
    [b.armUpperL, b.handL],
    [b.armUpperR, b.handR],
  ] as const) {
    capsules.push({ ax: up.x, ay: up.y, bx: hand.x, by: hand.y, width: armW, color: SKIN });
    discs.push({ x: up.x, y: up.y, r: armW * 0.55, color: CLOTH });
    if (!cover.hands) discs.push({ x: hand.x, y: hand.y, r: armW * 0.6, color: SKIN });
  }

  // Torso: a filled trapezoid spanning the shoulders (torso bone) down to the hips
  // (pelvis bone). Drawn even when armoured — the armour sits on top, so a peek is
  // undersuit, not a gap.
  const cx = (b.torso.x + b.pelvis.x) * 0.5;
  const shoulderHalf = size * 0.18;
  const hipHalf = size * 0.13;
  const topY = b.torso.y - size * 0.05;
  const botY = b.pelvis.y + size * 0.03;
  polys.push({
    points: [
      cx - shoulderHalf,
      topY,
      cx + shoulderHalf,
      topY,
      b.pelvis.x + hipHalf,
      botY,
      b.pelvis.x - hipHalf,
      botY,
    ],
    color: cover.torso ? CLOTH_DK : CLOTH,
  });
  // Round the shoulders + hips so the trapezoid doesn't read as a box.
  discs.push({
    x: cx - shoulderHalf + size * 0.02,
    y: topY,
    r: size * 0.055,
    color: cover.torso ? CLOTH_DK : CLOTH,
  });
  discs.push({
    x: cx + shoulderHalf - size * 0.02,
    y: topY,
    r: size * 0.055,
    color: cover.torso ? CLOTH_DK : CLOTH,
  });

  // Neck: a short cloth capsule bridging torso→head so no bare skin gap shows when
  // a helmet caps the skull.
  capsules.push({
    ax: cx,
    ay: topY,
    bx: b.head.x,
    by: b.head.y + headR * 0.5,
    width: neckW,
    color: SKIN,
  });

  // Head.
  if (!cover.head) discs.push({ x: b.head.x, y: b.head.y, r: headR, color: SKIN });

  // Contact shadow under the lower foot.
  const footY = Math.max(b.footL.y, b.footR.y);
  const shadow: BodyShadow = {
    x: (b.footL.x + b.footR.x) * 0.5,
    y: footY + size * 0.04,
    rx: size * 0.26,
    ry: size * 0.08,
    alpha: 0.28,
  };

  return {
    shadow,
    capsules,
    polys,
    discs,
    outline: { color: OUTLINE, width: Math.max(2, size * 0.02) },
  };
}
