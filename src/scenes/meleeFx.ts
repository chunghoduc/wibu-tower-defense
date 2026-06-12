/**
 * MeleeFx — renders hand-to-hand attack visuals so each melee archetype reads
 * distinctly: a single anime sword crescent (`slash`), a rapid multi-blade
 * `flurry`, a fist `punch` (jab→cross), and a weighty `smash` (overhead blunt +
 * ground shockwave). Pure presentation, split out of FxLayer to keep fx.ts small.
 *
 * Design follows the melee-VFX research (2026-06-10 deep-research report):
 *  - swings are oriented along the strike direction (from→to), never random;
 *  - crescents/sparks use additive blending for the bright "anime slash" glow;
 *  - impact is sold with a brief HELD flash (a fake, local hit-stop) — the sim
 *    is NEVER frozen, since many towers strike every tick;
 *  - camera shake is reserved for `smash`/crits and THROTTLED, so simultaneous
 *    heavy hits can't stack into a constant rattle.
 */
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";

const DEG = Phaser.Math.DEG_TO_RAD;
/** Minimum gap between camera shakes (ms) so concurrent smashes don't pile up. */
const SHAKE_COOLDOWN = 90;

export class MeleeFx {
  /** Scene-clock timestamp of the last camera shake, for throttling. */
  private lastShakeAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
  ) {}

  /** A single sweeping sword cut — a glowing crescent that lands on the target. */
  slash(from: Vec2, to: Vec2, color: number, crit = false): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    this.crescent(to, ang, color, {
      radius: crit ? 22 : 17,
      spanDeg: 130,
      width: crit ? 6 : 4.5,
      dur: crit ? 220 : 190,
    });
    this.spark(to, color, crit ? 7 : 5);
    if (crit) this.flash(to, 0xffffff, 13, 200);
  }

  /** A rapid multi-blade barrage — several quick crescents in staggered cadence. */
  flurry(from: Vec2, to: Vec2, color: number, crit = false): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const hits = crit ? 4 : 3;
    for (let i = 0; i < hits; i++) {
      const off = (i % 2 === 0 ? -1 : 1) * (0.35 + i * 0.05);
      this.scene.time.delayedCall(i * 65, () => {
        this.crescent(to, ang + off, color, {
          radius: 12 + (i % 2) * 2,
          spanDeg: 95,
          width: 3.5,
          dur: 150,
        });
        this.spark(to, color, 3);
      });
    }
    if (crit) this.flash(to, 0xffffff, 12, 200);
  }

  /** A fist strike — a knuckle streak drives in, an impact ring blooms, then a
   *  quick second jab for a jab→cross cadence. Melee: the hit lands at `to`. */
  punch(from: Vec2, to: Vec2, color: number, crit = false): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    this.jab(to, ang, color, crit ? 6 : 5);
    // Cross — a slightly smaller, faster follow-up jab.
    this.scene.time.delayedCall(95, () => this.jab(to, ang, color, crit ? 5 : 4));
    if (crit) this.flash(to, 0xffffff, 12, 190);
  }

  /** A weighty blunt blow — overhead chop crescent, a ground shockwave, a held
   *  white flash, a fat spark, and a throttled camera shake to sell the weight. */
  smash(from: Vec2, to: Vec2, color: number, crit = false): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    // The chop: a steep, wide crescent driven down onto the target.
    this.crescent(to, ang, color, {
      radius: crit ? 26 : 21,
      spanDeg: 150,
      width: crit ? 8 : 6,
      dur: crit ? 260 : 230,
    });
    // Ground shockwave — a fast expanding ring at the point of impact.
    this.ring(to, crit ? 34 : 26, color, 320);
    // Held white flash (a local, fake hit-stop — the sim never freezes).
    this.flash(to, 0xffffff, crit ? 16 : 13, 240, 60);
    this.spark(to, color, crit ? 9 : 7, 18);
    this.shake(crit ? 0.004 : 0.003, 110);
  }

  // ---- primitives ----------------------------------------------------------

  /** A glowing crescent arc oriented to cup the target along `ang`. Additive. */
  private crescent(
    at: Vec2,
    ang: number,
    color: number,
    opts: { radius: number; spanDeg: number; width: number; dur: number; core?: number },
  ): void {
    const core = opts.core ?? 0xffffff;
    const g = this.fac.graphics({ x: at.x, y: at.y }).setDepth(this.depth + 1);
    g.setBlendMode(Phaser.BlendModes.ADD);
    const a0 = (-opts.spanDeg / 2) * DEG,
      a1 = (opts.spanDeg / 2) * DEG;
    g.lineStyle(opts.width, color, 0.85);
    g.beginPath();
    g.arc(0, 0, opts.radius, a0, a1);
    g.strokePath();
    g.lineStyle(opts.width * 0.45, core, 0.95);
    g.beginPath();
    g.arc(0, 0, opts.radius, a0, a1);
    g.strokePath();
    g.setRotation(ang - 0.4).setScale(0.6);
    // Sweep through the arc (rotation) while scaling up and fading — the swing.
    this.scene.tweens.add({
      targets: g,
      rotation: ang + 0.4,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0,
      duration: opts.dur,
      ease: "Quad.easeOut",
      onComplete: () => g.destroy(),
    });
  }

  /** A single fist jab: a short knuckle streak that snaps into the target. */
  private jab(to: Vec2, ang: number, color: number, r: number): void {
    const sx = to.x - Math.cos(ang) * 22,
      sy = to.y - Math.sin(ang) * 22;
    const fist = this.fac
      .rectangle(sx, sy, 9, r, color)
      .setRotation(ang)
      .setOrigin(0, 0.5)
      .setDepth(this.depth);
    this.scene.tweens.add({
      targets: fist,
      x: to.x,
      y: to.y,
      duration: 70,
      ease: "Quint.easeIn",
      onComplete: () => {
        fist.destroy();
        this.ring(to, 10, color, 200);
        this.spark(to, color, 5);
      },
    });
  }

  /** A short-lived radial spark burst at the impact point. */
  private spark(at: Vec2, color: number, n = 5, reach = 14): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.fac
        .circle(at.x, at.y, 2, color)
        .setDepth(this.depth + 1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * reach,
        y: at.y + Math.sin(a) * reach,
        alpha: 0,
        scale: 0.3,
        duration: 220,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  /** An expanding impact ring (shockwave). */
  private ring(at: Vec2, radius: number, color: number, duration: number): void {
    const c = this.fac.circle(at.x, at.y, 5).setStrokeStyle(2.5, color, 0.9).setDepth(this.depth);
    this.scene.tweens.add({
      targets: c,
      scale: radius / 5,
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => c.destroy(),
    });
  }

  /** A bright impact flash. `hold` ms keeps it at full before it fades (fake hit-stop). */
  private flash(at: Vec2, color: number, r: number, dur: number, hold = 0): void {
    const f = this.fac
      .circle(at.x, at.y, r, color, 0.85)
      .setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: f,
      scale: 1.7,
      alpha: 0,
      duration: dur,
      delay: hold,
      ease: "Quad.easeOut",
      onComplete: () => f.destroy(),
    });
  }

  /** A tiny camera shake, throttled so simultaneous heavy hits don't stack. */
  private shake(intensity: number, duration: number): void {
    const now = this.scene.time.now;
    if (now - this.lastShakeAt < SHAKE_COOLDOWN) return;
    this.lastShakeAt = now;
    this.scene.cameras.main.shake(duration, intensity);
  }
}
