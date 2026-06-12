import Phaser from "phaser";
import type { BoxReward } from "../core/boxes.ts";
import { tierOfBox } from "../core/boxes.ts";
import { BOX_RARITY_COLOR, boxRarityName } from "../data/materials.ts";
import { boxRewardEntries } from "../data/boxRewardView.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { boxTex, fxTex } from "../data/assetKeys.ts";

const ADD = Phaser.BlendModes.ADD;

/**
 * Anime-style box-opening sequence: the chest shakes with anticipation, bursts
 * in a rarity-coloured flash of light rays + sparkles, then reveals its rewards
 * as a staggered row of tiles. Built as a self-destructing depth-2000 overlay
 * whose dim backdrop swallows input; tap (after the reveal) closes it.
 *
 * The burst/glow/sparkle textures are bright-on-black and drawn with ADD blend,
 * so a single white texture tints to any rarity colour.
 */
export class BoxOpenOverlay {
  private root: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly onClose: () => void) {}

  isOpen(): boolean {
    return this.root !== null;
  }

  play(boxId: string, reward: BoxReward): void {
    this.close();
    const s = this.scene;
    const W = s.scale.width, H = s.scale.height;
    const cx = W / 2, cy = H / 2 - 30;
    const tier = tierOfBox(boxId);
    const color = BOX_RARITY_COLOR[tier] ?? 0xffd34d;

    const root = s.add.container(0, 0).setDepth(2000);
    this.root = root;
    const dim = s.add.rectangle(cx, H / 2, W, H, 0x05070c, 0.82).setInteractive();
    root.add(dim);

    const title = s.add.text(cx, cy - 150, `${boxRarityName(tier)} Boss Chest`, {
      fontSize: "20px", color: "#" + color.toString(16).padStart(6, "0"), fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0);
    root.add(title);

    // Glow halo behind the chest (subtle, growing).
    const glow = this.fx("glow", cx, cy, color, 0).setScale(0.6);
    root.add(glow);
    s.tweens.add({ targets: glow, alpha: 0.55, scale: 1.7, duration: 700, ease: "Quad.easeOut" });

    // The chest art (falls back to a gift glyph if unloaded).
    let chest: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    const key = boxTex(boxId);
    if (s.textures.exists(key)) {
      chest = s.add.image(cx, cy, key).setOrigin(0.5);
      chest.setScale(110 / chest.height);
    } else {
      chest = s.add.text(cx, cy, "🎁", { fontSize: "84px" }).setOrigin(0.5);
    }
    root.add(chest);
    s.tweens.add({ targets: title, alpha: 1, duration: 300 });

    // Anticipation shake, then the pop.
    s.tweens.add({ targets: chest, x: cx + 4, duration: 60, yoyo: true, repeat: 5, ease: "Sine.easeInOut" });
    s.tweens.add({ targets: chest, scale: { from: chest.scale, to: chest.scale * 1.12 }, duration: 620, ease: "Quad.easeIn" });

    s.time.delayedCall(640, () => this.pop(cx, cy, color, chest));
    s.time.delayedCall(1000, () => this.reveal(reward, cx, cy));

    // Tap to close — armed only after the reveal so the burst is never cut short.
    s.time.delayedCall(1050, () => dim.once("pointerdown", () => this.close()));
  }

  private pop(cx: number, cy: number, color: number, chest: Phaser.GameObjects.Image | Phaser.GameObjects.Text): void {
    const s = this.scene;
    if (!this.root) return;

    // White flash.
    const flash = s.add.rectangle(s.scale.width / 2, s.scale.height / 2, s.scale.width, s.scale.height, 0xffffff, 0.0);
    flash.setBlendMode(ADD);
    this.root.add(flash);
    s.tweens.add({ targets: flash, fillAlpha: 0.55, duration: 80, yoyo: true, ease: "Quad.easeOut", onComplete: () => flash.destroy() });

    // Two crossed light bursts that bloom and fade.
    for (const spin of [0, 35]) {
      const burst = this.fx("burst", cx, cy, color, 1).setScale(0.2).setAngle(spin);
      this.root.add(burst);
      s.tweens.add({ targets: burst, scale: 1.8, angle: spin + 55, alpha: 0, duration: 720, ease: "Cubic.easeOut", onComplete: () => burst.destroy() });
    }

    // Sparkle scatter.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sp = this.fx("sparkle", cx, cy, i % 2 ? 0xffffff : color, 1).setScale(0.12);
      this.root.add(sp);
      s.tweens.add({
        targets: sp, x: cx + Math.cos(a) * (70 + i * 6), y: cy + Math.sin(a) * (60 + i * 5),
        scale: 0.3, alpha: 0, duration: 600 + i * 20, ease: "Quad.easeOut", onComplete: () => sp.destroy(),
      });
    }

    // Chest pops then settles.
    const base = chest.scale / 1.12;
    s.tweens.add({ targets: chest, scale: base * 1.25, duration: 120, yoyo: true, ease: "Back.easeOut" });
  }

  private reveal(reward: BoxReward, cx: number, cy: number): void {
    const s = this.scene;
    if (!this.root) return;
    const entries = boxRewardEntries(reward);
    const tw = 86, gap = 10;
    const totalW = entries.length * tw + (entries.length - 1) * gap;
    const startX = cx - totalW / 2 + tw / 2;
    const ty = cy + 110;

    entries.forEach((e, i) => {
      const tile = s.add.container(startX + i * (tw + gap), ty).setAlpha(0).setScale(0.7);
      const col = Phaser.Display.Color.HexStringToColor(e.color).color;
      const g = s.add.graphics();
      g.fillStyle(0x121a28, 1).fillRoundedRect(-tw / 2, -36, tw, 72, 8);
      g.lineStyle(2, col, 1).strokeRoundedRect(-tw / 2, -36, tw, 72, 8);
      tile.add(g);

      // Same scale-to-fill rule as the bag/shop so a looted item looks identical
      // to how it reads everywhere else (was a tiny fixed 34px → looked "old").
      const fallback = e.kind === "gold" ? "🪙" : e.kind === "item" ? "📦" : "💠";
      tile.add(makeFitIcon(s, 0, -8, e.iconKey ?? "", 50, fallback));
      const label = e.kind === "gold" || e.kind === "diamond" ? `+${e.count}` : e.count > 1 ? `${e.name} ×${e.count}` : e.name;
      tile.add(s.add.text(0, 22, label, { fontSize: "9px", color: e.color, align: "center", wordWrap: { width: tw - 8 }, fontStyle: "bold" }).setOrigin(0.5, 0));
      this.root!.add(tile);
      s.tweens.add({ targets: tile, alpha: 1, scale: 1, duration: 280, delay: i * 110, ease: "Back.easeOut" });
    });

    const hint = s.add.text(cx, ty + 70, "tap to continue", { fontSize: "11px", color: "#8aa0bb" }).setOrigin(0.5).setAlpha(0);
    this.root.add(hint);
    s.tweens.add({ targets: hint, alpha: 1, duration: 400, delay: entries.length * 110 + 200 });
  }

  /** A bright-on-black VFX texture set up for additive, rarity-tinted rendering. */
  private fx(id: "burst" | "glow" | "sparkle", x: number, y: number, color: number, alpha: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, fxTex(id)).setBlendMode(ADD).setAlpha(alpha);
    img.setTint(color);
    return img;
  }

  close(): void {
    this.root?.destroy(true);
    this.root = null;
    this.onClose();
  }
}
