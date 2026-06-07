/**
 * FxLayer — renders the battle sim's transient FX events (projectiles, melee
 * swings, hits, casts, deaths, loot) as Phaser visuals. Pure presentation; all
 * gameplay lives in BattleState. Effects are short-lived objects cleaned up by
 * their own tweens, so the layer is stateless between calls.
 */
import Phaser from "phaser";
import type { FxEvent } from "../core/battle.ts";
import type { DamageType, Vec2 } from "../data/schema.ts";
import { makeCrisp } from "./ui.ts";

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
  /** World anchor of the gold counter; dropped coins fly here. */
  private readonly goldAnchor: { x: number; y: number };
  /** Factory that creates objects and (if a parent layer is given) parents them
   *  to it, so the battle camera renders FX in world space. */
  private readonly fac: Phaser.GameObjects.GameObjectFactory;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth = 6,
    layer?: Phaser.GameObjects.Layer,
    goldAnchor?: { x: number; y: number },
  ) {
    this.goldAnchor = goldAnchor ?? { x: 472, y: 20 };
    this.fac = layer
      ? new Proxy(scene.add, {
          get(target, prop, recv) {
            const f = Reflect.get(target, prop, recv);
            if (typeof f !== "function") return f;
            return (...args: unknown[]) => {
              const o = (f as (...a: unknown[]) => unknown).apply(target, args);
              if (o && (o as Phaser.GameObjects.GameObject).scene) layer.add(o as Phaser.GameObjects.GameObject);
              return o;
            };
          },
        }) as Phaser.GameObjects.GameObjectFactory
      : scene.add;
  }

  play(e: FxEvent): void {
    switch (e.type) {
      case "attack":
        this.attackFx(e.style, e.from, e.to, e.ranged, e.crit, DMG_COLOR[e.damageType], e.role);
        break;
      case "hit":
        this.spark(e.at, DMG_COLOR[e.damageType]);
        this.damageNumber(e.at, Math.round(e.amount), DMG_NUM_COLOR[e.damageType], e.aoe);
        break;
      case "cast":
        this.skillBurst(e.at, DMG_COLOR[e.damageType], e.radius, e.skillId, e.source);
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
      case "bossCast":
        this.bossCast(e.at, e.skill, e.radius, e.name);
        break;
    }
  }

  /** A menacing boss-skill cast: dark expanding shock ring + colored core + name. */
  private bossCast(at: Vec2, skill: string, radius: number, name: string): void {
    const color = skill === "barrier" ? 0x8ad8ff : skill === "rally" ? 0x9ccc65 : skill === "summon-surge" ? 0xb085f5 : 0xff5a4a;
    this.ring(at, radius, color, 600);
    this.scene.time.delayedCall(80, () => this.ring(at, radius * 0.7, 0xffffff, 420));
    const core = this.fac.circle(at.x, at.y, 18, color, 0.6).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: core, scale: 2.4, alpha: 0, duration: 460, ease: "Cubic.easeOut", onComplete: () => core.destroy() });
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      const p = this.fac.circle(at.x, at.y, 3, color).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: p, x: at.x + Math.cos(a) * radius * 0.8, y: at.y + Math.sin(a) * radius * 0.8, alpha: 0, scale: 0.2, duration: 520, ease: "Quad.easeOut", onComplete: () => p.destroy() });
    }
    const label = makeCrisp(this.fac.text(at.x, at.y - 34, name, {
      fontFamily: '"Trebuchet MS", system-ui, sans-serif', fontSize: "13px", color: "#ffd2cc", fontStyle: "bold", stroke: "#1a0808", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.depth + 4));
    this.scene.tweens.add({ targets: label, y: at.y - 54, alpha: 0, duration: 1100, ease: "Quad.easeOut", onComplete: () => label.destroy() });
    this.scene.cameras.main.shake(180, 0.006);
  }

  /** A quick enemy strike: a streak toward the target + an impact at the target. */
  private lunge(from: Vec2, to: Vec2): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const sx = from.x + Math.cos(ang) * 8, sy = from.y + Math.sin(ang) * 8;
    const streak = this.fac.rectangle(sx, sy, 12, 3, 0xff6a5a).setRotation(ang).setOrigin(0, 0.5).setDepth(this.depth);
    this.scene.tweens.add({ targets: streak, x: to.x - Math.cos(ang) * 8, y: to.y - Math.sin(ang) * 8, alpha: 0, duration: 160, ease: "Quad.easeIn", onComplete: () => streak.destroy() });
    const impact = this.fac.circle(to.x, to.y, 6, 0xff8a5a, 0.8).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: impact, scale: 1.8, alpha: 0, duration: 200, onComplete: () => impact.destroy() });
  }

  /** Dispatch a per-character attack visual by style (T6). */
  private attackFx(style: string, from: Vec2, to: Vec2, ranged: boolean, crit: boolean, dmgColor: number, role: string): void {
    switch (style) {
      case "lightning": this.bolt(from, to, 0x9fe6ff); this.spark(to, 0x9fe6ff); return;
      case "slash": this.slash(to, crit ? 0xffe07a : dmgColor); return;
      case "hex": this.slash(to, 0xb085f5); return;
      case "arrow": this.arrow(from, to, 0xe8d9a0); return;
      case "fireball": this.orb(from, to, 0xff6a2a, 5.5, 0xffd24d, "round"); return;
      case "iceball": this.orb(from, to, 0x6fc6ff, 5, 0xe1f5ff, "diamond"); return;
      case "arcane": this.orb(from, to, 0xc77dde, 5, 0xeec6ff, "round"); return;
      case "poison": this.orb(from, to, 0x8bc34a, 5, 0xd3ec9e, "round"); return;
      case "holy": this.orb(from, to, 0xffe98a, 4.5, 0xffffff, "round"); return;
      case "cannon": this.orb(from, to, 0x4a4f5a, 7, 0x9aa0ac, "round"); return;
      default:
        if (ranged) this.projectile(from, to, dmgColor, role);
        else this.slash(to, crit ? 0xffe07a : dmgColor);
    }
  }

  /** An arrow — a thin streak that flies to the target and sticks briefly. */
  private arrow(from: Vec2, to: Vec2, color: number): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const shaft = this.fac.rectangle(from.x, from.y, 14, 2.5, color).setRotation(ang).setOrigin(0.5).setDepth(this.depth);
    shaft.setStrokeStyle(1, 0x2a2118, 0.6);
    const dur = Math.min(240, 50 + Phaser.Math.Distance.BetweenPoints(from as Phaser.Types.Math.Vector2Like, to as Phaser.Types.Math.Vector2Like) * 0.85);
    this.scene.tweens.add({
      targets: shaft, x: to.x, y: to.y, duration: dur, ease: "Sine.easeIn",
      onComplete: () => { this.spark(to, color); shaft.destroy(); },
    });
  }

  /** A magic orb (round or diamond) that flies to the target with a glow + a
   *  colored impact burst. Used for fireball/iceball/arcane/poison/holy/cannon. */
  private orb(from: Vec2, to: Vec2, color: number, r: number, core: number, shape: "round" | "diamond" = "round"): void {
    const body = shape === "diamond"
      ? this.fac.star(from.x, from.y, 4, r * 0.5, r, color).setDepth(this.depth)
      : this.fac.circle(from.x, from.y, r, color).setDepth(this.depth);
    if (shape === "round") body.setStrokeStyle(1.5, core, 0.7);
    const glow = this.fac.circle(from.x, from.y, r + 3, color, 0.25).setDepth(this.depth - 1);
    const dur = Math.min(260, 60 + Phaser.Math.Distance.BetweenPoints(from as Phaser.Types.Math.Vector2Like, to as Phaser.Types.Math.Vector2Like) * 0.9);
    this.scene.tweens.add({
      targets: [body, glow], x: to.x, y: to.y, duration: dur, ease: "Sine.easeIn",
      onComplete: () => {
        body.destroy(); glow.destroy();
        const burst = this.fac.circle(to.x, to.y, r + 1, core, 0.9).setDepth(this.depth + 1);
        this.scene.tweens.add({ targets: burst, scale: 2.6, alpha: 0, duration: 240, ease: "Quad.easeOut", onComplete: () => burst.destroy() });
      },
    });
  }

  // ---- primitives ----------------------------------------------------------

  private projectile(from: Vec2, to: Vec2, color: number, role: string): void {
    const isMagic = role === "dot" || role === "debuff" || role === "support";
    const r = isMagic ? 5 : 4;
    const dot = this.fac.circle(from.x, from.y, r, color).setDepth(this.depth);
    dot.setStrokeStyle(2, 0xffffff, 0.5);
    const glow = this.fac.circle(from.x, from.y, r + 3, color, 0.25).setDepth(this.depth - 1);
    const dur = Math.min(260, 60 + Phaser.Math.Distance.BetweenPoints(from as Phaser.Types.Math.Vector2Like, to as Phaser.Types.Math.Vector2Like) * 0.9);
    this.scene.tweens.add({
      targets: [dot, glow], x: to.x, y: to.y, duration: dur, ease: "Sine.easeIn",
      onComplete: () => { glow.destroy(); this.spark(to, color); dot.destroy(); },
    });
  }

  private slash(at: Vec2, color: number): void {
    const g = this.fac.graphics({ x: at.x, y: at.y }).setDepth(this.depth);
    g.lineStyle(3, color, 0.95);
    g.beginPath(); g.arc(0, 0, 16, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(60)); g.strokePath();
    g.setScale(0.5).setAngle(Phaser.Math.Between(-30, 30));
    this.scene.tweens.add({ targets: g, scale: 1.25, alpha: 0, duration: 180, ease: "Quad.easeOut", onComplete: () => g.destroy() });
  }

  private spark(at: Vec2, color: number): void {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.fac.circle(at.x, at.y, 2, color).setDepth(this.depth);
      this.scene.tweens.add({
        targets: p, x: at.x + Math.cos(a) * 14, y: at.y + Math.sin(a) * 14, alpha: 0, scale: 0.3,
        duration: 220, ease: "Quad.easeOut", onComplete: () => p.destroy(),
      });
    }
  }

  private damageNumber(at: Vec2, amount: number, color: string, big: boolean): void {
    if (amount <= 0) return;
    const t = this.fac.text(at.x + Phaser.Math.Between(-6, 6), at.y - 10, String(amount), {
      fontFamily: '"Trebuchet MS", system-ui, sans-serif',
      fontSize: big ? "14px" : "12px", color, fontStyle: "bold", stroke: "#10131c", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(this.depth + 2);
    makeCrisp(t);
    this.scene.tweens.add({ targets: t, y: at.y - 34, alpha: 0, duration: 620, ease: "Quad.easeOut", onComplete: () => t.destroy() });
  }

  private ring(at: Vec2, radius: number, color: number, duration: number): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(3, color, 0.9).setDepth(this.depth);
    c.setFillStyle(color, 0.12);
    this.scene.tweens.add({ targets: c, scale: radius / 6, alpha: 0, duration, ease: "Cubic.easeOut", onComplete: () => c.destroy() });
  }

  /** A fancy layered skill cast: double shockwave + core flash + radial streaks
   *  + the skill's VFX sprite bursting + sparkles (+ a tiny shake for hero casts). */
  private skillBurst(at: Vec2, color: number, radius: number, skillId: string | undefined, source: "tower" | "hero"): void {
    this.ring(at, radius, color, 520);
    this.scene.time.delayedCall(90, () => this.ring(at, radius * 0.62, 0xffffff, 360));

    const core = this.fac.circle(at.x, at.y, 10, 0xffffff, 0.95).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: core, scale: 0.15, alpha: 0, duration: 280, onComplete: () => core.destroy() });

    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const line = this.fac.rectangle(at.x, at.y, 3, 16, color).setOrigin(0.5, 1).setRotation(a).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: line, scaleY: 2.8, alpha: 0, duration: 420, ease: "Quad.easeOut", onComplete: () => line.destroy() });
    }

    const key = skillId ? `vfx__${skillId}` : "";
    if (key && this.scene.textures.exists(key)) {
      const spr = this.fac.image(at.x, at.y, key).setDepth(this.depth + 3).setScale(0.3).setAlpha(0.95);
      this.scene.tweens.add({ targets: spr, scale: 1.7, angle: 60, alpha: 0, duration: 460, ease: "Cubic.easeOut", onComplete: () => spr.destroy() });
    }

    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * 2 * i) / 9 + Math.random() * 0.4;
      const p = this.fac.circle(at.x, at.y, 3, color).setDepth(this.depth + 2);
      this.scene.tweens.add({ targets: p, x: at.x + Math.cos(a) * (radius * 0.7), y: at.y + Math.sin(a) * (radius * 0.7), alpha: 0, scale: 0.2, duration: 460, ease: "Quad.easeOut", onComplete: () => p.destroy() });
    }

    if (source === "hero") this.scene.cameras.main.shake(120, 0.004);
  }

  /** Celebratory burst when a tower gains an in-battle star (T10). */
  starUp(at: Vec2, level: number): void {
    const gold = 0xffd34d;
    const ring = this.fac.circle(at.x, at.y, 8).setStrokeStyle(3, gold, 0.95).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 480, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    const flash = this.fac.circle(at.x, at.y, 16, 0xffffff, 0.8).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 240, onComplete: () => flash.destroy() });
    const n = Math.min(5, Math.max(1, level));
    for (let i = 0; i < n; i++) {
      const sx = at.x + (i - (n - 1) / 2) * 9;
      const st = this.fac.star(sx, at.y, 5, 3.2, 7.5, gold).setStrokeStyle(1.5, 0x9a6a1a).setDepth(this.depth + 3).setScale(0.2);
      this.scene.tweens.add({ targets: st, y: at.y - 34, scale: 1, alpha: 0, duration: 640, delay: i * 55, ease: "Quad.easeOut", onComplete: () => st.destroy() });
    }
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const p = this.fac.circle(at.x, at.y, 2, gold).setDepth(this.depth + 2);
      this.scene.tweens.add({ targets: p, x: at.x + Math.cos(a) * 26, y: at.y + Math.sin(a) * 26, alpha: 0, scale: 0.2, duration: 440, ease: "Quad.easeOut", onComplete: () => p.destroy() });
    }
  }

  private bolt(from: Vec2, to: Vec2, color: number): void {
    const g = this.fac.graphics().setDepth(this.depth + 1);
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
      const p = this.fac.circle(at.x, at.y, boss ? 4 : 3, color).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: p, x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: boss ? 480 : 320, ease: "Quad.easeOut", onComplete: () => p.destroy() });
    }
    const flash = this.fac.circle(at.x, at.y, boss ? 22 : 12, 0xffffff, 0.85).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
  }

  private coinPop(at: Vec2, gold: number): void {
    if (gold <= 0) return;
    const anchor = this.goldAnchor;
    const n = Math.min(4, 1 + Math.floor(gold / 12));
    for (let i = 0; i < n; i++) {
      const coin = this.fac.circle(at.x, at.y, 4, 0xffd34d).setStrokeStyle(1, 0xa9722a).setDepth(this.depth + 2);
      const bx = at.x + Phaser.Math.Between(-16, 16), by = at.y - Phaser.Math.Between(8, 22);
      this.scene.tweens.add({
        targets: coin, x: bx, y: by, duration: 170, ease: "Quad.easeOut",
        onComplete: () => this.scene.tweens.add({
          targets: coin, x: anchor.x, y: anchor.y, scale: 0.35, alpha: 0.15,
          duration: 400, delay: i * 35, ease: "Cubic.easeIn", onComplete: () => coin.destroy(),
        }),
      });
    }
    const txt = this.fac.text(at.x, at.y - 6, `+${gold}`, {
      fontSize: "11px", color: "#ffd86a", fontStyle: "bold", stroke: "#10131c", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: txt, y: at.y - 26, alpha: 0, duration: 560, ease: "Quad.easeOut", onComplete: () => txt.destroy() });
  }
}
