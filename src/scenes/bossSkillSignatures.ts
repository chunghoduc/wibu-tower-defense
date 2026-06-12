// Bespoke per-boss-skill cast set-pieces. Each of the four boss skill types
// (quake/rally/barrier/summon-surge) renders ONE unique, cinematic signature as
// a telegraph -> burst -> aftermath arc from Phaser shapes + tweens — no art
// assets. The palette is themed per boss element via bossSkillTheme(): the SHAPE
// encodes the skill type, the ACCENT encodes the element, so two same-type
// bosses of different elements read differently. Dispatched from fx.ts; an
// unknown type draws the elevated fallback. Shared cinematic primitives live in
// bossSkillFxPrimitives.ts (BossFxKit). Every object self-destructs on
// tween/timer complete, so this stays stateless between casts.
import Phaser from "phaser";
import type { DamageType, Vec2 } from "../data/schema.ts";
import { bossSkillTheme } from "../data/bossSkillVfx.ts";
import { BossFxKit } from "./bossSkillFxPrimitives.ts";
import { makeCrisp } from "./ui.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;
const ADD = Phaser.BlendModes.ADD;

export class BossSkillFx {
  private readonly kit: BossFxKit;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Fac,
    private readonly depth: number,
  ) {
    this.kit = new BossFxKit(scene, fac, depth);
  }

  /** Entry point: draw the themed signature for `skillType` at `at`. */
  cast(at: Vec2, skillType: string, radius: number, name: string, element: DamageType): void {
    const t = bossSkillTheme(skillType, element);
    this.label(at, name, t.primary);
    this.kit.punch(t.weight, t.primary);
    switch (t.signature) {
      case "quake":        this.quake(at, radius, t.primary, t.accent); break;
      case "rally":        this.rally(at, radius, t.primary, t.accent); break;
      case "barrier":      this.barrier(at, radius, t.primary, t.accent); break;
      case "summon-surge": this.summonSurge(at, radius, t.primary, t.accent); break;
      default:             this.fallback(at, radius, t.primary, t.accent); break;
    }
  }

  // ---- signatures: telegraph -> burst -> aftermath -------------------------

  /** EARTHSHATTER — charge, radial fissures + slam rings, launched shards, accent embers. */
  private quake(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.chargeCore(at, R * 0.5, color, 140); // telegraph
    this.kit.after(150, () => {
      this.kit.flare(at, R * 0.9, color, 360);
      this.kit.ring(at, R, color, 520, 5);
      this.kit.ring(at, R * 0.7, 0xffe0b0, 360, 3, 90);
      // ground fissures: thin dark wedges radiating out
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + 0.2;
        const len = R * (0.7 + Math.random() * 0.5);
        const crack = this.fac.rectangle(at.x, at.y, 4, 3, 0x2a1a12).setOrigin(0, 0.5)
          .setRotation(a).setDepth(this.depth);
        this.kit.tween(crack, { scaleX: len / 4, alpha: 0 }, 520, "Cubic.easeOut");
      }
      // launched rock shards arcing up then fading
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const d = R * (0.4 + Math.random() * 0.6);
        const rock = this.fac.rectangle(at.x, at.y, 5, 5, 0x6b4a36).setDepth(this.depth + 2)
          .setRotation(Math.random() * Math.PI);
        this.kit.tween(rock, { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d - 18, angle: 220, alpha: 0 }, 560, "Quad.easeOut");
      }
      this.kit.disc(at, 16, color, 0.7, 2.6, 420);
      this.kit.emberDrift(at, R * 0.8, accent, 9); // aftermath
    });
  }

  /** WAR ROAR — inhale pulse, concentric shockwaves, rising accent chevrons. */
  private rally(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.chargeCore(at, R * 0.4, color, 130); // telegraph
    this.kit.after(140, () => {
      this.kit.flare(at, R * 0.8, color, 320);
      for (let k = 0; k < 3; k++) this.kit.ring(at, R, color, 520, 4, k * 110);
      this.kit.disc(at, 14, color, 0.6, 2.4, 460);
      // rising battle chevrons (allies emboldened)
      for (let i = 0; i < 7; i++) {
        const ox = (Math.random() - 0.5) * R * 1.2;
        const chev = this.fac.star(at.x + ox, at.y + 8, 3, 3, 8, color).setDepth(this.depth + 2).setBlendMode(ADD);
        this.kit.tween(chev, { y: at.y - R * 0.7, alpha: 0, scale: 0.4 }, 700, "Quad.easeOut", i * 30);
      }
      this.kit.emberDrift(at, R * 0.7, accent, 8); // aftermath
    });
  }

  /** AEGIS DOME — plates gather, lock into a shimmering dome, accent shimmer settles. */
  private barrier(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.flare(at, R * 0.7, accent, 260); // soft telegraph glow
    const dome = this.fac.circle(at.x, at.y, R * 0.9, color, 0.12).setStrokeStyle(3, color, 0.85)
      .setDepth(this.depth + 1).setScale(0.2);
    this.scene.tweens.add({ targets: dome, scale: 1, duration: 320, ease: "Back.easeOut",
      onComplete: () => this.kit.tween(dome, { alpha: 0, scale: 1.06 }, 520, "Quad.easeIn", 280) });
    // hex plates spiral inward and lock onto the dome
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const sx = at.x + Math.cos(a) * R * 1.4, sy = at.y + Math.sin(a) * R * 1.4;
      const hex = this.fac.star(sx, sy, 6, 5, 9, color, 0.9).setDepth(this.depth + 2).setBlendMode(ADD);
      this.kit.tween(hex, { x: at.x + Math.cos(a) * R * 0.82, y: at.y + Math.sin(a) * R * 0.82, alpha: 0.2, angle: 90 }, 360, "Cubic.easeOut", i * 18);
    }
    this.kit.ring(at, R * 0.9, 0xffffff, 300, 2, 360);
    this.kit.after(380, () => this.kit.emberDrift(at, R * 0.9, accent, 6)); // aftermath
  }

  /** RIFT SUMMON — converging telegraph claws, a torn portal, accent burst outward. */
  private summonSurge(at: Vec2, R: number, color: number, accent: number): void {
    this.scene.cameras.main.shake(180, 0.006);
    // telegraph: claw-motes converge inward
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const claw = this.fac.circle(at.x + Math.cos(a) * R, at.y + Math.sin(a) * R, 3, accent).setDepth(this.depth + 2).setBlendMode(ADD);
      this.kit.tween(claw, { x: at.x, y: at.y, alpha: 0.2 }, 300, "Quad.easeIn", i * 12);
    }
    this.kit.after(160, () => {
      // the rift core: a dark vertical tear with a violet glow
      const tear = this.fac.ellipse(at.x, at.y, 10, R * 0.5, 0x120018, 0.95).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: tear, scaleX: 3.2, duration: 260, ease: "Back.easeOut",
        onComplete: () => this.kit.tween(tear, { scaleX: 0, alpha: 0 }, 420, "Quad.easeIn", 240) });
      const glow = this.fac.ellipse(at.x, at.y, 18, R * 0.55, color, 0.5).setDepth(this.depth).setBlendMode(ADD);
      this.kit.tween(glow, { scaleX: 3.4, alpha: 0 }, 640, "Cubic.easeOut");
      // spiralling summon glyph
      const glyph = this.fac.star(at.x, at.y, 5, R * 0.18, R * 0.42, color, 0).setStrokeStyle(2, color, 0.9)
        .setDepth(this.depth + 2).setBlendMode(ADD);
      this.kit.tween(glyph, { angle: 200, alpha: 0, scale: 0.4 }, 560, "Quad.easeOut");
      this.kit.flare(at, R * 0.6, accent, 420); // burst bloom
      this.kit.emberDrift(at, R * 0.9, accent, 10); // aftermath
    });
  }

  /** Fallback — a brighter double ring + bloom (no longer a bare single ring). */
  private fallback(at: Vec2, R: number, color: number, accent: number): void {
    this.kit.flare(at, R * 0.7, color, 320);
    this.kit.ring(at, R, color, 600, 4);
    this.kit.ring(at, R * 0.6, accent, 420, 3, 80);
    this.kit.emberDrift(at, R * 0.7, accent, 6);
  }

  // ---- label ---------------------------------------------------------------

  private label(at: Vec2, name: string, color: number): void {
    if (!name) return;
    const t = makeCrisp(this.fac.text(at.x, at.y - 34, name, {
      fontFamily: '"Trebuchet MS", system-ui, sans-serif', fontSize: "13px",
      color: "#ffffff", fontStyle: "bold", stroke: "#1a0808", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.depth + 5));
    t.setTint(color);
    this.kit.tween(t, { y: at.y - 56, alpha: 0 }, 1100, "Quad.easeOut");
  }
}
