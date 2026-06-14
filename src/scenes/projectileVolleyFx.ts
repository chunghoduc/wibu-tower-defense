// src/scenes/projectileVolleyFx.ts
//
// Draws the LITERAL projectiles a skill fires from the caster — arrows, bullets,
// energy bolts and orbs that fly from the hero/tower to the target along the
// frames planned by projectileVolley.ts. This is the "fired-from-hero" beat that
// makes a cast match its description (tri-shot really shows three arrows). When
// the LAST projectile lands, `onArrive` fires the impact set-piece exactly once.
//
// Pure presentation built on Phaser shapes + tweens (and VfxDraw for orb/spark).
// No art assets.
import Phaser from "phaser";
import { VfxDraw } from "./vfxDraw.ts";
import type { FxPool } from "./fxPool.ts";
import type { MotifKind } from "../data/skillVfxMeta.ts";
import type { VolleyShot } from "./projectileVolley.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;
type Palette = { core: number; hot: number; deep: number };

const ADD = Phaser.BlendModes.ADD;

function travelDur(s: VolleyShot): number {
  const d = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
  return Math.max(90, Math.min(220, d * 0.45));
}

/** A slim shaft + chevron head flying from→to, oriented along the heading. */
function fireArrow(
  scene: Phaser.Scene,
  fac: Fac,
  depth: number,
  draw: VfxDraw,
  shot: VolleyShot,
  p: Palette,
  done: () => void,
): void {
  const dur = travelDur(shot);
  const shaft = fac
    .rectangle(shot.from.x, shot.from.y, 20, 3, p.core)
    .setOrigin(0.5)
    .setRotation(shot.angle)
    .setDepth(depth + 2)
    .setBlendMode(ADD);
  const head = fac
    .triangle(shot.from.x, shot.from.y, 0, -5, 11, 0, 0, 5, p.hot)
    .setRotation(shot.angle)
    .setDepth(depth + 2)
    .setBlendMode(ADD);
  scene.tweens.add({
    targets: [shaft, head],
    x: shot.to.x,
    y: shot.to.y,
    duration: dur,
    ease: "Quad.easeIn",
    onComplete: () => {
      shaft.destroy();
      head.destroy();
      draw.spark(shot.to, p.hot, 5, 12);
      done();
    },
  });
}

/** A bright energy streak flying from→to (bullets short+hot, bolts longer+core). */
function fireStreak(
  scene: Phaser.Scene,
  fac: Fac,
  depth: number,
  draw: VfxDraw,
  shot: VolleyShot,
  p: Palette,
  length: number,
  color: number,
  done: () => void,
): void {
  const dur = travelDur(shot) * 0.7;
  draw.spark(shot.from, p.hot, 4, 8); // muzzle flash at the launch
  const b = fac
    .rectangle(shot.from.x, shot.from.y, length, 3, color)
    .setOrigin(0.5)
    .setRotation(shot.angle)
    .setDepth(depth + 2)
    .setBlendMode(ADD);
  scene.tweens.add({
    targets: b,
    x: shot.to.x,
    y: shot.to.y,
    duration: dur,
    ease: "Quad.easeIn",
    onComplete: () => {
      b.destroy();
      draw.spark(shot.to, color, 4, 10);
      done();
    },
  });
}

function fireOne(
  scene: Phaser.Scene,
  fac: Fac,
  depth: number,
  draw: VfxDraw,
  kind: MotifKind,
  shot: VolleyShot,
  p: Palette,
  done: () => void,
): void {
  switch (kind) {
    case "arrow":
    case "blade":
      fireArrow(scene, fac, depth, draw, shot, p, done);
      return;
    case "bullet":
      fireStreak(scene, fac, depth, draw, shot, p, 10, p.hot, done);
      return;
    case "bolt":
      fireStreak(scene, fac, depth, draw, shot, p, 16, p.core, done);
      return;
    case "orb":
      draw.orbTravel(shot.from, shot.to, p.core, p.hot, 6, travelDur(shot), () => {
        draw.spark(shot.to, p.hot, 5, 12);
        done();
      });
      return;
    case "none":
      done();
      return;
  }
}

/**
 * Fire every projectile in `shots` from the caster; call `onArrive` ONCE after the
 * last one lands. With no shots, `onArrive` runs immediately (the impact still plays).
 */
export function renderVolley(
  scene: Phaser.Scene,
  fac: Fac,
  depth: number,
  pool: FxPool | undefined,
  kind: MotifKind,
  shots: VolleyShot[],
  palette: Palette,
  onArrive: () => void,
): void {
  if (shots.length === 0 || kind === "none") {
    onArrive();
    return;
  }
  const draw = new VfxDraw(scene, fac, depth, pool);
  let landed = 0;
  const total = shots.length;
  const oneDone = () => {
    if (++landed >= total) onArrive();
  };
  for (const shot of shots) {
    if (shot.delay > 0) {
      scene.time.delayedCall(shot.delay, () => fireOne(scene, fac, depth, draw, kind, shot, palette, oneDone));
    } else {
      fireOne(scene, fac, depth, draw, kind, shot, palette, oneDone);
    }
  }
}
