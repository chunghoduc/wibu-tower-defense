// Bespoke per-boss-skill cast set-pieces. Each of the four boss skill types
// (quake/rally/barrier/summon-surge) renders ONE unique, dramatic signature from
// Phaser shapes + tweens — no art assets. Dispatched from fx.ts by skill type via
// bossSkillSignature(); an unknown type draws the cheap legacy ring. Every object
// self-destructs on tween-complete, so this stays stateless between casts.
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";
import { bossSkillSignature } from "../data/bossSkillVfx.ts";
import { makeCrisp } from "./ui.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;
const ADD = Phaser.BlendModes.ADD;

export class BossSkillFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Fac,
    private readonly depth: number,
  ) {}

  /** Entry point: draw the signature for `skillType` at `at`. */
  cast(at: Vec2, skillType: string, radius: number, name: string): void {
    const spec = bossSkillSignature(skillType);
    this.label(at, name, spec.color);
    switch (spec.signature) {
      case "quake":        this.quake(at, radius, spec.color); break;
      case "rally":        this.rally(at, radius, spec.color); break;
      case "barrier":      this.barrier(at, radius, spec.color); break;
      case "summon-surge": this.summonSurge(at, radius, spec.color); break;
      default:             this.ring(at, radius, spec.color, 600);
    }
  }

  // ---- signatures ----------------------------------------------------------

  /** EARTHSHATTER — radial fissures, a slam ring, launched rock shards, heavy shake. */
  private quake(at: Vec2, R: number, color: number): void {
    this.scene.cameras.main.shake(260, 0.011);
    this.ring(at, R, color, 520, 5);
    this.after(90, () => this.ring(at, R * 0.7, 0xffe0b0, 360, 3));
    // ground fissures: thin dark wedges radiating out
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + 0.2;
      const len = R * (0.7 + Math.random() * 0.5);
      const crack = this.fac.rectangle(at.x, at.y, 4, 3, 0x2a1a12).setOrigin(0, 0.5)
        .setRotation(a).setDepth(this.depth);
      this.tween(crack, { scaleX: len / 4, alpha: 0 }, 520, "Cubic.easeOut");
    }
    // launched rock shards arcing up then fading
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const d = R * (0.4 + Math.random() * 0.6);
      const rock = this.fac.rectangle(at.x, at.y, 5, 5, 0x6b4a36).setDepth(this.depth + 2)
        .setRotation(Math.random() * Math.PI);
      this.tween(rock, { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d - 18, angle: 220, alpha: 0 }, 560, "Quad.easeOut");
    }
    this.disc(at, 16, color, 0.7, 2.6, 420);
  }

  /** WAR ROAR — concentric red shockwaves, rising chevrons, an empowerment flash. */
  private rally(at: Vec2, R: number, color: number): void {
    this.scene.cameras.main.flash(160, 120, 20, 20);
    for (let k = 0; k < 3; k++) this.after(k * 110, () => this.ring(at, R, color, 520, 4));
    this.disc(at, 14, color, 0.6, 2.4, 460);
    // rising battle chevrons (allies emboldened)
    for (let i = 0; i < 7; i++) {
      const ox = (Math.random() - 0.5) * R * 1.2;
      const chev = this.fac.star(at.x + ox, at.y + 8, 3, 3, 8, color).setDepth(this.depth + 2).setBlendMode(ADD);
      this.tween(chev, { y: at.y - R * 0.7, alpha: 0, scale: 0.4 }, 700, "Quad.easeOut", i * 30);
    }
  }

  /** AEGIS DOME — hex plates assemble into a shimmering locked dome. */
  private barrier(at: Vec2, R: number, color: number): void {
    const dome = this.fac.circle(at.x, at.y, R * 0.9, color, 0.12).setStrokeStyle(3, color, 0.85)
      .setDepth(this.depth + 1).setScale(0.2);
    this.scene.tweens.add({ targets: dome, scale: 1, duration: 320, ease: "Back.easeOut",
      onComplete: () => this.tween(dome, { alpha: 0, scale: 1.06 }, 520, "Quad.easeIn", 280) });
    // hex plates spiral inward and lock onto the dome
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const sx = at.x + Math.cos(a) * R * 1.4, sy = at.y + Math.sin(a) * R * 1.4;
      const hex = this.fac.star(sx, sy, 6, 5, 9, color, 0.9).setDepth(this.depth + 2).setBlendMode(ADD);
      this.tween(hex, { x: at.x + Math.cos(a) * R * 0.82, y: at.y + Math.sin(a) * R * 0.82, alpha: 0.2, angle: 90 }, 360, "Cubic.easeOut", i * 18);
    }
    this.after(360, () => this.ring(at, R * 0.9, 0xffffff, 300, 2));
  }

  /** RIFT SUMMON — a torn portal with a violet horizon, glyph spin, converging claws. */
  private summonSurge(at: Vec2, R: number, color: number): void {
    this.scene.cameras.main.shake(180, 0.006);
    // the rift core: a dark vertical tear with a violet glow
    const tear = this.fac.ellipse(at.x, at.y, 10, R * 0.5, 0x120018, 0.95).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: tear, scaleX: 3.2, duration: 260, ease: "Back.easeOut",
      onComplete: () => this.tween(tear, { scaleX: 0, alpha: 0 }, 420, "Quad.easeIn", 240) });
    const glow = this.fac.ellipse(at.x, at.y, 18, R * 0.55, color, 0.5).setDepth(this.depth).setBlendMode(ADD);
    this.tween(glow, { scaleX: 3.4, alpha: 0 }, 640, "Cubic.easeOut");
    // spiralling summon glyph
    const glyph = this.fac.star(at.x, at.y, 5, R * 0.18, R * 0.42, color, 0).setStrokeStyle(2, color, 0.9)
      .setDepth(this.depth + 2).setBlendMode(ADD);
    this.tween(glyph, { angle: 200, alpha: 0, scale: 0.4 }, 560, "Quad.easeOut");
    // grasping claw-motes converging then bursting outward
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const claw = this.fac.circle(at.x + Math.cos(a) * R, at.y + Math.sin(a) * R, 3, color).setDepth(this.depth + 2).setBlendMode(ADD);
      this.tween(claw, { x: at.x, y: at.y, alpha: 0.2 }, 300, "Quad.easeIn", i * 12);
    }
  }

  // ---- shared primitives ---------------------------------------------------

  private label(at: Vec2, name: string, color: number): void {
    if (!name) return;
    const t = makeCrisp(this.fac.text(at.x, at.y - 34, name, {
      fontFamily: '"Trebuchet MS", system-ui, sans-serif', fontSize: "13px",
      color: "#ffffff", fontStyle: "bold", stroke: "#1a0808", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.depth + 5));
    t.setTint(color);
    this.tween(t, { y: at.y - 56, alpha: 0 }, 1100, "Quad.easeOut");
  }

  private ring(at: Vec2, radius: number, color: number, dur: number, width = 3): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(width, color, 0.9).setDepth(this.depth);
    this.tween(c, { scale: radius / 6, alpha: 0 }, dur, "Cubic.easeOut");
  }

  private disc(at: Vec2, r: number, color: number, alpha: number, grow: number, dur: number): void {
    const d = this.fac.circle(at.x, at.y, r, color, alpha).setDepth(this.depth + 3).setBlendMode(ADD);
    this.tween(d, { scale: grow, alpha: 0 }, dur, "Cubic.easeOut");
  }

  private tween(o: Phaser.GameObjects.GameObject, props: Record<string, number>, dur: number, ease = "Quad.easeOut", delay = 0): void {
    this.scene.tweens.add({ targets: o, ...props, duration: dur, ease, delay, onComplete: () => o.destroy() });
  }

  private after(ms: number, fn: () => void): void {
    this.scene.time.delayedCall(ms, fn);
  }
}
