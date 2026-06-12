/**
 * Presenter for the main-menu "living throne hall" atmosphere. Draws the static
 * pieces once (whole-screen darken, radial vignette, warm key-light behind the
 * throne, soft god-ray cones) and animates the live pieces each frame (ray
 * shimmer, drifting dust motes, rising brazier embers, torch flicker). Sits
 * above the painted backdrop (depth -10) and below the diorama (throne depth 1).
 * Pure geometry comes from menuAtmosphere.ts. See
 * docs/superpowers/specs/2026-06-12-cinematic-menu-backdrop-design.md.
 */
import Phaser from "phaser";
import type { MenuAtmosphereSpec } from "./menuAtmosphere.ts";
import { motePos, emberPos, rayAlpha, flicker } from "./menuAtmosphere.ts";

const ADD = Phaser.BlendModes.ADD;

export class MenuBackdropFx {
  private base: Phaser.GameObjects.Graphics;   // static, normal blend (darken + vignette)
  private glow: Phaser.GameObjects.Graphics;   // static, additive (key light + ray cones)
  private anim: Phaser.GameObjects.Graphics;   // per-frame, additive

  constructor(scene: Phaser.Scene, private spec: MenuAtmosphereSpec) {
    this.base = scene.add.graphics().setDepth(-8);
    this.glow = scene.add.graphics().setDepth(-8).setBlendMode(ADD);
    this.anim = scene.add.graphics().setDepth(-7).setBlendMode(ADD);
    this.drawStatic();
  }

  private drawStatic(): void {
    const { dims, vignette: v, keyLight: k, rays } = this.spec;
    // Whole-screen darken so the busy painted hall recedes behind the lit diorama.
    this.base.fillStyle(0x05070c, 0.36).fillRect(0, 0, dims.width, dims.height);
    // Radial vignette: stacked translucent rings, dark at the rim, clear at the hero.
    const RINGS = 18, ringW = (v.outerR - v.innerR) / RINGS + 3;
    for (let i = 1; i <= RINGS; i++) {
      const t = i / RINGS;
      this.base.lineStyle(ringW, 0x000000, (v.edgeAlpha * t * t) / 3);
      this.base.strokeCircle(v.cx, v.cy, v.innerR + (v.outerR - v.innerR) * t);
    }
    // Warm key light behind the throne (additive, soft falloff via stacked discs).
    for (let i = 6; i >= 1; i--) {
      this.glow.fillStyle(k.color, 0.05).fillCircle(k.x, k.y, (k.r * i) / 6);
    }
    // Static god-ray cones (the shimmer rides on top in update()).
    for (const r of rays) {
      this.glow.fillStyle(r.color, r.baseAlpha * 0.7);
      this.glow.beginPath();
      this.glow.moveTo(r.x - r.topW / 2, 0);
      this.glow.lineTo(r.x + r.topW / 2, 0);
      this.glow.lineTo(r.x + r.tilt + r.botW / 2, r.len);
      this.glow.lineTo(r.x + r.tilt - r.botW / 2, r.len);
      this.glow.closePath();
      this.glow.fillPath();
    }
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    const g = this.anim;
    g.clear();
    const { dims, rays, motes, embers, torches } = this.spec;

    // Ray shimmer: a brighter narrow core, alpha breathing.
    for (const r of rays) {
      g.fillStyle(r.color, rayAlpha(r, t));
      g.beginPath();
      g.moveTo(r.x - r.topW / 4, 0);
      g.lineTo(r.x + r.topW / 4, 0);
      g.lineTo(r.x + r.tilt + r.botW / 4, r.len);
      g.lineTo(r.x + r.tilt - r.botW / 4, r.len);
      g.closePath();
      g.fillPath();
    }
    // Torch flicker pools.
    for (const tr of torches) {
      const f = flicker(t, tr.phase);
      g.fillStyle(tr.color, 0.10 + 0.16 * f);
      g.fillCircle(tr.x, tr.y, tr.r * (0.85 + 0.25 * f));
    }
    // Dust motes (cool/white) and rising embers (warm).
    for (const m of motes) {
      const p = motePos(m, t, dims);
      g.fillStyle(0xfff4d8, m.alpha);
      g.fillCircle(p.x, p.y, m.r);
    }
    for (const e of embers) {
      const p = emberPos(e, t, dims);
      g.fillStyle(0xffb060, e.alpha);
      g.fillCircle(p.x, p.y, e.r);
    }
  }

  destroy(): void {
    this.base.destroy();
    this.glow.destroy();
    this.anim.destroy();
  }
}
