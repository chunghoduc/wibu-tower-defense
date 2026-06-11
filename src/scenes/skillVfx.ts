// src/scenes/skillVfx.ts
//
// Cinematic active-skill cast VFX (heroes + towers). Each elemental style gets a
// layered, themed set-piece — erupting fireballs, frost novas, a sky-strike
// thunderstorm, rotating arcane sigils, toxic miasma, radiant blessings, crossing
// blade arcs — built from Phaser shapes + tweens (no art assets). FxLayer
// delegates the "cast" event here; everything is pure presentation.
import Phaser from "phaser";
import { SKILL_STYLE_COLOR, skillStyleFor, type SkillStyle } from "../data/attackStyle.ts";
import { skillVfxSpec, deliveryForStyle } from "../data/skillVfxMeta.ts";
import { renderSignature } from "./skillSignatures.ts";
import { renderDelivery } from "./skillDelivery.ts";
import { VfxDraw } from "./vfxDraw.ts";

type V = { x: number; y: number };

/** Secondary / highlight colours layered on top of each style's base colour. */
const ACCENT: Record<SkillStyle, { hot: number; deep: number }> = {
  fire: { hot: 0xffe07a, deep: 0xc01808 },
  ice: { hot: 0xe8f7ff, deep: 0x2b78c8 },
  lightning: { hot: 0xffffff, deep: 0xbfa0ff },
  heal: { hot: 0xffe9a8, deep: 0x4fae54 },
  slash: { hot: 0xffffff, deep: 0xd9a82a },
  poison: { hot: 0xd6f59a, deep: 0x4f7a1f },
  arcane: { hot: 0xf0d4ff, deep: 0x7a4fd0 },
};

export class SkillVfx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
  ) {}

  /** Render a skill cast. Hero active skills each have a UNIQUE bespoke signature
   *  (skillSignatures.ts); everything else (tower actives) falls back to the
   *  keyword-derived elemental style. */
  cast(from: V, at: V, radius: number, skillId: string | undefined, source: "tower" | "hero"): void {
    const draw = new VfxDraw(this.scene, this.fac, this.depth);
    const spec = skillVfxSpec(skillId);
    if (spec) {
      // Hero skill: deliver from the source (fly / fall / erupt / beam), then fire
      // the bespoke impact set-piece on arrival. baseBurst carries the icon emblem.
      renderDelivery(draw, spec.delivery, from, at, spec.palette, radius, () => {
        this.baseBurst(at, spec.palette.core, radius, skillId);
        renderSignature(this.scene, this.fac, this.depth, at, spec, radius);
      });
      return;
    }
    const style = skillStyleFor(skillId);
    const color = SKILL_STYLE_COLOR[style];
    const accent = ACCENT[style];
    renderDelivery(draw, deliveryForStyle(style), from, at, { core: color, hot: accent.hot, deep: accent.deep }, radius, () => {
      this.baseBurst(at, color, radius, skillId);
      switch (style) {
        case "fire": this.fire(at, color, radius); break;
        case "ice": this.ice(at, color, radius); break;
        case "lightning": this.lightning(at, color, radius); break;
        case "arcane": this.arcane(at, color, radius); break;
        case "poison": this.poison(at, color, radius); break;
        case "heal": this.heal(at, color, radius); break;
        case "slash": this.slash(at, color, radius); break;
      }
      // A bigger cast deserves a bit of weight: shake for the hero + heavy elements.
      if (source === "hero" || style === "lightning" || style === "fire") {
        this.scene.cameras.main.shake(style === "lightning" ? 200 : 130, style === "lightning" ? 0.007 : 0.004);
      }
    });
  }

  // ── base burst (shared) ───────────────────────────────────────────────────
  private baseBurst(at: V, color: number, radius: number, skillId: string | undefined): void {
    this.ring(at, radius, color, 520);
    this.scene.time.delayedCall(90, () => this.ring(at, radius * 0.6, 0xffffff, 360));
    const core = this.fac.circle(at.x, at.y, 12, 0xffffff, 0.95).setDepth(this.depth + 3);
    this.tween(core, { scale: 0.12, alpha: 0 }, 280);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const line = this.fac.rectangle(at.x, at.y, 3, 16, color).setOrigin(0.5, 1).setRotation(a).setDepth(this.depth + 1);
      this.tween(line, { scaleY: 3, alpha: 0 }, 420);
    }
    // Emblem flare: prefer a dedicated vfx texture, else reuse the skill's icon.
    const key = skillId
      ? [`vfx__${skillId}`, `skill__${skillId}`].find((k) => this.scene.textures.exists(k)) ?? ""
      : "";
    if (key) {
      const spr = this.fac.image(at.x, at.y, key).setDepth(this.depth + 4).setScale(0.3).setAlpha(0.95);
      this.tween(spr, { scale: 1.7, angle: 50, alpha: 0 }, 460, "Cubic.easeOut");
    }
  }

  // ── fire: erupting fireballs + flame plumes + embers ──────────────────────
  private fire(at: V, color: number, radius: number): void {
    const { hot, deep } = ACCENT.fire;
    this.disc(at, 26, hot, 0.85, 1.9, 240);                 // hot flash core
    this.lingerRing(at, radius * 1.05, deep, 0.5, 700);     // scorch ring
    for (let i = 0; i < 5; i++) {                            // fireballs arcing out + bursting
      const a = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
      const d = radius * (0.55 + Math.random() * 0.4);
      const ball = this.fac.circle(at.x, at.y, 6, color).setStrokeStyle(2, hot, 0.9).setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: ball, x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, scale: 1.5,
        duration: 360, ease: "Quad.easeOut", onComplete: () => { this.spark({ x: ball.x, y: ball.y }, hot, 6); ball.destroy(); },
      });
    }
    for (let i = 0; i < 7; i++) {                            // rising flame plumes
      const px = at.x + Phaser.Math.Between(-radius * 0.5, radius * 0.5);
      const plume = this.fac.rectangle(px, at.y + 4, Phaser.Math.Between(5, 9), 10, i % 2 ? hot : color)
        .setOrigin(0.5, 1).setDepth(this.depth + 2).setAlpha(0.9);
      this.scene.tweens.add({ targets: plume, scaleY: Phaser.Math.FloatBetween(2.6, 4.2), scaleX: 0.4, alpha: 0, y: plume.y - 8, duration: Phaser.Math.Between(360, 560), ease: "Quad.easeOut", onComplete: () => plume.destroy() });
    }
    this.shower(at, radius, 14, () => (Math.random() < 0.5 ? color : hot), -1); // embers rising
  }

  // ── ice: frost nova + crystal spikes + snowfall ───────────────────────────
  private ice(at: V, color: number, radius: number): void {
    const { hot, deep } = ACCENT.ice;
    this.disc(at, 22, hot, 0.6, 2.0, 260);
    this.lingerRing(at, radius * 0.95, deep, 0.55, 620);
    for (let i = 0; i < 10; i++) {                           // shards radiating + spinning
      const a = (Math.PI * 2 * i) / 10;
      const s = this.fac.star(at.x, at.y, 4, 1.6, 5.5, hot).setDepth(this.depth + 2);
      this.scene.tweens.add({ targets: s, x: at.x + Math.cos(a) * radius * 0.85, y: at.y + Math.sin(a) * radius * 0.85, angle: 220, alpha: 0, duration: 480, ease: "Quad.easeOut", onComplete: () => s.destroy() });
    }
    for (let i = 0; i < 6; i++) {                            // crystal spikes erupting
      const a = (Math.PI * 2 * i) / 6 + 0.3;
      const tip = { x: at.x + Math.cos(a) * radius * 0.5, y: at.y + Math.sin(a) * radius * 0.5 };
      const spike = this.fac.triangle(tip.x, tip.y, 0, 0, 5, -16, 10, 0, color).setDepth(this.depth + 1).setAlpha(0).setScale(0.5);
      this.scene.tweens.add({ targets: spike, alpha: 0.95, scale: 1, duration: 130, yoyo: true, hold: 120, ease: "Quad.easeOut", onComplete: () => spike.destroy() });
    }
    this.shower(at, radius, 16, () => (Math.random() < 0.5 ? 0xffffff : hot), 1); // snow drifting down
  }

  // ── lightning: a sky-strike THUNDERSTORM ──────────────────────────────────
  private lightning(at: V, color: number, radius: number): void {
    const { hot, deep } = ACCENT.lightning;
    this.scene.cameras.main.flash(110, 170, 205, 255);      // sky flash
    const strikes = 5;
    for (let i = 0; i < strikes; i++) {
      const sx = at.x + Phaser.Math.Between(-radius, radius);
      const tx = at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6);
      const ty = at.y + Phaser.Math.Between(-6, 8);
      this.scene.time.delayedCall(i * 55, () => {
        this.skyBolt({ x: sx, y: at.y - 230 }, { x: tx, y: ty }, i % 2 ? color : hot);
        this.disc({ x: tx, y: ty }, 14, hot, 0.9, 2.2, 200);
        this.spark({ x: tx, y: ty }, color, 7);
      });
    }
    for (let i = 0; i < 7; i++) {                            // ground arcs from the centre
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.3;
      this.jaggedBolt(at, { x: at.x + Math.cos(a) * radius * 0.9, y: at.y + Math.sin(a) * radius * 0.9 }, deep, 5);
    }
  }

  // ── arcane: rotating sigil + rune glyphs + imploding orb ───────────────────
  private arcane(at: V, color: number, radius: number): void {
    const { hot, deep } = ACCENT.arcane;
    this.sigil(at, radius * 0.95, color, 1);                 // two counter-rotating rings
    this.sigil(at, radius * 0.62, hot, -1);
    for (let i = 0; i < 6; i++) {                            // rune glyphs blinking on the ring
      const a = (Math.PI * 2 * i) / 6;
      const r = this.fac.star(at.x + Math.cos(a) * radius * 0.8, at.y + Math.sin(a) * radius * 0.8, 4, 2, 5, hot)
        .setDepth(this.depth + 2).setAlpha(0).setAngle(45);
      this.scene.tweens.add({ targets: r, alpha: 1, angle: 225, duration: 240, yoyo: true, hold: 120, onComplete: () => r.destroy() });
    }
    const orb = this.fac.circle(at.x, at.y, radius * 0.7, color, 0.35).setDepth(this.depth + 1); // implode → pop
    this.scene.tweens.add({ targets: orb, scale: 0.05, duration: 300, ease: "Cubic.easeIn", onComplete: () => { orb.destroy(); this.disc(at, 18, deep, 0.9, 2.4, 240); this.spark(at, hot, 9); } });
    this.spiralMotes(at, radius, hot);
  }

  // ── poison: drifting toxic miasma + bubbles ───────────────────────────────
  private poison(at: V, color: number, radius: number): void {
    const { hot, deep } = ACCENT.poison;
    for (let i = 0; i < 6; i++) {                            // expanding gas blobs that drift up
      const ox = Phaser.Math.Between(-radius * 0.5, radius * 0.5);
      const blob = this.fac.circle(at.x + ox, at.y, Phaser.Math.Between(8, 14), i % 2 ? color : deep, 0.5).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: blob, scale: Phaser.Math.FloatBetween(1.8, 2.6), y: at.y - Phaser.Math.Between(14, 30), alpha: 0, duration: Phaser.Math.Between(700, 1000), ease: "Sine.easeOut", onComplete: () => blob.destroy() });
    }
    for (let i = 0; i < 10; i++) {                           // popping bubbles
      const a = (Math.PI * 2 * i) / 10;
      const b = this.fac.circle(at.x, at.y, Phaser.Math.Between(2, 4), hot, 0.9).setDepth(this.depth + 2);
      this.scene.tweens.add({ targets: b, x: at.x + Math.cos(a) * radius * 0.8, y: at.y + Math.sin(a) * radius * 0.8 - 6, alpha: 0, duration: 560, ease: "Quad.easeOut", onComplete: () => b.destroy() });
    }
    this.lingerRing(at, radius * 0.9, deep, 0.45, 720);
  }

  // ── heal: radiant blessing — light pillar + halo + sparkles ───────────────
  private heal(at: V, color: number, radius: number): void {
    const { hot } = ACCENT.heal;
    this.pillar(at, hot, 26, 70);
    this.ring(at, radius, color, 560);
    this.disc(at, 16, 0xffffff, 0.7, 1.8, 320);
    for (let i = 0; i < 8; i++) {                            // rising plus signs + sparkles
      const x = at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6);
      const obj = i % 2
        ? this.fac.text(x, at.y, "+", { fontFamily: "monospace", fontSize: "18px", color: "#d8ffc4", fontStyle: "bold" }).setOrigin(0.5)
        : this.fac.star(x, at.y, 4, 1.5, 4, hot);
      obj.setDepth(this.depth + 2);
      this.scene.tweens.add({ targets: obj, y: at.y - Phaser.Math.Between(30, 58), alpha: 0, duration: Phaser.Math.Between(620, 820), ease: "Quad.easeOut", onComplete: () => obj.destroy() });
    }
  }

  // ── slash: crossing blade arcs + horizontal shock line ────────────────────
  private slash(at: V, color: number, radius: number): void {
    const { hot } = ACCENT.slash;
    [-60, 12, 64].forEach((deg, i) => this.scene.time.delayedCall(i * 55, () => this.bladeArc(at, i === 1 ? hot : color, deg)));
    const line = this.fac.rectangle(at.x, at.y, 8, 4, hot).setOrigin(0.5).setDepth(this.depth + 2); // horizontal shock
    this.scene.tweens.add({ targets: line, scaleX: radius * 0.6, alpha: 0, duration: 240, ease: "Quad.easeOut", onComplete: () => line.destroy() });
    this.spark(at, hot, 8);
  }

  // ── primitives ────────────────────────────────────────────────────────────
  private tween(o: Phaser.GameObjects.GameObject, props: Record<string, number>, duration: number, ease = "Quad.easeOut"): void {
    this.scene.tweens.add({ targets: o, ...props, duration, ease, onComplete: () => o.destroy() });
  }

  private ring(at: V, radius: number, color: number, duration: number): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(3, color, 0.9).setFillStyle(color, 0.1).setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, duration, "Cubic.easeOut");
  }

  /** A slower, thicker ring that lingers (scorch / frost / miasma ground mark). */
  private lingerRing(at: V, radius: number, color: number, alpha: number, duration: number): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(4, color, alpha).setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, duration, "Sine.easeOut");
  }

  private disc(at: V, r: number, color: number, alpha: number, grow: number, duration: number): void {
    const d = this.fac.circle(at.x, at.y, r, color, alpha).setDepth(this.depth + 3);
    this.tween(d, { scale: grow, alpha: 0 }, duration, "Cubic.easeOut");
  }

  private pillar(at: V, color: number, w: number, h: number): void {
    const col = this.fac.rectangle(at.x, at.y, w, h, color, 0.55).setOrigin(0.5, 1).setDepth(this.depth + 1).setScale(1, 0);
    this.scene.tweens.add({ targets: col, scaleY: 1, duration: 180, ease: "Cubic.easeOut", yoyo: true, hold: 120, onComplete: () => col.destroy() });
    const core = this.fac.rectangle(at.x, at.y, w * 0.4, h, 0xffffff, 0.8).setOrigin(0.5, 1).setDepth(this.depth + 2).setScale(1, 0);
    this.scene.tweens.add({ targets: core, scaleY: 1, alpha: 0, duration: 360, ease: "Quad.easeOut", onComplete: () => core.destroy() });
  }

  /** Rising (-1) or falling (+1) shower of small motes drifting outward. */
  private shower(at: V, radius: number, n: number, color: () => number, dir: 1 | -1): void {
    for (let i = 0; i < n; i++) {
      const p = this.fac.circle(at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6), at.y, Phaser.Math.Between(2, 4), color()).setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: p, y: at.y + dir * -Phaser.Math.Between(28, 60) * (dir < 0 ? 1 : -1) * -1,
        x: p.x + Phaser.Math.Between(-12, 12), alpha: 0, scale: 0.2,
        duration: Phaser.Math.Between(520, 760), ease: "Sine.easeOut", onComplete: () => p.destroy(),
      });
    }
  }

  private spark(at: V, color: number, n = 5): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.fac.circle(at.x, at.y, 2, color).setDepth(this.depth + 2);
      this.tween(p, { x: at.x + Math.cos(a) * 16, y: at.y + Math.sin(a) * 16, alpha: 0, scale: 0.3 }, 240);
    }
  }

  private bladeArc(at: V, color: number, deg: number): void {
    const g = this.fac.graphics({ x: at.x, y: at.y }).setDepth(this.depth + 2);
    g.lineStyle(4, color, 0.95);
    g.beginPath(); g.arc(0, 0, 20, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(55)); g.strokePath();
    g.setScale(0.4).setAngle(deg);
    this.tween(g, { scale: 1.4, alpha: 0 }, 200);
  }

  /** A bright jagged bolt + a fading after-image, used for ground arcs. */
  private jaggedBolt(from: V, to: V, color: number, steps: number): void {
    const g = this.fac.graphics().setDepth(this.depth + 1);
    g.lineStyle(2, color, 0.95);
    g.beginPath(); g.moveTo(from.x, from.y);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, j = i < steps ? 7 : 0;
      g.lineTo(from.x + (to.x - from.x) * t + Phaser.Math.Between(-j, j), from.y + (to.y - from.y) * t + Phaser.Math.Between(-j, j));
    }
    g.strokePath();
    this.tween(g, { alpha: 0 }, 200);
  }

  /** A thick sky-to-ground lightning strike with a soft glow halo. */
  private skyBolt(from: V, to: V, color: number): void {
    const glow = this.fac.graphics().setDepth(this.depth);
    glow.lineStyle(7, color, 0.25);
    const halo = this.fac.graphics().setDepth(this.depth + 1);
    halo.lineStyle(2.5, 0xffffff, 0.95);
    for (const g of [glow, halo]) {
      g.beginPath(); g.moveTo(from.x, from.y);
      const steps = 8;
      let px = from.x;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, j = i < steps ? 12 : 0;
        px = from.x + (to.x - from.x) * t + Phaser.Math.Between(-j, j);
        g.lineTo(px, from.y + (to.y - from.y) * t);
      }
      g.strokePath();
    }
    this.scene.tweens.add({ targets: [glow, halo], alpha: 0, duration: 260, ease: "Quad.easeIn", onComplete: () => { glow.destroy(); halo.destroy(); } });
  }

  private sigil(at: V, radius: number, color: number, dir: 1 | -1): void {
    const g = this.fac.graphics({ x: at.x, y: at.y }).setDepth(this.depth + 1).setAlpha(0);
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(0, 0, radius);
    const ticks = 12;
    for (let i = 0; i < ticks; i++) {
      const a = (Math.PI * 2 * i) / ticks;
      g.lineBetween(Math.cos(a) * radius * 0.86, Math.sin(a) * radius * 0.86, Math.cos(a) * radius, Math.sin(a) * radius);
    }
    g.setScale(0.5);
    this.scene.tweens.add({ targets: g, alpha: 0.95, scale: 1, angle: dir * 80, duration: 420, ease: "Cubic.easeOut", onComplete: () => this.tween(g, { alpha: 0, scale: 1.15 }, 220) });
  }

  private spiralMotes(at: V, radius: number, color: number): void {
    for (let i = 0; i < 10; i++) {
      const a0 = (Math.PI * 2 * i) / 10;
      const p = this.fac.circle(at.x + Math.cos(a0) * radius * 0.9, at.y + Math.sin(a0) * radius * 0.9, 2.5, color).setDepth(this.depth + 2);
      const a1 = a0 + Math.PI * 1.2;
      this.scene.tweens.add({ targets: p, x: at.x + Math.cos(a1) * radius * 0.15, y: at.y + Math.sin(a1) * radius * 0.15, alpha: 0, duration: 520, ease: "Sine.easeIn", onComplete: () => p.destroy() });
    }
  }
}
