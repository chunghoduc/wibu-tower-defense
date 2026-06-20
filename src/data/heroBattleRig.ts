// src/data/heroBattleRig.ts
//
// Pure (Phaser-free) battle-hero paper-doll RIG. Maps the hero's per-frame
// animation state (body size, vertical bob, facing) to local placements for the
// worn-gear overlays that ride the body — helmet on the head, breastplate on the
// torso, gauntlet at the hand, boots at the feet. Coordinates are LOCAL to the
// HeroLayeredSprite container, whose origin sits at the body sprite's anchor
// (origin 0.5, 0.78 → 78% down, horizontally centred), so y is measured from
// there and every layer is shifted by `hover` to follow the body's bob/float.
//
// This is the seam that makes equipped gear "follow the movement of body parts":
// the overlays are siblings of the animated body sprite, and because the body
// sprite itself is offset by `hover` each frame, the gear must share that offset
// (and the facing mirror) to stay locked to the limbs it sits on. Held weapon +
// wings keep their own bespoke motion in HeroLayeredSprite; this rig drives the
// four armour pieces that otherwise had no placement at all.

/** The body-worn armour slots this rig positions (weapon + wings are bespoke). */
export const WORN_GEAR_SLOTS = ["Helmet", "BodyArmor", "Gloves", "Boots"] as const;
export type WornGearSlot = (typeof WORN_GEAR_SLOTS)[number];

export interface RigInput {
  /** Body sprite display height in px (the scale reference for every layer). */
  bodyH: number;
  /** Body sprite display width in px (the horizontal anchor reference). */
  bodyW: number;
  /** Vertical body offset in px this frame (idle/float bob); <=0 lifts. */
  hover: number;
  /** Facing: +1 right, -1 left. Mirrors off-axis x and flips the sprite. */
  facing: number;
}

export interface RigPlacement {
  slot: WornGearSlot;
  /** Local x relative to the container origin (px). */
  x: number;
  /** Local y relative to the container origin (px); already includes `hover`. */
  y: number;
  /** Display height for the overlay, px. */
  displayH: number;
  /** Rotation in degrees (mirrored by facing). */
  angle: number;
  /** Horizontal flip for the overlay sprite. */
  flipX: boolean;
  /** Draw order within the container (higher = front). */
  depth: number;
  /** Drawn behind the body (unused for armour today, kept for symmetry). */
  behind: boolean;
}

// Normalized body-region anchors tuned to the front-facing painted hero rig
// (hero__hero): head ≈12% down, torso ≈46%, hand ≈60% and forward of centre,
// feet ≈92%. `scale` is the overlay height as a fraction of body height; boots
// run wide to cover both feet, the breastplate covers the chest+belly.
interface Anchor {
  nx: number;
  ny: number;
  scale: number;
  angle: number;
  depth: number;
  behind: boolean;
}
const ANCHORS: Record<WornGearSlot, Anchor> = {
  // back→front: torso, then boots, helmet, and the hand-held gauntlet on top.
  BodyArmor: { nx: 0.5, ny: 0.46, scale: 0.46, angle: 0, depth: 4, behind: false },
  Boots: { nx: 0.5, ny: 0.92, scale: 0.28, angle: 0, depth: 5, behind: false },
  Helmet: { nx: 0.5, ny: 0.11, scale: 0.29, angle: 0, depth: 6, behind: false },
  Gloves: { nx: 0.62, ny: 0.62, scale: 0.22, angle: 0, depth: 7, behind: false },
};

// The body sprite origin's vertical fraction (matches HeroLayeredSprite's
// bodySprite.setOrigin(0.5, 0.78)) — local y 0 is this far down the body.
const ORIGIN_NY = 0.78;

/**
 * Per-frame local placements for the four worn-armour overlays. Stable order
 * (WORN_GEAR_SLOTS) so the presenter can keep one sprite per slot.
 */
export function heroBattleRig(input: RigInput): RigPlacement[] {
  const { bodyH, bodyW, hover, facing } = input;
  const side = facing < 0 ? -1 : 1;
  return WORN_GEAR_SLOTS.map((slot) => {
    const a = ANCHORS[slot];
    return {
      slot,
      x: (a.nx - 0.5) * bodyW * side,
      y: (a.ny - ORIGIN_NY) * bodyH + hover,
      displayH: a.scale * bodyH,
      angle: a.angle * side,
      flipX: side < 0,
      depth: a.depth,
      behind: a.behind,
    };
  });
}
