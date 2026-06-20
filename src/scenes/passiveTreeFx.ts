/**
 * Presenter for the passive-tree cosmos. Draws the static backdrop (gradient
 * bands, nebula clouds, star field) once on the tree's MAIN camera, animates the
 * star twinkle + nebula breathing each frame, and rebuilds a glow layer whenever
 * allocation changes (additive halos under unlocked nodes, glowing region-colored
 * connections along allocated paths, radiant keystone auras). All pure geometry
 * comes from passiveTreeAtmosphere.ts. Sits BELOW the scene's node Graphics so
 * nodes always read on top. See
 * docs/superpowers/specs/2026-06-20-passive-tree-beautify-design.md.
 */
import Phaser from "phaser";
import type { PassiveNodeDef } from "../data/schema.ts";
import type { PassiveTreeAtmosphere } from "./passiveTreeAtmosphere.ts";
import { starTwinkle, nebulaPulse } from "./passiveTreeAtmosphere.ts";

const ADD = Phaser.BlendModes.ADD;

type XY = { x: number; y: number };
type ToPixel = (gx: number, gy: number) => XY;

export class PassiveTreeFx {
  private backdrop: Phaser.GameObjects.Graphics; // gradient bands (normal blend)
  private nebulae: Phaser.GameObjects.Graphics; // nebula discs + star field (ADD)
  private glow: Phaser.GameObjects.Graphics; // allocation halos + path glow (ADD)
  private twinkle: Phaser.GameObjects.Graphics; // per-frame star/nebula breathing (ADD)
  private keystoneAuras: { x: number; y: number; r: number; color: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    private spec: PassiveTreeAtmosphere,
  ) {
    this.backdrop = scene.add.graphics().setDepth(-30);
    this.nebulae = scene.add.graphics().setDepth(-25).setBlendMode(ADD);
    this.glow = scene.add.graphics().setDepth(-20).setBlendMode(ADD);
    this.twinkle = scene.add.graphics().setDepth(-19).setBlendMode(ADD);
    this.drawStatic();
  }

  /** Graphics objects, for camera partitioning (all live on the main camera). */
  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.backdrop, this.nebulae, this.glow, this.twinkle];
  }

  private drawStatic(): void {
    const { bands, nebulae, stars, bounds } = this.spec;
    const W = bounds.maxX - bounds.minX;
    // Gradient bands across the whole world rect.
    for (const b of bands) {
      this.backdrop.fillStyle(b.color, b.alpha).fillRect(bounds.minX, b.y, W, b.h);
    }
    // Soft nebula clouds: stacked translucent discs (additive → bright core), tinted.
    for (const n of nebulae) {
      for (let i = 7; i >= 1; i--) {
        this.nebulae.fillStyle(n.color, n.baseAlpha * 0.55).fillCircle(n.x, n.y, (n.r * i) / 7);
      }
    }
    // Static star cores (the twinkle rides on top in update()).
    for (const s of stars) {
      this.nebulae.fillStyle(0xcfe0ff, s.baseAlpha * 0.7).fillCircle(s.x, s.y, s.r);
    }
  }

  /**
   * Rebuild the allocation glow: a halo under each unlocked node, a glowing line
   * along each fully-unlocked connection, and a radiant ring on unlocked keystones.
   */
  drawGlow(
    nodes: PassiveNodeDef[],
    unlockedSet: Set<string>,
    toPixel: ToPixel,
    regionColor: (region: string) => number,
  ): void {
    const g = this.glow;
    g.clear();
    this.keystoneAuras = [];
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // Glowing connections between two unlocked nodes.
    const drawn = new Set<string>();
    for (const node of nodes) {
      if (!unlockedSet.has(node.id)) continue;
      const a = toPixel(node.gridX, node.gridY);
      const col = regionColor(node.region);
      for (const nbrId of node.neighbors) {
        if (!unlockedSet.has(nbrId)) continue;
        const key = [node.id, nbrId].sort().join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const nbr = byId.get(nbrId);
        if (!nbr) continue;
        const b = toPixel(nbr.gridX, nbr.gridY);
        g.lineStyle(6, col, 0.12);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(2.5, col, 0.3);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    // Halo under each unlocked node (stacked discs = soft falloff).
    for (const node of nodes) {
      if (!unlockedSet.has(node.id)) continue;
      const { x, y } = toPixel(node.gridX, node.gridY);
      const col = regionColor(node.region);
      const base = node.type === "keystone" ? 26 : node.type === "notable" ? 18 : 12;
      for (let i = 3; i >= 1; i--) {
        g.fillStyle(col, 0.09).fillCircle(x, y, (base * i) / 3);
      }
      if (node.type === "keystone") this.keystoneAuras.push({ x, y, r: base * 1.4, color: col });
    }
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    const g = this.twinkle;
    g.clear();
    // Star twinkle.
    for (const s of this.spec.stars) {
      g.fillStyle(0xffffff, starTwinkle(s, t) * 0.6).fillCircle(s.x, s.y, s.r);
    }
    // Nebula breathing (a single bright inner disc that pulses).
    for (const n of this.spec.nebulae) {
      g.fillStyle(n.color, n.baseAlpha * nebulaPulse(n, t) * 0.6).fillCircle(n.x, n.y, n.r * 0.4);
    }
    // Keystone aura pulse.
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    for (const a of this.keystoneAuras) {
      g.lineStyle(2, a.color, 0.25 + 0.4 * pulse);
      g.strokeCircle(a.x, a.y, a.r + pulse * 4);
    }
  }

  destroy(): void {
    this.backdrop.destroy();
    this.nebulae.destroy();
    this.glow.destroy();
    this.twinkle.destroy();
  }
}
