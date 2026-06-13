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
import { makeCrisp } from "./ui.ts";

export interface LootFlyOpts {
  iconKey?: string; // when set + loaded, fly the real art (item__/box__)
  fallbackColor?: number; // circle colour when no icon/texture
  delay?: number; // stagger multiple coins
  iconFit?: number; // longest-edge px for an icon (default 22)
  // ── Emphasis (gear drops): a rarity-themed celebration so a real item drop
  // never reads like just another gold coin. ──
  emphasis?: boolean; // bigger pop + a hold beat before the icon flies away
  ringColor?: number; // rarity-coloured burst ring drawn at the drop spot
  label?: string; // item name, shown rising from the drop spot
  labelColor?: string; // CSS hex for that label (rarity colour)
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
    const emph = opts.emphasis === true;
    if (emph) this.emphasisIntro(from, opts);

    // 1) Eject: scatter to a small offset and pop. Gear pops bigger + higher and
    //    holds a beat (hold) before flying, so the player actually registers it.
    const ex = from.x + Phaser.Math.Between(-14, 14);
    const ey = from.y - (emph ? Phaser.Math.Between(20, 34) : Phaser.Math.Between(10, 24));
    const baseScale = obj.scale;
    const hold = emph ? 320 : 0;
    this.scene.tweens.add({
      targets: obj,
      x: ex,
      y: ey,
      scale: baseScale * (emph ? 1.55 : 1.15),
      duration: emph ? 240 : 160,
      delay,
      ease: emph ? "Back.easeOut" : "Quad.easeOut",
      onComplete: () => {
        if (hold)
          this.scene.time.delayedCall(hold, () =>
            this.flyToHero({ x: ex, y: ey }, to, obj, baseScale),
          );
        else this.flyToHero({ x: ex, y: ey }, to, obj, baseScale);
      },
    });
  }

  /** Gear-drop flourish: a rarity-coloured burst ring + a rising item name. */
  private emphasisIntro(from: Vec2, opts: LootFlyOpts): void {
    const color = opts.ringColor ?? opts.fallbackColor ?? 0xffe07a;
    const ring = this.fac
      .circle(from.x, from.y, 6)
      .setStrokeStyle(3, color, 0.95)
      .setDepth(this.depth + 1);
    ring.setFillStyle(color, 0.14);
    this.scene.tweens.add({
      targets: ring,
      scale: 7,
      alpha: 0,
      duration: 460,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    if (!opts.label) return;
    const name = makeCrisp(
      this.fac
        .text(from.x, from.y - 16, opts.label, {
          fontFamily: '"Trebuchet MS", system-ui, sans-serif',
          fontSize: "12px",
          color: opts.labelColor ?? "#ffe07a",
          fontStyle: "bold",
          stroke: "#0a0f18",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(this.depth + 6),
    );
    this.scene.tweens.add({
      targets: name,
      y: from.y - 52,
      alpha: 0,
      duration: 1200,
      delay: 220,
      ease: "Quad.easeOut",
      onComplete: () => name.destroy(),
    });
  }

  /** Drive a {t} proxy along the bezier, scaling down toward the hero. */
  private flyToHero(start: Vec2, to: Vec2, obj: FlyObject, baseScale: number): void {
    const ctrl = arcControl(start, to, 46);
    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: 760,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const p = bezierPoint(start, ctrl, to, proxy.t);
        obj.setPosition(p.x, p.y);
        obj.setScale(baseScale * (1 - 0.5 * proxy.t));
      },
      onComplete: () => {
        this.absorb(to);
        obj.destroy();
      },
    });
  }

  /** A quick white flash where the loot meets the hero. */
  private absorb(at: Vec2): void {
    const flash = this.fac.circle(at.x, at.y, 7, 0xffffff, 0.85).setDepth(this.depth + 3);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.9,
      alpha: 0,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private makeObject(from: Vec2, kind: "coin" | "icon", opts: LootFlyOpts): FlyObject {
    if (kind === "icon" && opts.iconKey && this.scene.textures.exists(opts.iconKey)) {
      const img = this.fac.image(from.x, from.y, opts.iconKey).setDepth(this.depth + 2);
      img.setScale(iconFitScale(img.width, img.height, opts.iconFit ?? 22));
      return img;
    }
    return this.fac
      .circle(from.x, from.y, 5, opts.fallbackColor ?? 0xffd34d)
      .setStrokeStyle(1, 0xa9722a)
      .setDepth(this.depth + 2);
  }
}
