/**
 * Animates a dropped reward flying from the kill spot into the hero: it ejects
 * with a small pop, arcs along a lifted bezier (lootFlyArc), shrinks as it
 * nears the hero, then absorbs in a quick flash. Stateless between calls — each
 * flown object is cleaned up by its own tween. Used by FxLayer for gold coins
 * and item/box icons so a kill's spoils visibly fly to the hero.
 */
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";
import { arcControl, bezierPoint } from "./lootFlyArc.ts";
import { iconFitScale } from "./itemIcon.ts";

export interface LootFlyOpts {
  iconKey?: string;        // when set + loaded, fly the real art (item__/box__)
  fallbackColor?: number;  // circle colour when no icon/texture
  delay?: number;          // stagger multiple coins
  iconFit?: number;        // longest-edge px for an icon (default 22)
}

type FlyObject = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

export class LootFlyFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
  ) {}

  /** Fly one reward object from `from` to the hero at `to`. */
  fly(from: Vec2, to: Vec2, kind: "coin" | "icon", opts: LootFlyOpts = {}): void {
    const obj = this.makeObject(from, kind, opts);
    const delay = opts.delay ?? 0;

    // 1) Eject: scatter to a small offset and pop slightly larger.
    const ex = from.x + Phaser.Math.Between(-14, 14);
    const ey = from.y - Phaser.Math.Between(10, 24);
    const baseScale = obj.scale;
    this.scene.tweens.add({
      targets: obj, x: ex, y: ey, scale: baseScale * 1.15, duration: 160, delay,
      ease: "Quad.easeOut",
      onComplete: () => this.flyToHero({ x: ex, y: ey }, to, obj, baseScale),
    });
  }

  /** Drive a {t} proxy along the bezier, scaling down toward the hero. */
  private flyToHero(start: Vec2, to: Vec2, obj: FlyObject, baseScale: number): void {
    const ctrl = arcControl(start, to, 46);
    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy, t: 1, duration: 760, ease: "Sine.easeInOut",
      onUpdate: () => {
        const p = bezierPoint(start, ctrl, to, proxy.t);
        obj.setPosition(p.x, p.y);
        obj.setScale(baseScale * (1 - 0.5 * proxy.t));
      },
      onComplete: () => { this.absorb(to); obj.destroy(); },
    });
  }

  /** A quick white flash where the loot meets the hero. */
  private absorb(at: Vec2): void {
    const flash = this.fac.circle(at.x, at.y, 7, 0xffffff, 0.85).setDepth(this.depth + 3);
    this.scene.tweens.add({ targets: flash, scale: 1.9, alpha: 0, duration: 220, ease: "Quad.easeOut", onComplete: () => flash.destroy() });
  }

  private makeObject(from: Vec2, kind: "coin" | "icon", opts: LootFlyOpts): FlyObject {
    if (kind === "icon" && opts.iconKey && this.scene.textures.exists(opts.iconKey)) {
      const img = this.fac.image(from.x, from.y, opts.iconKey).setDepth(this.depth + 2);
      img.setScale(iconFitScale(img.width, img.height, opts.iconFit ?? 22));
      return img;
    }
    return this.fac.circle(from.x, from.y, 5, opts.fallbackColor ?? 0xffd34d)
      .setStrokeStyle(1, 0xa9722a).setDepth(this.depth + 2);
  }
}
