// src/scenes/vfxDraw.ts
//
// Shared procedural VFX drawing kit. Every object self-destructs when its tween
// completes, so callers never clean up. Used by the per-skill impact signatures
// (skillSignatures.ts) and the source-delivery choreographies (skillDelivery.ts).
// No art assets — pure Phaser shapes + tweens.
import Phaser from "phaser";

export type V = { x: number; y: number };
export type Fac = Phaser.GameObjects.GameObjectFactory;

/** Compact drawing kit shared by every signature + delivery. Self-destructs each object. */
export class VfxDraw {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Fac,
    private readonly depth: number,
  ) {}

  /** Tween a fresh object then destroy it. */
  private go(
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

  after(ms: number, fn: () => void): void {
    this.scene.time.delayedCall(ms, fn);
  }

  shake(dur: number, intensity: number): void {
    this.scene.cameras.main.shake(dur, intensity);
  }

  flash(dur: number, r: number, g: number, b: number): void {
    this.scene.cameras.main.flash(dur, r, g, b);
  }

  /** Expanding stroked ring. */
  ring(at: V, radius: number, color: number, dur: number, width = 3, alpha = 0.9): void {
    const c = this.fac
      .circle(at.x, at.y, 6)
      .setStrokeStyle(width, color, alpha)
      .setDepth(this.depth);
    this.go(c, { scale: radius / 6, alpha: 0 }, dur, "Cubic.easeOut");
  }

  /** Bright filled disc that grows and fades — a flash core. */
  disc(at: V, r: number, color: number, alpha: number, grow: number, dur: number): void {
    const d = this.fac
      .circle(at.x, at.y, r, color, alpha)
      .setDepth(this.depth + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.go(d, { scale: grow, alpha: 0 }, dur, "Cubic.easeOut");
  }

  /** Radial spray of tiny sparks. */
  spark(at: V, color: number, n = 6, reach = 18): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.fac
        .circle(at.x, at.y, 2, color)
        .setDepth(this.depth + 2)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.go(
        p,
        { x: at.x + Math.cos(a) * reach, y: at.y + Math.sin(a) * reach, alpha: 0, scale: 0.3 },
        240,
      );
    }
  }

  /** Drifting motes (dir -1 rise, +1 fall). */
  motes(at: V, radius: number, n: number, color: () => number, dir: 1 | -1): void {
    for (let i = 0; i < n; i++) {
      const p = this.fac
        .circle(
          at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6),
          at.y,
          Phaser.Math.Between(2, 4),
          color(),
        )
        .setDepth(this.depth + 2)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.go(
        p,
        {
          y: at.y + dir * Phaser.Math.Between(28, 60),
          x: p.x + Phaser.Math.Between(-12, 12),
          alpha: 0,
          scale: 0.2,
        },
        Phaser.Math.Between(520, 760),
        "Sine.easeOut",
      );
    }
  }

  /** A sweeping crescent blade-arc (graphics) at a given angle. */
  crescent(
    at: V,
    color: number,
    fromDeg: number,
    sweepDeg: number,
    r: number,
    width: number,
    dur: number,
    spin: number,
  ): void {
    const g = this.fac
      .graphics({ x: at.x, y: at.y })
      .setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(width, color, 0.95);
    g.beginPath();
    g.arc(0, 0, r, Phaser.Math.DegToRad(fromDeg), Phaser.Math.DegToRad(fromDeg + sweepDeg));
    g.strokePath();
    g.setScale(0.4);
    this.go(g, { scale: 1.35, angle: spin, alpha: 0 }, dur, "Cubic.easeOut");
  }

  /** A straight tapering beam from `at` along `angle` (radians). */
  beam(at: V, angle: number, length: number, color: number, width: number, dur: number): void {
    const r = this.fac
      .rectangle(at.x, at.y, 8, width, color)
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.go(r, { scaleX: length / 8, alpha: 0 }, dur, "Quad.easeOut");
  }

  /** A jagged crack line from `at` toward an angle. */
  crack(at: V, angle: number, length: number, color: number, dur = 260): void {
    const g = this.fac.graphics().setDepth(this.depth + 1);
    g.lineStyle(2.5, color, 0.9);
    g.beginPath();
    g.moveTo(at.x, at.y);
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        j = i < steps ? 6 : 0;
      g.lineTo(
        at.x + Math.cos(angle) * length * t + Phaser.Math.Between(-j, j),
        at.y + Math.sin(angle) * length * t + Phaser.Math.Between(-j, j),
      );
    }
    g.strokePath();
    this.go(g, { alpha: 0 }, dur, "Quad.easeIn");
  }

  /** Radial ring of erupting triangular shards. */
  shards(at: V, n: number, radius: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + 0.2;
      const tip = { x: at.x + Math.cos(a) * radius * 0.5, y: at.y + Math.sin(a) * radius * 0.5 };
      const s = this.fac
        .triangle(tip.x, tip.y, 0, 0, 6, -18, 12, 0, color)
        .setDepth(this.depth + 1)
        .setAlpha(0)
        .setScale(0.4)
        .setRotation(a + Math.PI / 2);
      this.scene.tweens.add({
        targets: s,
        alpha: 0.95,
        scale: 1,
        duration: 130,
        yoyo: true,
        hold: 130,
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
  }

  /** A rotating sigil ring with tick marks. */
  sigil(at: V, radius: number, color: number, dir: 1 | -1): void {
    const g = this.fac
      .graphics({ x: at.x, y: at.y })
      .setDepth(this.depth + 1)
      .setAlpha(0);
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(0, 0, radius);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      g.lineBetween(
        Math.cos(a) * radius * 0.86,
        Math.sin(a) * radius * 0.86,
        Math.cos(a) * radius,
        Math.sin(a) * radius,
      );
    }
    g.setScale(0.5);
    this.scene.tweens.add({
      targets: g,
      alpha: 0.95,
      scale: 1,
      angle: dir * 80,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => this.go(g, { alpha: 0, scale: 1.15 }, 220),
    });
  }

  /** Small star glyphs blinking around a ring. */
  glyphs(at: V, radius: number, n: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const r = this.fac
        .star(at.x + Math.cos(a) * radius, at.y + Math.sin(a) * radius, 4, 2, 5.5, color)
        .setDepth(this.depth + 2)
        .setAlpha(0)
        .setAngle(45);
      this.scene.tweens.add({
        targets: r,
        alpha: 1,
        angle: 225,
        duration: 240,
        yoyo: true,
        hold: 120,
        onComplete: () => r.destroy(),
      });
    }
  }

  /** A puff of smoke that bloats and fades. */
  smoke(at: V, color: number, size = 10): void {
    const s = this.fac.circle(at.x, at.y, size, color, 0.5).setDepth(this.depth + 1);
    this.go(
      s,
      { scale: 2.4, y: at.y - 10, alpha: 0 },
      Phaser.Math.Between(420, 620),
      "Sine.easeOut",
    );
  }

  /** A bright bar that stretches along its length then fades — a gleam streak. */
  gleam(at: V, deg: number, length: number, color: number, width = 4): void {
    const r = this.fac
      .rectangle(at.x, at.y, 8, width, color)
      .setOrigin(0.5)
      .setAngle(deg)
      .setDepth(this.depth + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.go(r, { scaleX: length / 8, alpha: 0 }, 280, "Quad.easeOut");
  }

  // ── travel primitives for source-delivery ───────────────────────────────────

  /** A gather/charge glow that swells then implodes at a point (anticipation beat). */
  chargeGlow(at: V, color: number, r: number, dur: number): void {
    const c = this.fac
      .circle(at.x, at.y, r, color, 0.5)
      .setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.2);
    this.scene.tweens.add({
      targets: c,
      scale: 1,
      duration: dur * 0.6,
      ease: "Quad.easeOut",
      onComplete: () => this.go(c, { scale: 0.1, alpha: 0 }, dur * 0.4, "Quad.easeIn"),
    });
    this.spark(at, color, 6, r * 1.6);
  }

  /** A glowing orb that flies from→to leaving a fading trail, then `onArrive`. */
  orbTravel(
    from: V,
    to: V,
    color: number,
    hot: number,
    r: number,
    dur: number,
    onArrive: () => void,
  ): void {
    const glow = this.fac
      .circle(from.x, from.y, r + 3, color, 0.35)
      .setDepth(this.depth + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const body = this.fac
      .circle(from.x, from.y, r, hot)
      .setStrokeStyle(2, color, 0.9)
      .setDepth(this.depth + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    let last = { x: from.x, y: from.y };
    const trail = this.scene.time.addEvent({
      delay: 24,
      loop: true,
      callback: () => {
        const t = this.fac
          .circle(last.x, last.y, r * 0.7, color, 0.5)
          .setDepth(this.depth)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.go(t, { scale: 0.2, alpha: 0 }, 220);
        last = { x: body.x, y: body.y };
      },
    });
    this.scene.tweens.add({
      targets: [glow, body],
      x: to.x,
      y: to.y,
      duration: dur,
      ease: "Quad.easeIn",
      onComplete: () => {
        trail.remove();
        glow.destroy();
        body.destroy();
        onArrive();
      },
    });
  }

  /** A vertical streak that plummets from the sky down to `to`, then `onArrive`. */
  fallStreak(
    to: V,
    height: number,
    color: number,
    hot: number,
    width: number,
    dur: number,
    onArrive: () => void,
  ): void {
    const sky = { x: to.x, y: to.y - height };
    const streak = this.fac
      .rectangle(sky.x, sky.y, width, height, color, 0.85)
      .setOrigin(0.5, 0)
      .setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1, 0.1);
    const head = this.fac
      .circle(sky.x, sky.y, width * 0.9, hot)
      .setDepth(this.depth + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: streak,
      scaleY: 1,
      duration: dur,
      ease: "Quad.easeIn",
      onComplete: () => this.go(streak, { alpha: 0 }, 120),
    });
    this.scene.tweens.add({
      targets: head,
      y: to.y,
      duration: dur,
      ease: "Quad.easeIn",
      onComplete: () => {
        head.destroy();
        onArrive();
      },
    });
  }

  /** A column of energy/shards that erupts upward from the ground at `at`, then `onArrive`. */
  riser(
    at: V,
    color: number,
    hot: number,
    height: number,
    dur: number,
    onArrive: () => void,
  ): void {
    const col = this.fac
      .rectangle(at.x, at.y, 10, height, color, 0.55)
      .setOrigin(0.5, 1)
      .setDepth(this.depth + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1, 0);
    this.scene.tweens.add({
      targets: col,
      scaleY: 1,
      duration: dur * 0.6,
      ease: "Cubic.easeOut",
      onComplete: () => this.go(col, { alpha: 0, scaleX: 0.4 }, dur * 0.4),
    });
    for (let i = 0; i < 5; i++) {
      const s = this.fac
        .triangle(at.x + Phaser.Math.Between(-12, 12), at.y, 0, 0, 5, -16, 10, 0, hot)
        .setDepth(this.depth + 2)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: s,
        y: at.y - Phaser.Math.Between(18, height),
        alpha: 0,
        duration: dur,
        ease: "Quad.easeOut",
        delay: i * 18,
        onComplete: () => s.destroy(),
      });
    }
    this.after(Math.round(dur * 0.6), onArrive);
  }

  /** A ground target-marker reticle that blooms then snaps (skyfall telegraph). */
  marker(at: V, radius: number, color: number, dur: number): void {
    const c = this.fac
      .circle(at.x, at.y, radius)
      .setStrokeStyle(2, color, 0.8)
      .setDepth(this.depth)
      .setScale(1.4)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: c,
      scale: 1,
      alpha: 0.9,
      duration: dur,
      ease: "Quad.easeOut",
      onComplete: () => this.go(c, { scale: 0.85, alpha: 0 }, 140),
    });
  }
}
