// src/scenes/skillElementFx.ts
//
// Elemental substance renderers for skill casts — the shared base burst plus
// the seven per-style set-pieces (erupting fireballs, frost novas, a sky-strike
// thunderstorm, rotating arcane sigils, toxic miasma, radiant blessings,
// crossing blade arcs). Every set-piece scales with the caster's VfxPower so a
// Legendary cast spits far more substance over a wider, longer-lived area than a
// Common one. Drawing primitives live in the SkillElementPrims base class.
import Phaser from "phaser";
import type { SkillStyle } from "../data/attackStyle.ts";
import { skillTex } from "../data/assetKeys.ts";
import { scaleCount, vfxPower, type VfxPower } from "../data/skillVfxPower.ts";
import { SkillElementPrims } from "./skillElementPrims.ts";

type V = { x: number; y: number };

/** Secondary / highlight colours layered on top of each style's base colour. */
export const ACCENT: Record<SkillStyle, { hot: number; deep: number }> = {
  fire: { hot: 0xffe07a, deep: 0xc01808 },
  ice: { hot: 0xe8f7ff, deep: 0x2b78c8 },
  lightning: { hot: 0xffffff, deep: 0xbfa0ff },
  heal: { hot: 0xffe9a8, deep: 0x4fae54 },
  slash: { hot: 0xffffff, deep: 0xd9a82a },
  poison: { hot: 0xd6f59a, deep: 0x4f7a1f },
  arcane: { hot: 0xf0d4ff, deep: 0x7a4fd0 },
};

export class SkillElementFx extends SkillElementPrims {
  /** Dispatch the elemental substance layer for a keyword-derived style.
   *  `radius` is already the true wave radius (≤ the skill's AoE), so we do NOT
   *  re-apply `p.scale` here — that would push the substance past the hit zone. */
  render(style: SkillStyle, at: V, color: number, radius: number, p: VfxPower = vfxPower()): void {
    const r = radius;
    switch (style) {
      case "fire":
        this.fire(at, color, r, p);
        break;
      case "ice":
        this.ice(at, color, r, p);
        break;
      case "lightning":
        this.lightning(at, color, r, p);
        break;
      case "arcane":
        this.arcane(at, color, r, p);
        break;
      case "poison":
        this.poison(at, color, r, p);
        break;
      case "heal":
        this.heal(at, color, r, p);
        break;
      case "slash":
        this.slash(at, color, r, p);
        break;
    }
  }

  // ── base burst (shared) ───────────────────────────────────────────────────
  baseBurst(
    at: V,
    color: number,
    radius: number,
    skillId: string | undefined,
    p: VfxPower = vfxPower(),
  ): void {
    // `radius` is already the wave radius — bound the burst to the true hit zone.
    const r = radius;
    this.ring(at, r, color, 520 * p.duration);
    this.scene.time.delayedCall(90, () => this.ring(at, r * 0.6, 0xffffff, 360));
    const core = this.fac.circle(at.x, at.y, 12 * p.scale, 0xffffff, 0.95).setDepth(this.depth + 3);
    this.tween(core, { scale: 0.12, alpha: 0 }, 280);
    const rays = scaleCount(12, p);
    for (let i = 0; i < rays; i++) {
      const a = (Math.PI * 2 * i) / rays;
      const line = this.fac
        .rectangle(at.x, at.y, 3, 16, color)
        .setOrigin(0.5, 1)
        .setRotation(a)
        .setDepth(this.depth + 1);
      this.tween(line, { scaleY: 3 * p.scale, alpha: 0 }, 420 * p.duration);
    }
    // Emblem flare: prefer a dedicated vfx texture, else reuse the skill's icon.
    const key = skillId
      ? ([`vfx__${skillId}`, skillTex(skillId)].find((k) => this.scene.textures.exists(k)) ?? "")
      : "";
    if (key) {
      const spr = this.fac
        .image(at.x, at.y, key)
        .setDepth(this.depth + 4)
        .setScale(0.3)
        .setAlpha(0.95);
      this.tween(
        spr,
        { scale: 1.7 * p.scale, angle: 50, alpha: 0 },
        460 * p.duration,
        "Cubic.easeOut",
      );
    }
  }

  // ── fire: erupting fireballs + flame plumes + embers ──────────────────────
  private fire(at: V, color: number, radius: number, p: VfxPower): void {
    const { hot, deep } = ACCENT.fire;
    this.disc(at, 26 * p.scale, hot, 0.85, 1.9, 240); // hot flash core
    this.lingerRing(at, radius * 1.05, deep, 0.5, 700 * p.duration); // scorch ring
    const balls = scaleCount(5, p);
    for (let i = 0; i < balls; i++) {
      // fireballs arcing out + bursting
      const a = (Math.PI * 2 * i) / balls + Math.random() * 0.5;
      const d = radius * (0.55 + Math.random() * 0.4);
      const ball = this.fac
        .circle(at.x, at.y, 6, color)
        .setStrokeStyle(2, hot, 0.9)
        .setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: ball,
        x: at.x + Math.cos(a) * d,
        y: at.y + Math.sin(a) * d,
        scale: 1.5,
        duration: 360,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.spark({ x: ball.x, y: ball.y }, hot, 6);
          ball.destroy();
        },
      });
    }
    const plumes = scaleCount(7, p);
    for (let i = 0; i < plumes; i++) {
      // rising flame plumes
      const px = at.x + Phaser.Math.Between(-radius * 0.5, radius * 0.5);
      const plume = this.fac
        .rectangle(px, at.y + 4, Phaser.Math.Between(5, 9), 10, i % 2 ? hot : color)
        .setOrigin(0.5, 1)
        .setDepth(this.depth + 2)
        .setAlpha(0.9);
      this.scene.tweens.add({
        targets: plume,
        scaleY: Phaser.Math.FloatBetween(2.6, 4.2),
        scaleX: 0.4,
        alpha: 0,
        y: plume.y - 8,
        duration: Phaser.Math.Between(360, 560),
        ease: "Quad.easeOut",
        onComplete: () => plume.destroy(),
      });
    }
    this.shower(at, radius, scaleCount(14, p), () => (Math.random() < 0.5 ? color : hot), -1);
  }

  // ── ice: frost nova + crystal spikes + snowfall ───────────────────────────
  private ice(at: V, color: number, radius: number, p: VfxPower): void {
    const { hot, deep } = ACCENT.ice;
    this.disc(at, 22 * p.scale, hot, 0.6, 2.0, 260);
    this.lingerRing(at, radius * 0.95, deep, 0.55, 620 * p.duration);
    const shards = scaleCount(10, p);
    for (let i = 0; i < shards; i++) {
      // shards radiating + spinning
      const a = (Math.PI * 2 * i) / shards;
      const s = this.fac.star(at.x, at.y, 4, 1.6, 5.5, hot).setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: s,
        x: at.x + Math.cos(a) * radius * 0.85,
        y: at.y + Math.sin(a) * radius * 0.85,
        angle: 220,
        alpha: 0,
        duration: 480,
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
    const spikes = scaleCount(6, p);
    for (let i = 0; i < spikes; i++) {
      // crystal spikes erupting
      const a = (Math.PI * 2 * i) / spikes + 0.3;
      const tip = { x: at.x + Math.cos(a) * radius * 0.5, y: at.y + Math.sin(a) * radius * 0.5 };
      const spike = this.fac
        .triangle(tip.x, tip.y, 0, 0, 5, -16, 10, 0, color)
        .setDepth(this.depth + 1)
        .setAlpha(0)
        .setScale(0.5);
      this.scene.tweens.add({
        targets: spike,
        alpha: 0.95,
        scale: 1,
        duration: 130,
        yoyo: true,
        hold: 120,
        ease: "Quad.easeOut",
        onComplete: () => spike.destroy(),
      });
    }
    this.shower(at, radius, scaleCount(16, p), () => (Math.random() < 0.5 ? 0xffffff : hot), 1);
  }

  // ── lightning: a sky-strike THUNDERSTORM ──────────────────────────────────
  private lightning(at: V, color: number, radius: number, p: VfxPower): void {
    const { hot, deep } = ACCENT.lightning;
    // A localized sky-glow over the strike zone (was a full-screen camera flash
    // that strobed the whole screen every storm cast).
    this.disc({ x: at.x, y: at.y - radius * 0.6 }, radius * 1.1, hot, 0.45, 1.6, 240);
    const strikes = scaleCount(5, p);
    for (let i = 0; i < strikes; i++) {
      const sx = at.x + Phaser.Math.Between(-radius, radius);
      const tx = at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6);
      const ty = at.y + Phaser.Math.Between(-6, 8);
      this.scene.time.delayedCall(i * 45, () => {
        this.skyBolt({ x: sx, y: at.y - 230 }, { x: tx, y: ty }, i % 2 ? color : hot);
        this.disc({ x: tx, y: ty }, 14, hot, 0.9, 2.2, 200);
        this.spark({ x: tx, y: ty }, color, 7);
      });
    }
    const arcs = scaleCount(7, p);
    for (let i = 0; i < arcs; i++) {
      // ground arcs from the centre
      const a = (Math.PI * 2 * i) / arcs + Math.random() * 0.3;
      this.jaggedBolt(
        at,
        { x: at.x + Math.cos(a) * radius * 0.9, y: at.y + Math.sin(a) * radius * 0.9 },
        deep,
        5,
      );
    }
  }

  // ── arcane: rotating sigil + rune glyphs + imploding orb ───────────────────
  private arcane(at: V, color: number, radius: number, p: VfxPower): void {
    const { hot, deep } = ACCENT.arcane;
    this.sigil(at, radius * 0.95, color, 1); // two counter-rotating rings
    this.sigil(at, radius * 0.62, hot, -1);
    const runes = scaleCount(6, p);
    for (let i = 0; i < runes; i++) {
      // rune glyphs blinking on the ring
      const a = (Math.PI * 2 * i) / runes;
      const r = this.fac
        .star(at.x + Math.cos(a) * radius * 0.8, at.y + Math.sin(a) * radius * 0.8, 4, 2, 5, hot)
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
    const orb = this.fac.circle(at.x, at.y, radius * 0.7, color, 0.35).setDepth(this.depth + 1); // implode → pop
    this.scene.tweens.add({
      targets: orb,
      scale: 0.05,
      duration: 300,
      ease: "Cubic.easeIn",
      onComplete: () => {
        orb.destroy();
        this.disc(at, 18 * p.scale, deep, 0.9, 2.4, 240);
        this.spark(at, hot, scaleCount(9, p));
      },
    });
    this.spiralMotes(at, radius, hot, scaleCount(10, p));
  }

  // ── poison: drifting toxic miasma + bubbles ───────────────────────────────
  private poison(at: V, color: number, radius: number, p: VfxPower): void {
    const { hot, deep } = ACCENT.poison;
    const blobs = scaleCount(6, p);
    for (let i = 0; i < blobs; i++) {
      // expanding gas blobs that drift up
      const ox = Phaser.Math.Between(-radius * 0.5, radius * 0.5);
      const blob = this.fac
        .circle(at.x + ox, at.y, Phaser.Math.Between(8, 14), i % 2 ? color : deep, 0.5)
        .setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: blob,
        scale: Phaser.Math.FloatBetween(1.8, 2.6),
        y: at.y - Phaser.Math.Between(14, 30),
        alpha: 0,
        duration: Phaser.Math.Between(700, 1000) * p.duration,
        ease: "Sine.easeOut",
        onComplete: () => blob.destroy(),
      });
    }
    const bubbles = scaleCount(10, p);
    for (let i = 0; i < bubbles; i++) {
      // popping bubbles
      const a = (Math.PI * 2 * i) / bubbles;
      const b = this.fac
        .circle(at.x, at.y, Phaser.Math.Between(2, 4), hot, 0.9)
        .setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: b,
        x: at.x + Math.cos(a) * radius * 0.8,
        y: at.y + Math.sin(a) * radius * 0.8 - 6,
        alpha: 0,
        duration: 560,
        ease: "Quad.easeOut",
        onComplete: () => b.destroy(),
      });
    }
    this.lingerRing(at, radius * 0.9, deep, 0.45, 720 * p.duration);
  }

  // ── heal: radiant blessing — light pillar + halo + sparkles ───────────────
  private heal(at: V, color: number, radius: number, p: VfxPower): void {
    const { hot } = ACCENT.heal;
    this.pillar(at, hot, 26, 70 * p.scale);
    this.ring(at, radius, color, 560 * p.duration);
    this.disc(at, 16 * p.scale, 0xffffff, 0.7, 1.8, 320);
    const blessings = scaleCount(8, p);
    for (let i = 0; i < blessings; i++) {
      // rising plus signs + sparkles
      const x = at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6);
      const obj =
        i % 2
          ? this.fac
              .text(x, at.y, "+", {
                fontFamily: "monospace",
                fontSize: "18px",
                color: "#d8ffc4",
                fontStyle: "bold",
              })
              .setOrigin(0.5)
          : this.fac.star(x, at.y, 4, 1.5, 4, hot);
      obj.setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: obj,
        y: at.y - Phaser.Math.Between(30, 58),
        alpha: 0,
        duration: Phaser.Math.Between(620, 820),
        ease: "Quad.easeOut",
        onComplete: () => obj.destroy(),
      });
    }
  }

  // ── slash: crossing blade arcs + horizontal shock line ────────────────────
  private slash(at: V, color: number, radius: number, p: VfxPower): void {
    const { hot } = ACCENT.slash;
    // higher rarity = more crossing arcs (denser flurry of cuts)
    const angles = p.tier >= 3 ? [-72, -24, 24, 72] : [-60, 12, 64];
    angles.forEach((deg, i) =>
      this.scene.time.delayedCall(i * 50, () => this.bladeArc(at, i === 1 ? hot : color, deg)),
    );
    const line = this.fac
      .rectangle(at.x, at.y, 8, 4, hot)
      .setOrigin(0.5)
      .setDepth(this.depth + 2); // horizontal shock
    this.scene.tweens.add({
      targets: line,
      scaleX: radius * 0.6,
      alpha: 0,
      duration: 240,
      ease: "Quad.easeOut",
      onComplete: () => line.destroy(),
    });
    this.spark(at, hot, scaleCount(8, p));
  }
}
