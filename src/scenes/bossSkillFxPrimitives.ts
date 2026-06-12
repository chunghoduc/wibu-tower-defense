// Shared cinematic primitives for boss-skill set-pieces: telegraph charge,
// additive bloom, settling embers, and a weight-tuned camera punch. Pure
// presentation — every object self-destructs on tween/timer complete, so this
// stays stateless between casts. No art assets.
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;
const ADD = Phaser.BlendModes.ADD;

/** Cinematic helpers bound to one scene + factory + base depth. */
export class BossFxKit {
  constructor(
    readonly scene: Phaser.Scene,
    readonly fac: Fac,
    readonly depth: number,
  ) {}

  /** Tween a transient object, destroying it on complete. */
  tween(
    o: Phaser.GameObjects.GameObject,
    props: Record<string, number>,
    dur: number,
    ease = "Quad.easeOut",
    delay = 0,
  ): void {
    this.scene.tweens.add({
      targets: o,
      ...props,
      duration: dur,
      ease,
      delay,
      onComplete: () => o.destroy(),
    });
  }

  /** Run `fn` after `ms`. */
  after(ms: number, fn: () => void): void {
    this.scene.time.delayedCall(ms, fn);
  }

  /** An expanding stroked ring. */
  ring(at: Vec2, radius: number, color: number, dur: number, width = 3, delay = 0): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(width, color, 0.9).setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, dur, "Cubic.easeOut", delay);
  }

  /** A filled additive disc that grows and fades. */
  disc(
    at: Vec2,
    r: number,
    color: number,
    alpha: number,
    grow: number,
    dur: number,
    delay = 0,
  ): void {
    const d = this.fac
      .circle(at.x, at.y, r, color, alpha)
      .setDepth(this.depth + 3)
      .setBlendMode(ADD);
    this.tween(d, { scale: grow, alpha: 0 }, dur, "Cubic.easeOut", delay);
  }

  /** Soft additive radial bloom — the "impressive" glow layer behind a burst. */
  flare(at: Vec2, r: number, color: number, dur: number, delay = 0): void {
    const f = this.fac
      .circle(at.x, at.y, r, color, 0.5)
      .setDepth(this.depth + 2)
      .setBlendMode(ADD)
      .setScale(0.2);
    this.tween(f, { scale: 1.4, alpha: 0 }, dur, "Quint.easeOut", delay);
  }

  /** Telegraph wind-up: a ring that snaps inward to a bright point, then pops. */
  chargeCore(at: Vec2, from: number, color: number, dur: number): void {
    const core = this.fac
      .circle(at.x, at.y, from, color, 0.0)
      .setStrokeStyle(2, color, 0.9)
      .setDepth(this.depth + 2)
      .setBlendMode(ADD);
    this.scene.tweens.add({
      targets: core,
      scale: 0.15,
      alpha: 1,
      duration: dur,
      ease: "Cubic.easeIn",
      onComplete: () => this.tween(core, { scale: 2.2, alpha: 0 }, 160, "Quad.easeOut"),
    });
  }

  /** Aftermath: small additive motes that drift up/out and fade. */
  emberDrift(at: Vec2, spread: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const d = spread * (0.4 + Math.random() * 0.7);
      const m = this.fac
        .circle(at.x, at.y, 2 + Math.random() * 2, color)
        .setDepth(this.depth + 2)
        .setBlendMode(ADD);
      this.tween(
        m,
        { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d - 14, alpha: 0, scale: 0.3 },
        420 + Math.random() * 260,
        "Quad.easeOut",
        80 + i * 14,
      );
    }
  }

  /** Camera punch tuned by a 0..1 weight: shake + a tinted flash. */
  punch(weight: number, color: number): void {
    const cam = this.scene.cameras.main;
    cam.shake(180 + weight * 140, 0.004 + weight * 0.007);
    const r = (color >> 16) & 0xff,
      g = (color >> 8) & 0xff,
      b = color & 0xff;
    cam.flash(110 + weight * 90, Math.round(r * 0.5), Math.round(g * 0.5), Math.round(b * 0.5));
  }
}
