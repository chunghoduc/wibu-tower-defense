// src/scenes/skillElementPrims.ts
//
// Low-level drawing primitives shared by the elemental substance renderers
// (skillElementFx.ts extends this). Split out so the element set-pieces file
// stays focused (and under the 500-line cap). Pure presentation — every object
// self-destructs via its own tween; no art assets.
import Phaser from "phaser";

type V = { x: number; y: number };

export class SkillElementPrims {
  constructor(
    protected readonly scene: Phaser.Scene,
    protected readonly fac: Phaser.GameObjects.GameObjectFactory,
    protected readonly depth: number,
  ) {}

  protected tween(
    o: Phaser.GameObjects.GameObject,
    props: Record<string, number>,
    duration: number,
    ease = "Quad.easeOut",
  ): void {
    this.scene.tweens.add({ targets: o, ...props, duration, ease, onComplete: () => o.destroy() });
  }

  protected ring(at: V, radius: number, color: number, duration: number): void {
    const c = this.fac
      .circle(at.x, at.y, 6)
      .setStrokeStyle(3, color, 0.9)
      .setFillStyle(color, 0.1)
      .setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, duration, "Cubic.easeOut");
  }

  /** A slower, thicker ring that lingers (scorch / frost / miasma ground mark). */
  protected lingerRing(at: V, radius: number, color: number, alpha: number, duration: number): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(4, color, alpha).setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, duration, "Sine.easeOut");
  }

  protected disc(
    at: V,
    r: number,
    color: number,
    alpha: number,
    grow: number,
    duration: number,
  ): void {
    const d = this.fac.circle(at.x, at.y, r, color, alpha).setDepth(this.depth + 3);
    this.tween(d, { scale: grow, alpha: 0 }, duration, "Cubic.easeOut");
  }

  protected pillar(at: V, color: number, w: number, h: number): void {
    const col = this.fac
      .rectangle(at.x, at.y, w, h, color, 0.55)
      .setOrigin(0.5, 1)
      .setDepth(this.depth + 1)
      .setScale(1, 0);
    this.scene.tweens.add({
      targets: col,
      scaleY: 1,
      duration: 180,
      ease: "Cubic.easeOut",
      yoyo: true,
      hold: 120,
      onComplete: () => col.destroy(),
    });
    const core = this.fac
      .rectangle(at.x, at.y, w * 0.4, h, 0xffffff, 0.8)
      .setOrigin(0.5, 1)
      .setDepth(this.depth + 2)
      .setScale(1, 0);
    this.scene.tweens.add({
      targets: core,
      scaleY: 1,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
      onComplete: () => core.destroy(),
    });
  }

  /** Rising (-1) or falling (+1) shower of small motes drifting outward. */
  protected shower(at: V, radius: number, n: number, color: () => number, dir: 1 | -1): void {
    for (let i = 0; i < n; i++) {
      const p = this.fac
        .circle(
          at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6),
          at.y,
          Phaser.Math.Between(2, 4),
          color(),
        )
        .setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: p,
        y: at.y + dir * -Phaser.Math.Between(28, 60) * (dir < 0 ? 1 : -1) * -1,
        x: p.x + Phaser.Math.Between(-12, 12),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(520, 760),
        ease: "Sine.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  protected spark(at: V, color: number, n = 5): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.fac.circle(at.x, at.y, 2, color).setDepth(this.depth + 2);
      this.tween(
        p,
        { x: at.x + Math.cos(a) * 16, y: at.y + Math.sin(a) * 16, alpha: 0, scale: 0.3 },
        240,
      );
    }
  }

  protected bladeArc(at: V, color: number, deg: number): void {
    const g = this.fac.graphics({ x: at.x, y: at.y }).setDepth(this.depth + 2);
    g.lineStyle(4, color, 0.95);
    g.beginPath();
    g.arc(0, 0, 20, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(55));
    g.strokePath();
    g.setScale(0.4).setAngle(deg);
    this.tween(g, { scale: 1.4, alpha: 0 }, 200);
  }

  /** A bright jagged bolt + a fading after-image, used for ground arcs. */
  protected jaggedBolt(from: V, to: V, color: number, steps: number): void {
    const g = this.fac.graphics().setDepth(this.depth + 1);
    g.lineStyle(2, color, 0.95);
    g.beginPath();
    g.moveTo(from.x, from.y);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        j = i < steps ? 7 : 0;
      g.lineTo(
        from.x + (to.x - from.x) * t + Phaser.Math.Between(-j, j),
        from.y + (to.y - from.y) * t + Phaser.Math.Between(-j, j),
      );
    }
    g.strokePath();
    this.tween(g, { alpha: 0 }, 200);
  }

  /** A thick sky-to-ground lightning strike with a soft glow halo. */
  protected skyBolt(from: V, to: V, color: number): void {
    const glow = this.fac.graphics().setDepth(this.depth);
    glow.lineStyle(7, color, 0.25);
    const halo = this.fac.graphics().setDepth(this.depth + 1);
    halo.lineStyle(2.5, 0xffffff, 0.95);
    for (const g of [glow, halo]) {
      g.beginPath();
      g.moveTo(from.x, from.y);
      const steps = 8;
      let px: number; // assigned on the first loop pass
      for (let i = 1; i <= steps; i++) {
        const t = i / steps,
          j = i < steps ? 12 : 0;
        px = from.x + (to.x - from.x) * t + Phaser.Math.Between(-j, j);
        g.lineTo(px, from.y + (to.y - from.y) * t);
      }
      g.strokePath();
    }
    this.scene.tweens.add({
      targets: [glow, halo],
      alpha: 0,
      duration: 260,
      ease: "Quad.easeIn",
      onComplete: () => {
        glow.destroy();
        halo.destroy();
      },
    });
  }

  protected sigil(at: V, radius: number, color: number, dir: 1 | -1): void {
    const g = this.fac
      .graphics({ x: at.x, y: at.y })
      .setDepth(this.depth + 1)
      .setAlpha(0);
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(0, 0, radius);
    const ticks = 12;
    for (let i = 0; i < ticks; i++) {
      const a = (Math.PI * 2 * i) / ticks;
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
      onComplete: () => this.tween(g, { alpha: 0, scale: 1.15 }, 220),
    });
  }

  protected spiralMotes(at: V, radius: number, color: number, n = 10): void {
    for (let i = 0; i < n; i++) {
      const a0 = (Math.PI * 2 * i) / n;
      const p = this.fac
        .circle(at.x + Math.cos(a0) * radius * 0.9, at.y + Math.sin(a0) * radius * 0.9, 2.5, color)
        .setDepth(this.depth + 2);
      const a1 = a0 + Math.PI * 1.2;
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a1) * radius * 0.15,
        y: at.y + Math.sin(a1) * radius * 0.15,
        alpha: 0,
        duration: 520,
        ease: "Sine.easeIn",
        onComplete: () => p.destroy(),
      });
    }
  }
}
