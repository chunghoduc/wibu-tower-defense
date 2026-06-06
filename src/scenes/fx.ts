/**
 * FxLayer — renders the battle sim's transient FX events (projectiles, melee
 * swings, hits, casts, deaths, loot) as Phaser visuals. Pure presentation; all
 * gameplay lives in BattleState. Effects are short-lived objects cleaned up by
 * their own tweens, so the layer is stateless between calls.
 */
import Phaser from "phaser";
import type { FxEvent } from "../core/battle.ts";
import type { DamageType, Vec2 } from "../data/schema.ts";

const DMG_COLOR: Record<DamageType, number> = {
  Physical: 0xe9eef7,
  Magic: 0xc77dde,
  True: 0xfff3a0,
};
const DMG_NUM_COLOR: Record<DamageType, string> = {
  Physical: "#ffffff",
  Magic: "#e0a8ff",
  True: "#fff3a0",
};

export class FxLayer {
  constructor(private readonly scene: Phaser.Scene, private readonly depth = 6) {}

  play(e: FxEvent): void {
    switch (e.type) {
      case "attack":
        if (e.ranged) this.projectile(e.from, e.to, DMG_COLOR[e.damageType], e.role);
        else this.slash(e.to, e.crit ? 0xffe07a : DMG_COLOR[e.damageType]);
        break;
      case "hit":
        this.spark(e.at, DMG_COLOR[e.damageType]);
        this.damageNumber(e.at, Math.round(e.amount), DMG_NUM_COLOR[e.damageType], e.aoe);
        break;
      case "cast":
        this.ring(e.at, e.radius, DMG_COLOR[e.damageType], 520);
        this.burstStar(e.at, DMG_COLOR[e.damageType]);
        break;
      case "splash":
        this.ring(e.at, e.radius, DMG_COLOR[e.damageType], 320);
        break;
      case "chain":
        this.bolt(e.from, e.to, 0x9fe6ff);
        break;
      case "death":
        this.deathBurst(e.at, e.boss);
        break;
      case "loot":
        this.coinPop(e.at, e.gold);
        break;
      case "enemyAttack":
        this.lunge(e.at, e.targetAt);
        break;
    }
  }

  /** A quick enemy strike: a streak toward the target + an impact at the target. */
  private lunge(from: Vec2, to: Vec2): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const sx = from.x + Math.cos(ang) * 8, sy = from.y + Math.sin(ang) * 8;
    const streak = this.scene.add.rectangle(sx, sy, 12, 3, 0xff6a5a).setRotation(ang).setOrigin(0, 0.5).setDepth(this.depth);
    this.scene.tweens.add({ targets: streak, x: to.x - Math.cos(ang) * 8, y: to.y - Math.sin(ang) * 8, alpha: 0, duration: 160, ease: "Quad.easeIn", onComplete: () => streak.destroy() });
    const impact = this.scene.add.circle(to.x, to.y, 6, 0xff8a5a, 0.8).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: impact, scale: 1.8, alpha: 0, duration: 200, onComplete: () => impact.destroy() });
  }

  // ---- primitives ----------------------------------------------------------

  private projectile(from: Vec2, to: Vec2, color: number, role: string): void {
    const isMagic = role === "dot" || role === "debuff" || role === "support";
    const r = isMagic ? 5 : 4;
    const dot = this.scene.add.circle(from.x, from.y, r, color).setDepth(this.depth);
    dot.setStrokeStyle(2, 0xffffff, 0.5);
    const glow = this.scene.add.circle(from.x, from.y, r + 3, color, 0.25).setDepth(this.depth - 1);
    const dur = Math.min(260, 60 + Phaser.Math.Distance.BetweenPoints(from as Phaser.Types.Math.Vector2Like, to as Phaser.Types.Math.Vector2Like) * 0.9);
    this.scene.tweens.add({
      targets: [dot, glow], x: to.x, y: to.y, duration: dur, ease: "Sine.easeIn",
      onComplete: () => { glow.destroy(); this.spark(to, color); dot.destroy(); },
    });
  }

  private slash(at: Vec2, color: number): void {
    const g = this.scene.add.graphics({ x: at.x, y: at.y }).setDepth(this.depth);
    g.lineStyle(3, color, 0.95);
    g.beginPath(); g.arc(0, 0, 16, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(60)); g.strokePath();
    g.setScale(0.5).setAngle(Phaser.Math.Between(-30, 30));
    this.scene.tweens.add({ targets: g, scale: 1.25, alpha: 0, duration: 180, ease: "Quad.easeOut", onComplete: () => g.destroy() });
  }

  private spark(at: Vec2, color: number): void {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.scene.add.circle(at.x, at.y, 2, color).setDepth(this.depth);
      this.scene.tweens.add({
        targets: p, x: at.x + Math.cos(a) * 14, y: at.y + Math.sin(a) * 14, alpha: 0, scale: 0.3,
        duration: 220, ease: "Quad.easeOut", onComplete: () => p.destroy(),
      });
    }
  }

  private damageNumber(at: Vec2, amount: number, color: string, big: boolean): void {
    if (amount <= 0) return;
    const t = this.scene.add.text(at.x + Phaser.Math.Between(-6, 6), at.y - 10, String(amount), {
      fontSize: big ? "13px" : "12px", color, fontStyle: "bold", stroke: "#10131c", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: t, y: at.y - 34, alpha: 0, duration: 620, ease: "Quad.easeOut", onComplete: () => t.destroy() });
  }

  private ring(at: Vec2, radius: number, color: number, duration: number): void {
    const c = this.scene.add.circle(at.x, at.y, 6).setStrokeStyle(3, color, 0.9).setDepth(this.depth);
    c.setFillStyle(color, 0.12);
    this.scene.tweens.add({ targets: c, scale: radius / 6, alpha: 0, duration, ease: "Cubic.easeOut", onComplete: () => c.destroy() });
  }

  private burstStar(at: Vec2, color: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const line = this.scene.add.rectangle(at.x, at.y, 3, 14, color).setOrigin(0.5, 1).setRotation(a).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: line, scaleY: 2.4, alpha: 0, duration: 360, ease: "Quad.easeOut", onComplete: () => line.destroy() });
    }
    const core = this.scene.add.circle(at.x, at.y, 8, 0xffffff, 0.9).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: core, scale: 0.2, alpha: 0, duration: 300, onComplete: () => core.destroy() });
  }

  private bolt(from: Vec2, to: Vec2, color: number): void {
    const g = this.scene.add.graphics().setDepth(this.depth + 1);
    g.lineStyle(2, color, 0.95);
    g.beginPath(); g.moveTo(from.x, from.y);
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

  private deathBurst(at: Vec2, boss: boolean): void {
    const color = boss ? 0xff5a5a : 0xffd27a;
    const n = boss ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const d = boss ? 30 : 18;
      const p = this.scene.add.circle(at.x, at.y, boss ? 4 : 3, color).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: p, x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: boss ? 480 : 320, ease: "Quad.easeOut", onComplete: () => p.destroy() });
    }
    const flash = this.scene.add.circle(at.x, at.y, boss ? 22 : 12, 0xffffff, 0.85).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
  }

  private coinPop(at: Vec2, gold: number): void {
    if (gold <= 0) return;
    const coin = this.scene.add.circle(at.x, at.y, 4, 0xffd34d).setStrokeStyle(1, 0xa9722a).setDepth(this.depth + 1);
    const tx = at.x + Phaser.Math.Between(-10, 10);
    this.scene.tweens.add({ targets: coin, y: at.y - 16, x: tx, duration: 320, ease: "Quad.easeOut", yoyo: false,
      onComplete: () => { this.scene.tweens.add({ targets: coin, y: at.y + 4, alpha: 0, duration: 260, onComplete: () => coin.destroy() }); } });
  }
}
