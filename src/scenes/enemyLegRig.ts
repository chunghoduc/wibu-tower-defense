// Render-time leg puppet: a single static enemy sprite is shown as a cropped
// BODY (feet hidden) plus two leg pieces (bottom-left / bottom-right crops of
// the SAME texture) that lift/swing in alternating phase (see legPuppet.ts).
// No baked strip texture is ever created (that caused the "floating strip"
// regression in b627ba8), so the single-frame enemy contract is untouched —
// these are live crops of frame 0, not authored frames.
import type Phaser from "phaser";
import { legPuppet, type LegRigPose } from "./legPuppet.ts";
import { DEPTH } from "./battleDepths.ts";

/** Fraction of the frame height shown by the BODY (top → this point). */
export const WAIST_BODY = 0.6;
/** Legs crop a little higher than the body's bottom so the overlap hides behind
 *  the torso (mirrors the +overlap the old band-baker used to hide seams). */
export const WAIST_LEG = 0.54;

export interface LegRig {
  legL: Phaser.GameObjects.Image;
  legR: Phaser.GameObjects.Image;
  /** Frame dims captured at creation (for crop rects). */
  fw: number;
  fh: number;
}

/** True for enemies that should walk on legs (ground, has a real frame). */
export function wantsLegs(flying: boolean, frameW: number, frameH: number): boolean {
  return !flying && frameW > 0 && frameH > 0;
}

/**
 * Create the two leg Images for an enemy and crop the body to hide its feet.
 * Idempotent per uid via the supplied map. Returns the rig (or the existing one).
 */
export function ensureLegRig(
  scene: Phaser.Scene,
  world: Phaser.GameObjects.Layer,
  rigs: Map<number, LegRig>,
  uid: number,
  body: Phaser.GameObjects.Sprite,
  key: string,
): LegRig | null {
  const existing = rigs.get(uid);
  if (existing) return existing;
  const frame = scene.textures.getFrame(key, 0);
  if (!frame?.cutWidth || !frame?.cutHeight) return null;
  const fw = frame.cutWidth;
  const fh = frame.cutHeight;

  // Hide the body's baked-in feet so the moving leg pieces don't double up.
  body.setCrop(0, 0, fw, fh * WAIST_BODY);

  const mkLeg = (cropX: number): Phaser.GameObjects.Image => {
    const leg = scene.add
      .image(body.x, body.y, key)
      .setOrigin(body.originX, body.originY)
      .setDepth(DEPTH.ENEMY_LEG);
    leg.setCrop(cropX, fh * WAIST_LEG, fw / 2, fh * (1 - WAIST_LEG));
    world.add(leg);
    return leg;
  };
  const rig: LegRig = { legL: mkLeg(0), legR: mkLeg(fw / 2), fw, fh };
  rigs.set(uid, rig);
  return rig;
}

/**
 * Position the legs under the already-transformed body this frame. The legs
 * share the body's scale/angle/tint/alpha; the puppet adds per-leg lift+swing
 * so feet alternate. `phase` is the same gait phase that drives the body bob.
 */
export function updateLegRig(
  rig: LegRig,
  body: Phaser.GameObjects.Sprite,
  phase: number,
  amp: number,
  liftSwingScale: number,
): void {
  const pose: LegRigPose = legPuppet(phase, {
    amp,
    lift: 6 * liftSwingScale,
    swing: 5 * liftSwingScale,
  });
  const tint = body.tintTopLeft;
  const tinted = body.isTinted;
  for (const [leg, p] of [
    [rig.legL, pose.left],
    [rig.legR, pose.right],
  ] as const) {
    leg.setScale(body.scaleX, body.scaleY);
    leg.setAngle(body.angle);
    leg.x = body.x + p.swingX;
    leg.y = body.y + p.liftY;
    leg.setAlpha(body.alpha);
    if (tinted) leg.setTint(tint);
    else leg.clearTint();
    leg.setVisible(body.visible);
  }
}

/** Hold the legs still at the rest pose (frozen / stunned enemy standing). */
export function restLegRig(rig: LegRig, body: Phaser.GameObjects.Sprite): void {
  for (const leg of [rig.legL, rig.legR]) {
    leg.setScale(body.scaleX, body.scaleY);
    leg.setAngle(body.angle);
    leg.x = body.x;
    leg.y = body.y;
    leg.setAlpha(body.alpha);
  }
}

/** Tear down a rig's leg pieces (enemy culled). */
export function destroyLegRig(rigs: Map<number, LegRig>, uid: number): void {
  const rig = rigs.get(uid);
  if (!rig) return;
  rig.legL.destroy();
  rig.legR.destroy();
  rigs.delete(uid);
}
