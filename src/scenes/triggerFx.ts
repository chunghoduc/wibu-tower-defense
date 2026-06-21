/**
 * TriggerFx — renders the branded flourish for a triggered Unique-item proc
 * (the `trigger` FxEvent). Pure presentation: the sim decides WHAT procced and
 * WHERE; this paints it. Dispatches by the proc's VFX *family* (triggerFxPlan.ts)
 * so the whole vocabulary stays small and readable. Mirrors SkillVfx / BossSkillFx.
 */
import type Phaser from "phaser";
import type { DamageType, Vec2 } from "../data/schema.ts";
import type { TriggerKind } from "../data/triggeredEffects.ts";
import { triggerFxPlan } from "../data/triggerFxPlan.ts";
import { makeCrisp } from "./ui.ts";

const ELEMENT_COLOR: Record<DamageType, number> = {
  Physical: 0xe9eef7,
  Magic: 0xc77dde,
  True: 0xfff3a0,
};

export class TriggerFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
  ) {}

  play(
    kind: TriggerKind,
    at: Vec2,
    to?: Vec2,
    radius?: number,
    element?: DamageType,
  ): void {
    const plan = triggerFxPlan(kind);
    if (!plan) return;
    // `nova` (a blast can be Physical or Magic) reads better in the attack's
    // colour; every other family keeps its signature theme colour.
    const color = element && plan.family === "nova" ? ELEMENT_COLOR[element] : plan.color;
    switch (plan.family) {
      case "recoil":
        this.recoil(at, to ?? at, color, plan.secondary ?? color);
        break;
      case "nova":
        this.nova(at, radius ?? 80, color, plan.secondary ?? color, plan.big);
        break;
      case "frost":
        this.frost(at, radius ?? 70, color, plan.secondary ?? color);
        break;
      case "dotSeed":
        this.dotSeed(at, color, plan.secondary ?? color);
        break;
      case "lifeflare":
        this.lifeflare(at, color, plan.secondary ?? color, plan.big);
        break;
      case "execute":
        this.execute(at, color, plan.secondary ?? color);
        break;
      case "spread":
        this.spread(at, radius ?? 90, color);
        break;
      case "resurrect":
        this.resurrect(at, color, plan.secondary ?? color);
        break;
    }
    if (plan.label) this.banner(at, plan.label, color, plan.big ?? false);
  }

  // ---- families ------------------------------------------------------------

  /** Thorn/counter recoil: a spike streaks from the hero into the attacker, then
   *  a small shard burst on impact. */
  private recoil(from: Vec2, to: Vec2, color: number, accent: number): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const len = Math.min(64, Math.hypot(to.x - from.x, to.y - from.y) || 24);
    const spike = this.fac
      .triangle(from.x, from.y, 0, -3, len, 0, 0, 3, color)
      .setRotation(ang)
      .setOrigin(0, 0.5)
      .setDepth(this.depth + 2)
      .setAlpha(0.95);
    this.scene.tweens.add({
      targets: spike,
      x: to.x,
      y: to.y,
      alpha: 0,
      duration: 200,
      ease: "Quad.easeIn",
      onComplete: () => spike.destroy(),
    });
    // shard burst at the struck attacker
    for (let i = 0; i < 5; i++) {
      const a = ang + Math.PI + (i - 2) * 0.4;
      const s = this.fac
        .triangle(to.x, to.y, 0, 0, 7, 2.5, 0, 5, accent)
        .setRotation(a)
        .setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: s,
        x: to.x + Math.cos(a) * 18,
        y: to.y + Math.sin(a) * 18,
        alpha: 0,
        scale: 0.3,
        duration: 240,
        delay: 90,
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Concussive shockwave: a fast double ring + radial debris. */
  private nova(at: Vec2, radius: number, color: number, accent: number, big = false): void {
    this.shockRing(at, radius, color, big ? 380 : 300);
    this.shockRing(at, radius * 0.7, accent, big ? 300 : 240);
    const n = big ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const p = this.fac.rectangle(at.x, at.y, 8, 3, color).setRotation(a).setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * radius * 0.9,
        y: at.y + Math.sin(a) * radius * 0.9,
        alpha: 0,
        duration: 320,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Chilling control: an ice ring plus a ring of crystal shards (stars). */
  private frost(at: Vec2, radius: number, color: number, accent: number): void {
    this.shockRing(at, radius, color, 360);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const x = at.x + Math.cos(a) * radius * 0.55;
      const y = at.y + Math.sin(a) * radius * 0.55;
      const crystal = this.fac
        .star(x, y, 4, 1.5, 6, accent)
        .setRotation(a)
        .setDepth(this.depth + 2)
        .setScale(0.2)
        .setAlpha(0.95);
      this.scene.tweens.add({
        targets: crystal,
        scale: 1,
        alpha: 0,
        angle: 60,
        duration: 420,
        delay: i * 18,
        ease: "Back.easeOut",
        onComplete: () => crystal.destroy(),
      });
    }
  }

  /** A lingering-damage seed: themed motes drip onto the target. */
  private dotSeed(at: Vec2, color: number, accent: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + 0.3;
      const r = 10 + (i % 2) * 6;
      const mote = this.fac
        .circle(at.x + Math.cos(a) * r, at.y - 12, 2.5 + (i % 2), i % 2 ? accent : color)
        .setDepth(this.depth + 2)
        .setAlpha(0.95);
      this.scene.tweens.add({
        targets: mote,
        x: at.x + Math.cos(a) * 4,
        y: at.y + 2,
        alpha: 0,
        scale: 0.4,
        duration: 460,
        delay: i * 40,
        ease: "Quad.easeIn",
        onComplete: () => mote.destroy(),
      });
    }
  }

  /** Sustain: green/gold life motes spiral inward + a heal cross over the hero. */
  private lifeflare(at: Vec2, color: number, accent: number, big = false): void {
    const n = big ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const r = big ? 40 : 28;
      const mote = this.fac
        .circle(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 3, color)
        .setDepth(this.depth + 2)
        .setAlpha(0.9);
      this.scene.tweens.add({
        targets: mote,
        x: at.x,
        y: at.y - 6,
        alpha: 0,
        scale: 0.3,
        duration: 420,
        delay: i * 25,
        ease: "Quad.easeIn",
        onComplete: () => mote.destroy(),
      });
    }
    // a rising heal cross
    const cross = this.fac
      .star(at.x, at.y - 8, 4, 2, big ? 11 : 8, accent)
      .setAngle(45)
      .setDepth(this.depth + 3)
      .setScale(0.3);
    this.scene.tweens.add({
      targets: cross,
      y: at.y - (big ? 40 : 30),
      scale: 1,
      alpha: 0,
      duration: big ? 720 : 560,
      ease: "Quad.easeOut",
      onComplete: () => cross.destroy(),
    });
  }

  /** Instakill: a decisive crimson X-slash + a spark burst. */
  private execute(at: Vec2, color: number, accent: number): void {
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const slash = this.fac
        .rectangle(at.x, at.y, 38, 5, color)
        .setRotation(rot)
        .setDepth(this.depth + 3)
        .setAlpha(0);
      this.scene.tweens.add({
        targets: slash,
        alpha: { from: 0.95, to: 0 },
        scaleX: { from: 0.4, to: 1.1 },
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => slash.destroy(),
      });
    }
    const flash = this.fac.circle(at.x, at.y, 14, accent, 0.9).setDepth(this.depth + 2);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 220,
      onComplete: () => flash.destroy(),
    });
  }

  /** Contagion: sickly tendrils lash outward to spread plague. */
  private spread(at: Vec2, radius: number, color: number): void {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + 0.2;
      const tendril = this.fac
        .rectangle(at.x, at.y, 4, 3, color)
        .setRotation(a)
        .setOrigin(0, 0.5)
        .setDepth(this.depth + 1)
        .setAlpha(0.85);
      this.scene.tweens.add({
        targets: tendril,
        scaleX: (radius * 0.8) / 4,
        alpha: 0,
        duration: 400,
        ease: "Cubic.easeOut",
        onComplete: () => tendril.destroy(),
      });
    }
  }

  /** Cheat-death: a golden phoenix flare around the hero + a screen-bright flash. */
  private resurrect(at: Vec2, color: number, accent: number): void {
    // bright bloom
    const bloom = this.fac.circle(at.x, at.y, 26, accent, 0.85).setDepth(this.depth + 3);
    this.scene.tweens.add({
      targets: bloom,
      scale: 4,
      alpha: 0,
      duration: 460,
      ease: "Cubic.easeOut",
      onComplete: () => bloom.destroy(),
    });
    // expanding rings
    this.shockRing(at, 90, color, 520);
    this.shockRing(at, 60, accent, 420);
    // rising phoenix feathers
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i - 4.5) * 0.22;
      const feather = this.fac
        .triangle(at.x, at.y, 0, 0, 10, 4, 0, 8, color)
        .setRotation(a)
        .setDepth(this.depth + 2)
        .setAlpha(0.95);
      this.scene.tweens.add({
        targets: feather,
        x: at.x + Math.cos(a) * 70,
        y: at.y + Math.sin(a) * 70,
        alpha: 0,
        scale: 0.4,
        duration: 640,
        delay: i * 22,
        ease: "Quad.easeOut",
        onComplete: () => feather.destroy(),
      });
    }
  }

  // ---- shared primitives ---------------------------------------------------

  private shockRing(at: Vec2, radius: number, color: number, duration: number): void {
    const c = this.fac
      .circle(at.x, at.y, 6)
      .setStrokeStyle(3, color, 0.9)
      .setFillStyle(color, 0.08)
      .setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: c,
      scale: Math.max(1, radius / 6),
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => c.destroy(),
    });
  }

  /** A floating banner for the marquee procs (EXECUTE / SECOND WIND / UNDYING!). */
  private banner(at: Vec2, text: string, color: number, big: boolean): void {
    const hex = "#" + (color >>> 0).toString(16).padStart(6, "0");
    const label = makeCrisp(
      this.fac
        .text(at.x, at.y - (big ? 30 : 20), text, {
          fontFamily: '"Trebuchet MS", system-ui, sans-serif',
          fontSize: big ? "18px" : "13px",
          color: hex,
          fontStyle: "bold",
          stroke: "#0a0d14",
          strokeThickness: big ? 5 : 4,
        })
        .setOrigin(0.5)
        .setDepth(this.depth + 6)
        .setScale(big ? 0.4 : 0.7),
    );
    this.scene.tweens.add({
      targets: label,
      y: at.y - (big ? 64 : 46),
      scale: 1,
      duration: big ? 360 : 280,
      ease: "Back.easeOut",
    });
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      duration: 420,
      delay: big ? 760 : 520,
      onComplete: () => label.destroy(),
    });
  }
}
