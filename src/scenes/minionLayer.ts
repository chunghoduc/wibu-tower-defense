/**
 * Procedural renderer for friendly summoned minions — no sprite art, so it never
 * touches the SDXL pipeline. Each minion is an element-coloured spirit: a glowing
 * core, a counter-rotating rune ring, and a thin lifespan arc. Pooled by uid; a
 * minion fades out over its final second and is freed when it despawns.
 */
import Phaser from "phaser";
import type { MinionRuntime } from "../core/battleTypes.ts";
import type { SummonElement } from "../data/summons.ts";
import { DEPTH } from "./battleDepths.ts";

const ELEMENT_COLOR: Record<SummonElement, { core: number; ring: number }> = {
  fire: { core: 0xff7a2a, ring: 0xffd06a },
  ice: { core: 0x6fc6ff, ring: 0xe8f7ff },
  lightning: { core: 0x9fe6ff, ring: 0xffffff },
  arcane: { core: 0xc77dde, ring: 0xf0c6ff },
  physical: { core: 0xcfd6e0, ring: 0xffffff },
};

interface MinionGfx {
  container: Phaser.GameObjects.Container;
  core: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Graphics;
  arc: Phaser.GameObjects.Graphics;
  color: { core: number; ring: number };
  phase: number;
}

export class MinionLayer {
  private readonly pool = new Map<number, MinionGfx>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
  ) {}

  /** Re-sync the visible minions to the sim list and animate them. */
  update(minions: readonly MinionRuntime[]): void {
    const seen = new Set<number>();
    for (const m of minions) {
      if (!m.alive) continue;
      seen.add(m.uid);
      const g = this.pool.get(m.uid) ?? this.spawn(m);
      this.animate(g, m);
    }
    for (const [uid, g] of this.pool) {
      if (!seen.has(uid)) {
        g.container.destroy();
        this.pool.delete(uid);
      }
    }
  }

  private spawn(m: MinionRuntime): MinionGfx {
    const color = ELEMENT_COLOR[m.def.element];
    const glow = this.scene.add
      .circle(0, 0, 18, color.core, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD);
    const core = this.scene.add
      .circle(0, 0, 8, color.core, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.scene.add.graphics();
    const arc = this.scene.add.graphics();
    const container = this.scene.add.container(m.pos.x, m.pos.y, [glow, ring, core, arc]);
    container.setDepth(DEPTH.HERO);
    this.layer.add(container);
    const g: MinionGfx = { container, core, glow, ring, arc, color, phase: 0 };
    return (this.pool.set(m.uid, g), g);
  }

  private animate(g: MinionGfx, m: MinionRuntime): void {
    g.phase += 0.12;
    g.container.setPosition(m.pos.x, m.pos.y);
    // Fade out over the final second of life.
    const life = Math.max(0, Math.min(1, m.lifespan));
    g.container.setAlpha(life);
    const pulse = 1 + Math.sin(g.phase) * 0.18;
    g.core.setScale(pulse);
    g.glow.setScale(1 + Math.sin(g.phase * 0.7) * 0.12);

    // Counter-rotating rune ring (three orbiting ticks).
    g.ring.clear();
    g.ring.lineStyle(2, g.color.ring, 0.85);
    g.ring.strokeCircle(0, 0, 13);
    for (let i = 0; i < 3; i++) {
      const a = -g.phase + (i / 3) * Math.PI * 2;
      g.ring.fillStyle(g.color.ring, 0.9);
      g.ring.fillCircle(Math.cos(a) * 13, Math.sin(a) * 13, 2.2);
    }

    // Lifespan arc above the minion.
    g.arc.clear();
    const frac = Math.max(0, Math.min(1, m.lifespan / Math.max(0.01, m.maxLifespan)));
    g.arc.lineStyle(2, g.color.ring, 0.6);
    g.arc.beginPath();
    g.arc.arc(0, -22, 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    g.arc.strokePath();
  }

  destroy(): void {
    for (const g of this.pool.values()) g.container.destroy();
    this.pool.clear();
  }
}
