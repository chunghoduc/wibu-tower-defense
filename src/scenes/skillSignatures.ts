// src/scenes/skillSignatures.ts
//
// Bespoke per-skill cast set-pieces. Each hero active skill renders ONE unique
// signature here (selected by SkillVfxSpec.signature), built from Phaser shapes +
// tweens — no art assets required. The goal is maximum legibility: every skill
// reads distinctly at a glance, even mid-swarm, by its shape, motion and colour.
//
// All drawing goes through the small `VfxDraw` kit so the signatures stay short.
import Phaser from "phaser";
import type { SkillVfxSpec, SkillSignature } from "../data/skillVfxMeta.ts";

type V = { x: number; y: number };
type Fac = Phaser.GameObjects.GameObjectFactory;

/** Compact drawing kit shared by every signature. Self-destructs each object. */
class VfxDraw {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Fac,
    private readonly depth: number,
  ) {}

  /** Tween a fresh object then destroy it. */
  private go(o: Phaser.GameObjects.GameObject, props: Record<string, number>, dur: number, ease = "Quad.easeOut", delay = 0): void {
    this.scene.tweens.add({ targets: o, ...props, duration: dur, ease, delay, onComplete: () => o.destroy() });
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
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(width, color, alpha).setDepth(this.depth);
    this.go(c, { scale: radius / 6, alpha: 0 }, dur, "Cubic.easeOut");
  }

  /** Bright filled disc that grows and fades — a flash core. */
  disc(at: V, r: number, color: number, alpha: number, grow: number, dur: number): void {
    const d = this.fac.circle(at.x, at.y, r, color, alpha).setDepth(this.depth + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.go(d, { scale: grow, alpha: 0 }, dur, "Cubic.easeOut");
  }

  /** Radial spray of tiny sparks. */
  spark(at: V, color: number, n = 6, reach = 18): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const p = this.fac.circle(at.x, at.y, 2, color).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.go(p, { x: at.x + Math.cos(a) * reach, y: at.y + Math.sin(a) * reach, alpha: 0, scale: 0.3 }, 240);
    }
  }

  /** Drifting motes (dir -1 rise, +1 fall). */
  motes(at: V, radius: number, n: number, color: () => number, dir: 1 | -1): void {
    for (let i = 0; i < n; i++) {
      const p = this.fac.circle(at.x + Phaser.Math.Between(-radius * 0.6, radius * 0.6), at.y, Phaser.Math.Between(2, 4), color())
        .setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.go(p, { y: at.y + dir * Phaser.Math.Between(28, 60), x: p.x + Phaser.Math.Between(-12, 12), alpha: 0, scale: 0.2 }, Phaser.Math.Between(520, 760), "Sine.easeOut");
    }
  }

  /** A sweeping crescent blade-arc (graphics) at a given angle. */
  crescent(at: V, color: number, fromDeg: number, sweepDeg: number, r: number, width: number, dur: number, spin: number): void {
    const g = this.fac.graphics({ x: at.x, y: at.y }).setDepth(this.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(width, color, 0.95);
    g.beginPath();
    g.arc(0, 0, r, Phaser.Math.DegToRad(fromDeg), Phaser.Math.DegToRad(fromDeg + sweepDeg));
    g.strokePath();
    g.setScale(0.4);
    this.go(g, { scale: 1.35, angle: spin, alpha: 0 }, dur, "Cubic.easeOut");
  }

  /** A straight tapering beam from `at` along `angle` (radians). */
  beam(at: V, angle: number, length: number, color: number, width: number, dur: number): void {
    const r = this.fac.rectangle(at.x, at.y, 8, width, color).setOrigin(0, 0.5).setRotation(angle).setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.go(r, { scaleX: length / 8, alpha: 0 }, dur, "Quad.easeOut");
  }

  /** A jagged crack line from `at` toward an angle. */
  crack(at: V, angle: number, length: number, color: number, dur = 260): void {
    const g = this.fac.graphics().setDepth(this.depth + 1);
    g.lineStyle(2.5, color, 0.9);
    g.beginPath(); g.moveTo(at.x, at.y);
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, j = i < steps ? 6 : 0;
      g.lineTo(at.x + Math.cos(angle) * length * t + Phaser.Math.Between(-j, j), at.y + Math.sin(angle) * length * t + Phaser.Math.Between(-j, j));
    }
    g.strokePath();
    this.go(g, { alpha: 0 }, dur, "Quad.easeIn");
  }

  /** Radial ring of erupting triangular shards. */
  shards(at: V, n: number, radius: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + 0.2;
      const tip = { x: at.x + Math.cos(a) * radius * 0.5, y: at.y + Math.sin(a) * radius * 0.5 };
      const s = this.fac.triangle(tip.x, tip.y, 0, 0, 6, -18, 12, 0, color).setDepth(this.depth + 1).setAlpha(0).setScale(0.4)
        .setRotation(a + Math.PI / 2);
      this.scene.tweens.add({ targets: s, alpha: 0.95, scale: 1, duration: 130, yoyo: true, hold: 130, ease: "Quad.easeOut", onComplete: () => s.destroy() });
    }
  }

  /** A rotating sigil ring with tick marks. */
  sigil(at: V, radius: number, color: number, dir: 1 | -1): void {
    const g = this.fac.graphics({ x: at.x, y: at.y }).setDepth(this.depth + 1).setAlpha(0);
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(0, 0, radius);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      g.lineBetween(Math.cos(a) * radius * 0.86, Math.sin(a) * radius * 0.86, Math.cos(a) * radius, Math.sin(a) * radius);
    }
    g.setScale(0.5);
    this.scene.tweens.add({ targets: g, alpha: 0.95, scale: 1, angle: dir * 80, duration: 420, ease: "Cubic.easeOut",
      onComplete: () => this.go(g, { alpha: 0, scale: 1.15 }, 220) });
  }

  /** Small star glyphs blinking around a ring. */
  glyphs(at: V, radius: number, n: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const r = this.fac.star(at.x + Math.cos(a) * radius, at.y + Math.sin(a) * radius, 4, 2, 5.5, color)
        .setDepth(this.depth + 2).setAlpha(0).setAngle(45);
      this.scene.tweens.add({ targets: r, alpha: 1, angle: 225, duration: 240, yoyo: true, hold: 120, onComplete: () => r.destroy() });
    }
  }

  /** A puff of smoke that bloats and fades. */
  smoke(at: V, color: number, size = 10): void {
    const s = this.fac.circle(at.x, at.y, size, color, 0.5).setDepth(this.depth + 1);
    this.go(s, { scale: 2.4, y: at.y - 10, alpha: 0 }, Phaser.Math.Between(420, 620), "Sine.easeOut");
  }

  /** A bright bar that stretches along its length then fades — a gleam streak. */
  gleam(at: V, deg: number, length: number, color: number, width = 4): void {
    const r = this.fac.rectangle(at.x, at.y, 8, width, color).setOrigin(0.5).setAngle(deg).setDepth(this.depth + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.go(r, { scaleX: length / 8, alpha: 0 }, 280, "Quad.easeOut");
  }
}

// ── signatures ──────────────────────────────────────────────────────────────
// Each takes the draw kit, the cast point, the skill's spec, and the splash
// radius. Keep them short and READABLE — the metadata's `appearance` is the spec.

type SigFn = (d: VfxDraw, at: V, s: SkillVfxSpec, radius: number) => void;

const valiantSweep: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.crescent(at, core, -200, 200, radius * 0.9, 6, 360, 40);
  d.crescent(at, hot, -190, 180, radius * 0.6, 3, 320, 40);
  d.ring(at, radius, deep, 480, 3);
  d.gleam(at, 25, radius * 1.4, hot, 4);   // central cross-gleam
  d.gleam(at, 115, radius * 1.4, hot, 4);
  d.spark(at, hot, 8, 20);
  d.motes(at, radius, 10, () => (Math.random() < 0.5 ? core : hot), -1);
};

const spiritComet: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  // implode → erupt
  d.disc(at, radius * 0.55, core, 0.4, 0.06, 280);
  d.after(260, () => {
    d.disc(at, 16, hot, 0.9, 2.4, 240);
    d.ring(at, radius, core, 460, 3);
    d.spark(at, hot, 10, 22);
    // curling wisp trails
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7;
      d.crack(at, a, radius * 0.8, deep, 360);
    }
  });
  d.motes(at, radius, 12, () => (Math.random() < 0.5 ? core : hot), -1);
};

const steelCross: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.crescent(at, core, -130, 110, radius * 0.85, 5, 220, 30);
  d.after(60, () => d.crescent(at, hot, 50, 110, radius * 0.85, 5, 220, -30));
  d.beam(at, 0, radius * 1.2, hot, 4, 240);
  d.beam({ x: at.x - radius * 0.6, y: at.y }, 0, radius * 1.2, deep, 3, 260);
  d.spark(at, hot, 10, 22);
};

const earthshatter: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.disc(at, 22, hot, 0.7, 2.0, 240);
  d.ring(at, radius * 1.05, deep, 560, 5);
  d.shards(at, 9, radius, core);
  for (let i = 0; i < 5; i++) d.smoke({ x: at.x + Phaser.Math.Between(-radius * 0.5, radius * 0.5), y: at.y }, deep, 12);
  d.spark(at, core, 8, 16);
  d.shake(160, 0.006);
};

const guillotine: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.flash(90, 120, 0, 0);
  // a vertical drop slash
  const top = { x: at.x, y: at.y - radius };
  d.beam(top, Math.PI / 2, radius * 2, core, 7, 200);
  d.after(80, () => {
    d.disc(at, 18, hot, 0.9, 2.2, 220);
    // lingering blood-red X afterimage
    d.crescent(at, deep, -135, 90, radius * 0.7, 4, 320, 0);
    d.crescent(at, deep, 45, 90, radius * 0.7, 4, 320, 0);
    d.spark(at, core, 9, 24);
  });
  d.shake(120, 0.005);
};

const tripleVolley: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  [-32, 0, 32].forEach((deg, i) => d.after(i * 45, () => {
    const a = Phaser.Math.DegToRad(deg);
    d.beam(at, a, radius * 1.1, core, 3, 240);
    const tip = { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius };
    d.spark(tip, hot, 5, 12);
  }));
  d.ring(at, radius * 0.7, deep, 360, 2);
};

const piercingLance: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.ring(at, 30, hot, 220, 4);             // sonic muzzle ring
  d.beam(at, 0, radius * 2.2, core, 6, 260);
  d.beam(at, 0, radius * 2.2, hot, 2, 220);
  d.after(40, () => d.beam(at, Math.PI, radius * 0.4, deep, 3, 200)); // recoil flick
  d.spark(at, hot, 7, 16);
};

const manaDetonation: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  [0, 90, 180].forEach((ms, i) => d.after(ms, () => d.ring(at, radius * (0.6 + i * 0.2), core, 460, 3)));
  d.glyphs(at, radius * 0.7, 6, hot);
  d.disc(at, radius * 0.5, core, 0.3, 0.05, 300);
  d.after(280, () => { d.disc(at, 16, hot, 0.9, 2.2, 220); d.spark(at, deep, 9, 20); });
};

const arcaneSupernova: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.flash(100, 150, 90, 200);
  d.ring(at, radius * 1.3, core, 560, 5);
  d.after(90, () => d.ring(at, radius, hot, 460, 3));
  d.sigil(at, radius * 0.95, core, 1);
  d.sigil(at, radius * 0.62, hot, -1);
  d.glyphs(at, radius * 0.8, 8, hot);
  d.disc(at, radius * 0.7, core, 0.3, 0.05, 320);
  d.after(300, () => { d.disc(at, 20, deep, 0.9, 2.6, 260); d.spark(at, hot, 12, 28); });
  d.motes(at, radius, 14, () => (Math.random() < 0.5 ? core : hot), -1);
  d.shake(180, 0.007);
};

const muzzleBarrage: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  for (let i = 0; i < 5; i++) d.after(i * 55, () => {
    const off = { x: at.x + (i - 2) * 8, y: at.y };
    d.disc(off, 9, hot, 0.9, 1.6, 160);                  // muzzle flash
    d.beam(off, Phaser.Math.FloatBetween(-0.15, 0.15), radius, core, 3, 200); // tracer
    d.smoke({ x: off.x, y: off.y }, deep, 6);
  });
};

const concussionBlast: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.disc(at, 24, hot, 0.85, 2.0, 220);
  d.ring(at, radius * 1.1, core, 520, 6);
  for (let i = 0; i < 4; i++) d.smoke({ x: at.x + Phaser.Math.Between(-radius * 0.4, radius * 0.4), y: at.y }, deep, 12);
  d.glyphs({ x: at.x, y: at.y - 14 }, radius * 0.45, 6, hot); // ring of spinning stun-stars overhead
  d.spark(at, core, 8, 18);
  d.shake(150, 0.0055);
};

const hexSigil: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.sigil(at, radius * 0.9, core, -1);
  d.glyphs(at, radius * 0.7, 5, hot);
  // creeping shadow tendrils
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.2;
    d.crack(at, a, radius * 0.9, deep, 420);
  }
  d.disc(at, radius * 0.6, deep, 0.4, 0.1, 360);
  d.motes(at, radius, 8, () => core, 1);
};

const pureTechnique: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.flash(120, 255, 255, 255);
  d.disc(at, 20, hot, 1, 2.4, 260);
  d.ring(at, radius, core, 460, 3);
  // golden filament lines converging to a point
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10;
    const from = { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius };
    d.beam(from, a + Math.PI, radius, deep, 1.5, 220);
  }
  d.spark(at, deep, 10, 22);
};

const voidRift: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  // a dark rift opens with a glowing rim, cracks space, then snaps shut
  d.disc(at, radius * 0.6, deep, 0.85, 1.0, 320);   // black core swell
  d.ring(at, radius * 0.65, hot, 360, 5);            // violet rim
  for (let i = 0; i < 10; i++) {                      // cracks in space
    const a = (Math.PI * 2 * i) / 10;
    d.crack(at, a, radius, hot, 420);
  }
  d.after(300, () => {                                // collapse → snap shut
    d.disc(at, radius * 0.5, core, 0.5, 0.04, 220);
    d.after(180, () => { d.flash(90, 255, 255, 255); d.disc(at, 22, hot, 1, 2.6, 220); d.spark(at, hot, 12, 28); });
  });
  d.shake(200, 0.007);
};

const SIGNATURES: Record<SkillSignature, SigFn> = {
  "valiant-sweep": valiantSweep,
  "spirit-comet": spiritComet,
  "steel-cross": steelCross,
  "earthshatter": earthshatter,
  "guillotine": guillotine,
  "triple-volley": tripleVolley,
  "piercing-lance": piercingLance,
  "mana-detonation": manaDetonation,
  "arcane-supernova": arcaneSupernova,
  "muzzle-barrage": muzzleBarrage,
  "concussion-blast": concussionBlast,
  "hex-sigil": hexSigil,
  "pure-technique": pureTechnique,
  "void-rift": voidRift,
};

/** Whether a given signature key has a renderer (always true for valid specs). */
export function hasSignature(sig: SkillSignature): boolean {
  return sig in SIGNATURES;
}

/** Render a skill's bespoke signature set-piece at `at`. */
export function renderSignature(
  scene: Phaser.Scene, fac: Fac, depth: number, at: V, spec: SkillVfxSpec, radius: number,
): void {
  const d = new VfxDraw(scene, fac, depth);
  SIGNATURES[spec.signature](d, at, spec, radius);
}
