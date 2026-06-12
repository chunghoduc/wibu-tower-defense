/**
 * ProjectileFx — ranged-attack travel visuals (gunshot tracers, arrows, magic
 * orbs, plain projectiles, chain bolts) plus the shared hit spark. Extracted
 * from FxLayer; pure presentation — every object self-destructs via its own
 * tween, so callers never clean up.
 */
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";
import { type ImpactFx } from "./impactFx.ts";

export class ProjectileFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
    /** Per-element projectile contact VFX (fire/ice/shock/arcane/poison/…). */
    private readonly impact: ImpactFx,
  ) {}

  /** A gunshot — a fast, dead-straight bullet tracer with a muzzle flash at the
   *  barrel and a bright spark on impact. Snappier than the lobbed arrow/orb. */
  gunshot(from: Vec2, to: Vec2, color: number): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const mx = from.x + Math.cos(ang) * 10,
      my = from.y + Math.sin(ang) * 10;
    const flash = this.fac.circle(mx, my, 4, 0xfff4c2, 0.95).setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: flash,
      scale: 0.2,
      alpha: 0,
      duration: 90,
      onComplete: () => flash.destroy(),
    });
    const tracer = this.fac
      .rectangle(mx, my, 16, 2, color)
      .setRotation(ang)
      .setOrigin(0, 0.5)
      .setDepth(this.depth);
    const dur = Math.min(
      140,
      30 +
        Phaser.Math.Distance.BetweenPoints(
          from as Phaser.Types.Math.Vector2Like,
          to as Phaser.Types.Math.Vector2Like,
        ) *
          0.5,
    );
    this.scene.tweens.add({
      targets: tracer,
      x: to.x,
      y: to.y,
      duration: dur,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.impact.bullet(to, color);
        tracer.destroy();
      },
    });
  }

  /** An arrow — a thin streak that flies to the target and sticks briefly. */
  arrow(from: Vec2, to: Vec2, color: number): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const shaft = this.fac
      .rectangle(from.x, from.y, 14, 2.5, color)
      .setRotation(ang)
      .setOrigin(0.5)
      .setDepth(this.depth);
    shaft.setStrokeStyle(1, 0x2a2118, 0.6);
    const dur = Math.min(
      240,
      50 +
        Phaser.Math.Distance.BetweenPoints(
          from as Phaser.Types.Math.Vector2Like,
          to as Phaser.Types.Math.Vector2Like,
        ) *
          0.85,
    );
    this.scene.tweens.add({
      targets: shaft,
      x: to.x,
      y: to.y,
      duration: dur,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.impact.pierce(to, ang);
        shaft.destroy();
      },
    });
  }

  /** A magic orb (round or diamond) that flies to the target with a glow + a
   *  colored impact burst. Used for fireball/iceball/arcane/poison/holy/cannon. */
  orb(
    from: Vec2,
    to: Vec2,
    color: number,
    r: number,
    core: number,
    shape: "round" | "diamond",
    onImpact: (to: Vec2) => void,
  ): void {
    const body =
      shape === "diamond"
        ? this.fac.star(from.x, from.y, 4, r * 0.5, r, color).setDepth(this.depth)
        : this.fac.circle(from.x, from.y, r, color).setDepth(this.depth);
    if (shape === "round") body.setStrokeStyle(1.5, core, 0.7);
    const glow = this.fac.circle(from.x, from.y, r + 3, color, 0.25).setDepth(this.depth - 1);
    const dur = Math.min(
      260,
      60 +
        Phaser.Math.Distance.BetweenPoints(
          from as Phaser.Types.Math.Vector2Like,
          to as Phaser.Types.Math.Vector2Like,
        ) *
          0.9,
    );
    this.scene.tweens.add({
      targets: [body, glow],
      x: to.x,
      y: to.y,
      duration: dur,
      ease: "Sine.easeIn",
      onComplete: () => {
        body.destroy();
        glow.destroy();
        onImpact(to);
      },
    });
  }

  /** Generic ranged projectile: a glowing dot that flies and sparks on arrival. */
  projectile(from: Vec2, to: Vec2, color: number, role: string): void {
    const isMagic = role === "dot" || role === "debuff" || role === "support";
    const r = isMagic ? 5 : 4;
    const dot = this.fac.circle(from.x, from.y, r, color).setDepth(this.depth);
    dot.setStrokeStyle(2, 0xffffff, 0.5);
    const glow = this.fac.circle(from.x, from.y, r + 3, color, 0.25).setDepth(this.depth - 1);
    const dur = Math.min(
      260,
      60 +
        Phaser.Math.Distance.BetweenPoints(
          from as Phaser.Types.Math.Vector2Like,
          to as Phaser.Types.Math.Vector2Like,
        ) *
          0.9,
    );
    this.scene.tweens.add({
      targets: [dot, glow],
      x: to.x,
      y: to.y,
      duration: dur,
      ease: "Sine.easeIn",
      onComplete: () => {
        glow.destroy();
        this.spark(to, color);
        dot.destroy();
      },
    });
  }

  /** Radial spray of tiny hit sparks. */
  spark(at: Vec2, color: number): void {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.fac.circle(at.x, at.y, 2, color).setDepth(this.depth);
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * 14,
        y: at.y + Math.sin(a) * 14,
        alpha: 0,
        scale: 0.3,
        duration: 220,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  /** A jagged lightning bolt between two points (chain hits / lightning attacks). */
  bolt(from: Vec2, to: Vec2, color: number): void {
    const g = this.fac.graphics().setDepth(this.depth + 1);
    g.lineStyle(2, color, 0.95);
    g.beginPath();
    g.moveTo(from.x, from.y);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const jx = i < steps ? Phaser.Math.Between(-6, 6) : 0;
      const jy = i < steps ? Phaser.Math.Between(-6, 6) : 0;
      g.lineTo(from.x + (to.x - from.x) * t + jx, from.y + (to.y - from.y) * t + jy);
    }
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }
}
