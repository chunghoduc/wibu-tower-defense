/**
 * Presenter for the endless siege-atmosphere layer. Draws the static pieces once
 * (edge-darkening vignette + glowing ley-line battle-scars) and animates the live
 * pieces each frame (castle heart-ring pulse, breathing red gate auras, drifting
 * embers). Sits above the painted base texture (depth -10) and below the roads
 * and units. Pure geometry comes from core/endlessBackdrop.ts. Built only for
 * endless arenas, so campaign battles never construct it.
 */
import type Phaser from "phaser";
import type { EndlessBackdropSpec, Scar } from "../core/endlessBackdrop.ts";
import { emberPos } from "../core/endlessBackdrop.ts";

export class EndlessBackdropFx {
  private base: Phaser.GameObjects.Graphics;
  private anim: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private spec: EndlessBackdropSpec,
    layer: Phaser.GameObjects.Layer,
  ) {
    this.base = scene.add.graphics().setDepth(-6);
    this.anim = scene.add.graphics().setDepth(-5);
    layer.add([this.base, this.anim]);
    this.drawStaticLayer();
  }

  private static strokePoly(g: Phaser.GameObjects.Graphics, pts: Scar["points"]): void {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
  }

  /** Static layer: radial vignette (stacked translucent rings) + glowing scars. */
  private drawStaticLayer(): void {
    const g = this.base;
    g.clear();
    const v = this.spec.vignette;
    const RINGS = 18;
    const ringW = (v.outerR - v.innerR) / RINGS + 3;
    for (let i = 1; i <= RINGS; i++) {
      const t = i / RINGS;
      const r = v.innerR + (v.outerR - v.innerR) * t;
      g.lineStyle(ringW, 0x000000, (v.edgeAlpha * t * t) / 3);
      g.strokeCircle(v.cx, v.cy, r);
    }
    for (const s of this.spec.scars) {
      g.lineStyle(s.width * 2.4, s.glow, 0.1); // soft outer glow
      EndlessBackdropFx.strokePoly(g, s.points);
      g.lineStyle(s.width, s.glow, 0.22); // bright core
      EndlessBackdropFx.strokePoly(g, s.points);
    }
  }

  /** Animated layer: castle ring pulse, gate auras, rising embers. */
  update(timeMs: number): void {
    const t = timeMs / 1000;
    const g = this.anim;
    g.clear();

    const cr = this.spec.castleRing;
    const pulse = 1 + Math.sin(t * 2.2) * 0.12;
    g.lineStyle(3, cr.color, 0.32 + Math.sin(t * 2.2) * 0.12);
    g.strokeCircle(cr.cx, cr.cy, cr.baseR * pulse);
    g.lineStyle(2, cr.color, 0.16);
    g.strokeCircle(cr.cx, cr.cy, cr.baseR * pulse * 1.6);

    for (const s of this.spec.scars) {
      const p = s.points[s.points.length - 1]; // gate mouth (on-screen end)
      const aura = 0.12 + (Math.sin(t * 1.6 + p.x * 0.01) * 0.5 + 0.5) * 0.16;
      g.fillStyle(0xff3020, aura);
      g.fillCircle(p.x, p.y, 22);
    }

    for (const e of this.spec.embers) {
      const { x, y } = emberPos(e, t, this.spec.dims);
      g.fillStyle(0xffb060, e.alpha);
      g.fillCircle(x, y, e.r);
    }
  }

  destroy(): void {
    this.base.destroy();
    this.anim.destroy();
  }
}
