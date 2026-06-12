/**
 * ImpactFx — renders the *contact* burst a projectile makes when it lands on an
 * enemy, so each element reads distinctly at the point of impact instead of the
 * old one-size generic spark:
 *   - fireball  → bloom + rising embers + scorch flash
 *   - iceball   → crystalline shatter shards + frost ring
 *   - lightning → forked micro-bolts + electric crackle
 *   - arcane    → an implosion that snaps back out through a rune ring
 *   - poison    → splatter droplets + a lingering bubbling cloud
 *   - holy      → a radiant light pillar + golden bloom
 *   - cannon    → smoke puff + flung debris + shockwave (throttled shake)
 *   - arrow     → a directional pierce: dust puff + travel-aligned streaks
 *   - gunshot   → a tight bright spark + ricochet flecks
 *
 * Pure presentation, split out of FxLayer to keep fx.ts small. Conventions match
 * MeleeFx: additive blending for glow, short self-cleaning tweens, and camera
 * shake reserved for the heaviest impact (cannon) and THROTTLED so a volley of
 * cannon hits can't stack into a constant rattle.
 */
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";

const TAU = Math.PI * 2;
const ADD = Phaser.BlendModes.ADD;
/** Minimum gap between camera shakes (ms) so concurrent cannon hits don't pile up. */
const SHAKE_COOLDOWN = 100;

export class ImpactFx {
  /** Scene-clock timestamp of the last camera shake, for throttling. */
  private lastShakeAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
  ) {}

  /** A fireball landing: a hot bloom, scorch flash, and embers drifting upward. */
  fire(at: Vec2): void {
    this.bloom(at, 0xff6a2a, 9, 260);
    this.flash(at, 0xffd24d, 6, 180);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const reach = 10 + Math.random() * 12;
      const e = this.fac
        .circle(at.x, at.y, 1.5 + Math.random() * 1.5, i % 2 ? 0xffb14d : 0xff7a2a)
        .setDepth(this.depth + 1)
        .setBlendMode(ADD);
      this.scene.tweens.add({
        targets: e,
        x: at.x + Math.cos(a) * reach,
        y: at.y + Math.sin(a) * reach - 8,
        alpha: 0,
        scale: 0.2,
        duration: 320 + Math.random() * 160,
        ease: "Quad.easeOut",
        onComplete: () => e.destroy(),
      });
    }
  }

  /** An iceball landing: shards fly out (sharp diamonds) over a frost ring. */
  ice(at: Vec2): void {
    this.ring(at, 18, 0x9fdcff, 280);
    this.flash(at, 0xe1f5ff, 5, 150);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n + Math.random() * 0.4;
      const reach = 12 + Math.random() * 6;
      const shard = this.fac
        .star(at.x, at.y, 3, 1, 4, 0xcdeeff)
        .setRotation(a)
        .setDepth(this.depth + 1)
        .setBlendMode(ADD);
      this.scene.tweens.add({
        targets: shard,
        x: at.x + Math.cos(a) * reach,
        y: at.y + Math.sin(a) * reach,
        alpha: 0,
        scale: 0.3,
        rotation: a + 1,
        duration: 280,
        ease: "Quint.easeOut",
        onComplete: () => shard.destroy(),
      });
    }
  }

  /** A lightning hit: a white core flash plus several jagged micro-bolts. */
  shock(at: Vec2): void {
    this.flash(at, 0xffffff, 7, 160);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n + Math.random() * 0.5;
      const len = 13 + Math.random() * 7;
      const g = this.fac
        .graphics()
        .setDepth(this.depth + 1)
        .setBlendMode(ADD);
      g.lineStyle(1.5, 0x9fe6ff, 0.95);
      g.beginPath();
      g.moveTo(at.x, at.y);
      const segs = 3;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const jx = s < segs ? (Math.random() - 0.5) * 6 : 0;
        const jy = s < segs ? (Math.random() - 0.5) * 6 : 0;
        g.lineTo(at.x + Math.cos(a) * len * t + jx, at.y + Math.sin(a) * len * t + jy);
      }
      g.strokePath();
      this.scene.tweens.add({
        targets: g,
        alpha: 0,
        duration: 180,
        ease: "Quad.easeIn",
        onComplete: () => g.destroy(),
      });
    }
  }

  /** An arcane hit: motes rush inward and the energy snaps back out through a
   *  counter-rotating rune ring. */
  arcane(at: Vec2): void {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const start = 18;
      const p = this.fac
        .circle(at.x + Math.cos(a) * start, at.y + Math.sin(a) * start, 2, 0xeec6ff)
        .setDepth(this.depth + 1)
        .setBlendMode(ADD);
      this.scene.tweens.add({
        targets: p,
        x: at.x,
        y: at.y,
        alpha: 0.4,
        scale: 0.5,
        duration: 150,
        ease: "Quad.easeIn",
        onComplete: () => {
          p.destroy();
        },
      });
    }
    // The release: a flash + an expanding rune ring once the implosion lands.
    this.scene.time.delayedCall(150, () => {
      this.flash(at, 0xeec6ff, 7, 220);
      const ring = this.fac
        .star(at.x, at.y, 6, 4, 8, 0xc77dde)
        .setStrokeStyle(2, 0xeec6ff, 0.9)
        .setDepth(this.depth + 1)
        .setBlendMode(ADD);
      ring.setFillStyle(0xc77dde, 0);
      this.scene.tweens.add({
        targets: ring,
        scale: 3.2,
        alpha: 0,
        rotation: 0.9,
        duration: 300,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
      });
    });
  }

  /** A poison hit: droplets splatter outward, leaving a slow bubbling cloud. */
  poison(at: Vec2): void {
    const cloud = this.fac.circle(at.x, at.y, 7, 0x8bc34a, 0.4).setDepth(this.depth);
    this.scene.tweens.add({
      targets: cloud,
      scale: 2,
      alpha: 0,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => cloud.destroy(),
    });
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6 + Math.random() * 0.6;
      const reach = 9 + Math.random() * 9;
      const drop = this.fac
        .circle(at.x, at.y, 1.5 + Math.random(), 0xb7e36a)
        .setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: drop,
        x: at.x + Math.cos(a) * reach,
        y: at.y + Math.sin(a) * reach,
        alpha: 0,
        scale: 0.4,
        duration: 340,
        ease: "Quad.easeOut",
        onComplete: () => drop.destroy(),
      });
    }
    // A couple of slow rising bubbles for the toxic linger.
    for (let i = 0; i < 3; i++) {
      const bx = at.x + (Math.random() - 0.5) * 10;
      const b = this.fac.circle(bx, at.y, 1.5, 0xd3ec9e, 0.7).setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: b,
        y: at.y - 10 - Math.random() * 6,
        alpha: 0,
        duration: 500,
        delay: 80 + i * 60,
        ease: "Sine.easeOut",
        onComplete: () => b.destroy(),
      });
    }
  }

  /** A holy hit: a brief vertical light pillar over a golden bloom. */
  holy(at: Vec2): void {
    this.bloom(at, 0xffe98a, 8, 280);
    const pillar = this.fac
      .rectangle(at.x, at.y - 14, 7, 34, 0xffffff, 0.55)
      .setDepth(this.depth + 1)
      .setBlendMode(ADD);
    pillar.setScale(1, 0.2);
    this.scene.tweens.add({
      targets: pillar,
      scaleY: 1.1,
      alpha: 0,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => pillar.destroy(),
    });
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const s = this.fac
        .circle(at.x, at.y, 1.5, 0xfff6cf)
        .setDepth(this.depth + 1)
        .setBlendMode(ADD);
      this.scene.tweens.add({
        targets: s,
        x: at.x + Math.cos(a) * 12,
        y: at.y + Math.sin(a) * 14,
        alpha: 0,
        scale: 0.2,
        duration: 360,
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
  }

  /** A cannon hit: a grey smoke puff, flung debris, a shockwave, a small shake. */
  cannon(at: Vec2, ang: number): void {
    this.ring(at, 22, 0x9aa0ac, 320);
    this.flash(at, 0xffe6b0, 7, 150);
    // Smoke — a few expanding translucent puffs.
    for (let i = 0; i < 3; i++) {
      const px = at.x + (Math.random() - 0.5) * 8,
        py = at.y + (Math.random() - 0.5) * 8;
      const puff = this.fac.circle(px, py, 5, 0x6a6f7a, 0.45).setDepth(this.depth);
      this.scene.tweens.add({
        targets: puff,
        scale: 2.4,
        alpha: 0,
        x: px + Math.cos(ang) * 6,
        y: py - 4,
        duration: 480,
        ease: "Sine.easeOut",
        onComplete: () => puff.destroy(),
      });
    }
    // Debris — dark flecks flung roughly forward of the shot.
    for (let i = 0; i < 6; i++) {
      const a = ang + (Math.random() - 0.5) * 2.2;
      const reach = 12 + Math.random() * 10;
      const d = this.fac
        .rectangle(at.x, at.y, 2.5, 2.5, 0x3a3f48)
        .setRotation(a)
        .setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: d,
        x: at.x + Math.cos(a) * reach,
        y: at.y + Math.sin(a) * reach + 4,
        alpha: 0,
        scale: 0.3,
        duration: 360,
        ease: "Quad.easeOut",
        onComplete: () => d.destroy(),
      });
    }
    this.shake(0.0035, 110);
  }

  /** An arrow strike: a directional dust puff and a couple of travel-aligned
   *  streaks, so the hit reads as a thump along the flight line. */
  pierce(at: Vec2, ang: number): void {
    for (let i = 0; i < 4; i++) {
      const a = ang + Math.PI + (Math.random() - 0.5) * 1.4; // scatter back off the surface
      const reach = 8 + Math.random() * 7;
      const p = this.fac.circle(at.x, at.y, 1.5, 0xe8d9a0).setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * reach,
        y: at.y + Math.sin(a) * reach,
        alpha: 0,
        scale: 0.3,
        duration: 240,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
    const streak = this.fac
      .rectangle(at.x, at.y, 10, 2, 0xfff1c8, 0.8)
      .setRotation(ang)
      .setOrigin(0.5)
      .setDepth(this.depth + 1)
      .setBlendMode(ADD);
    this.scene.tweens.add({
      targets: streak,
      scaleX: 0.2,
      alpha: 0,
      duration: 150,
      ease: "Quad.easeOut",
      onComplete: () => streak.destroy(),
    });
  }

  /** A gunshot strike: a tight bright spark plus a few fast ricochet flecks. */
  bullet(at: Vec2, color: number): void {
    this.flash(at, 0xfff4c2, 4, 110);
    for (let i = 0; i < 5; i++) {
      const a = (TAU * i) / 5 + Math.random() * 0.5;
      const reach = 9 + Math.random() * 6;
      const p = this.fac
        .rectangle(at.x, at.y, 3, 1.5, color)
        .setRotation(a)
        .setOrigin(0, 0.5)
        .setDepth(this.depth + 1)
        .setBlendMode(ADD);
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * reach,
        y: at.y + Math.sin(a) * reach,
        alpha: 0,
        scaleX: 0.2,
        duration: 180,
        ease: "Quint.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  // ---- primitives ----------------------------------------------------------

  /** A soft glowing core that blooms outward and fades. Additive. */
  private bloom(at: Vec2, color: number, r: number, dur: number): void {
    const c = this.fac
      .circle(at.x, at.y, r, color, 0.85)
      .setDepth(this.depth + 1)
      .setBlendMode(ADD);
    this.scene.tweens.add({
      targets: c,
      scale: 2.4,
      alpha: 0,
      duration: dur,
      ease: "Quad.easeOut",
      onComplete: () => c.destroy(),
    });
  }

  /** A bright impact flash. Additive. */
  private flash(at: Vec2, color: number, r: number, dur: number): void {
    const f = this.fac
      .circle(at.x, at.y, r, color, 0.9)
      .setDepth(this.depth + 2)
      .setBlendMode(ADD);
    this.scene.tweens.add({
      targets: f,
      scale: 1.8,
      alpha: 0,
      duration: dur,
      ease: "Quad.easeOut",
      onComplete: () => f.destroy(),
    });
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

  /** A tiny camera shake, throttled so simultaneous heavy hits don't stack. */
  private shake(intensity: number, duration: number): void {
    const now = this.scene.time.now;
    if (now - this.lastShakeAt < SHAKE_COOLDOWN) return;
    this.lastShakeAt = now;
    this.scene.cameras.main.shake(duration, intensity);
  }
}
