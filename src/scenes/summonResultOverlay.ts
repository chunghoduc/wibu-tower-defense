import Phaser from "phaser";
import type { SummonResult } from "../core/gacha.ts";
import { TOWERS } from "../data/towers.ts";
import { frameKey } from "../data/uiManifest.ts";
import { button } from "./uiKit.ts";
import { towerTex, fxTex } from "../data/assetKeys.ts";

const ADD = Phaser.BlendModes.ADD;

const RARITY_HEX: Record<string, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};
const RARITY_INT: Record<string, number> = {
  Common: 0x9e9e9e,
  Magic: 0x2196f3,
  Rare: 0x9c27b0,
  Legendary: 0xff9800,
  Unique: 0xf44336,
};
/** Low→high so we can pick the marquee (best) rarity in a pull for the tint. */
const RARITY_ORDER = ["Common", "Magic", "Rare", "Legendary", "Unique"];

/**
 * Summon result reveal — a self-destructing depth-2000 modal. A dim backdrop
 * swallows input (so the pull buttons can't be tapped behind it), a living
 * rarity-coloured glow + slow light rays form the backdrop "stage", the pulled
 * characters pop in as a staggered row of framed cards, and a Claim button fades
 * in after the reveal to dismiss it. The glow/burst/sparkle textures are
 * bright-on-black, drawn with ADD blend, so one white texture tints to any colour.
 */
export class SummonResultOverlay {
  private root: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly onClose: () => void) {}

  isOpen(): boolean {
    return this.root !== null;
  }

  show(results: SummonResult[]): void {
    this.close();
    const s = this.scene;
    const W = s.scale.width, H = s.scale.height;
    const cx = W / 2;
    const cardsCy = 248; // vertical centre of the card cluster (backdrop focus)

    // Highest rarity in the pull drives the backdrop colour — the marquee moment.
    const best = results.reduce(
      (a, r) => (RARITY_ORDER.indexOf(r.rarity) > RARITY_ORDER.indexOf(a) ? r.rarity : a),
      "Common",
    );
    const color = RARITY_INT[best] ?? 0xffd34d;

    const root = s.add.container(0, 0).setDepth(2000);
    this.root = root;

    // Dim that captures input so nothing behind the modal is clickable.
    root.add(s.add.rectangle(cx, H / 2, W, H, 0x05070c, 0.85).setInteractive());

    this.buildBackdrop(cx, cardsCy, color);

    const title = s.add.text(cx, 92, "✦ Summon Results", {
      fontSize: "22px", color: "#" + color.toString(16).padStart(6, "0"), fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0);
    root.add(title);
    s.tweens.add({ targets: title, alpha: 1, y: 88, duration: 320, ease: "Quad.easeOut" });

    const lastDelay = this.revealCards(results, cx);
    this.openBurst(cx, cardsCy, color);

    // Claim button — the sole dismiss action, armed once the reveal settles.
    const claim = button(s, cx, H - 44, "Claim  ✦", () => this.dismiss(), {
      width: 220, bg: "#3a2e12", color: "#ffe9a8",
    }).setAlpha(0).setDepth(1);
    root.add(claim);
    s.tweens.add({ targets: claim, alpha: 1, duration: 260, delay: lastDelay + 180, ease: "Quad.easeOut" });
  }

  /** Living rarity-tinted backdrop: a pulsing glow halo behind slow light rays. */
  private buildBackdrop(cx: number, cy: number, color: number): void {
    const s = this.scene;
    if (!this.root) return;

    const rays = this.fx("burst", cx, cy, color, 0).setScale(2.4);
    this.root.add(rays);
    s.tweens.add({ targets: rays, alpha: 0.22, duration: 600, ease: "Quad.easeOut" });
    s.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1, ease: "Linear" });

    const glow = this.fx("glow", cx, cy, color, 0).setScale(2.2);
    this.root.add(glow);
    s.tweens.add({ targets: glow, alpha: 0.5, duration: 600, ease: "Quad.easeOut" });
    s.tweens.add({
      targets: glow, scale: 2.6, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }

  /** One-shot opening flourish: a flash, crossed bursts and a sparkle scatter. */
  private openBurst(cx: number, cy: number, color: number): void {
    const s = this.scene;
    if (!this.root) return;

    const flash = s.add.rectangle(s.scale.width / 2, s.scale.height / 2, s.scale.width, s.scale.height, 0xffffff, 0)
      .setBlendMode(ADD);
    this.root.add(flash);
    s.tweens.add({ targets: flash, fillAlpha: 0.4, duration: 90, yoyo: true, ease: "Quad.easeOut", onComplete: () => flash.destroy() });

    for (const spin of [0, 40]) {
      const burst = this.fx("burst", cx, cy, color, 0.9).setScale(0.3).setAngle(spin);
      this.root.add(burst);
      s.tweens.add({ targets: burst, scale: 2, angle: spin + 50, alpha: 0, duration: 780, ease: "Cubic.easeOut", onComplete: () => burst.destroy() });
    }

    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = this.fx("sparkle", cx, cy, i % 2 ? 0xffffff : color, 1).setScale(0.14);
      this.root.add(sp);
      s.tweens.add({
        targets: sp, x: cx + Math.cos(a) * (110 + i * 6), y: cy + Math.sin(a) * (80 + i * 5),
        scale: 0.3, alpha: 0, duration: 640 + i * 18, ease: "Quad.easeOut", onComplete: () => sp.destroy(),
      });
    }
  }

  /** Staggered framed card reveal. Returns the delay of the last card's tween. */
  private revealCards(results: SummonResult[], cx: number): number {
    const s = this.scene;
    const CARD_W = 84, CARD_H = 96;
    const COLS = Math.min(results.length, 5);
    const GAP_X = 96, ROW_H = CARD_H + 18, START_Y = 200;
    let lastDelay = 0;

    results.forEach((r, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = cx - ((COLS - 1) * GAP_X) / 2 + col * GAP_X;
      const y = START_Y + row * ROW_H;

      const def = TOWERS.find((t) => t.id === r.characterId);
      const hexStr = RARITY_HEX[r.rarity] ?? "#888888";
      const colorInt = parseInt(hexStr.replace("#", ""), 16);

      const card = s.add.container(x, y + CARD_H / 2);
      const half = { w: CARD_W / 2, h: CARD_H / 2 };
      const inner = s.add.graphics();
      inner.fillStyle(0x0b0f17, 0.9).fillRoundedRect(-half.w + 5, -half.h + 5, CARD_W - 10, CARD_H - 10, 6);
      card.add(inner);

      const avKey = towerTex(r.characterId);
      if (s.textures.exists(avKey)) {
        const img = s.add.image(0, -8, avKey, 0).setOrigin(0.5);
        img.setScale(Math.min((CARD_W - 20) / img.width, (CARD_H - 44) / img.height));
        card.add(img);
      }

      const fKey = frameKey(r.rarity);
      if (s.textures.exists(fKey)) {
        card.add(s.add.image(0, 0, fKey).setDisplaySize(CARD_W, CARD_H));
      } else {
        const g = s.add.graphics();
        g.lineStyle(2, colorInt, 1).strokeRoundedRect(-half.w, -half.h, CARD_W, CARD_H, 8);
        card.add(g);
      }

      card.add(s.add.text(0, -half.h + 6, def?.name ?? r.characterId, { fontSize: "8px", color: hexStr, wordWrap: { width: CARD_W - 14 }, align: "center" }).setOrigin(0.5, 0));
      card.add(s.add.text(0, half.h - 28, r.rarity, { fontSize: "10px", color: hexStr, fontStyle: "bold" }).setOrigin(0.5, 0));
      card.add(s.add.text(0, half.h - 15, "★".repeat(r.newStars), { fontSize: "11px", color: "#ffd700" }).setOrigin(0.5, 0));
      if (r.isNew) {
        card.add(s.add.text(half.w - 4, -half.h + 4, "NEW!", { fontSize: "9px", color: "#ffffff", backgroundColor: "#c0392b" }).setOrigin(1, 0).setPadding(3, 1, 3, 1));
      }

      card.setScale(0.55).setAlpha(0);
      lastDelay = i * 70;
      s.tweens.add({ targets: card, scale: 1, alpha: 1, delay: lastDelay, duration: 260, ease: "Back.easeOut" });
      this.root!.add(card);
    });
    return lastDelay + 260;
  }

  /** A bright-on-black VFX texture set up for additive, rarity-tinted rendering. */
  private fx(id: "burst" | "glow" | "sparkle", x: number, y: number, color: number, alpha: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, fxTex(id)).setBlendMode(ADD).setAlpha(alpha);
    img.setTint(color);
    return img;
  }

  /** Claim: fade the whole modal out, then tear it down. */
  private dismiss(): void {
    const s = this.scene;
    if (!this.root) return;
    const root = this.root;
    this.root = null;
    s.tweens.add({ targets: root, alpha: 0, duration: 200, ease: "Quad.easeIn", onComplete: () => root.destroy(true) });
    this.onClose();
  }

  close(): void {
    this.root?.destroy(true);
    this.root = null;
  }
}
