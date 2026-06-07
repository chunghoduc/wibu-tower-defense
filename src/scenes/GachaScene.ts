import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { HARD_PITY, MULTI_PULL_COST, SINGLE_PULL_COST, type SummonResult } from "../core/gacha.ts";
import { Rng } from "../core/rng.ts";
import { TOWERS } from "../data/towers.ts";
import { frameKey } from "../data/uiManifest.ts";

const RARITY_HEX: Record<string, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

export class GachaScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private crystalText!: Phaser.GameObjects.Text;
  private pityText!: Phaser.GameObjects.Text;
  private pull1Btn!: Phaser.GameObjects.Text;
  private pull10Btn!: Phaser.GameObjects.Text;
  private resultContainer!: Phaser.GameObjects.Container;

  constructor() {
    super("GachaScene");
  }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    const W = this.scale.width;

    // Design-team summon backdrop (magical portal), dimmed for legibility.
    if (this.textures.exists("bg__gacha")) {
      this.add.image(W / 2, this.scale.height / 2, "bg__gacha").setDisplaySize(W, this.scale.height).setDepth(-10).setAlpha(0.5);
    }

    this.add
      .text(W / 2, 28, "✦ Summon Hall", {
        fontSize: "28px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(20, 8, "← Back", { fontSize: "16px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => fadeToScene(this, "MainMenuScene"));

    this.crystalText = this.add
      .text(W / 2, 72, "", { fontSize: "18px", color: "#90caf9" })
      .setOrigin(0.5);

    this.pityText = this.add
      .text(W / 2, 100, "", { fontSize: "14px", color: "#aaaaaa" })
      .setOrigin(0.5);

    this.pull1Btn = this.add
      .text(W / 2 - 140, 144, `1× Pull  (${SINGLE_PULL_COST} 💎)`, {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#1a4a7a",
      })
      .setOrigin(0.5)
      .setPadding(14, 8, 14, 8)
      .setInteractive({ useHandCursor: true });

    this.pull10Btn = this.add
      .text(W / 2 + 140, 144, `10× Pull  (${MULTI_PULL_COST} 💎)`, {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#1a4a7a",
      })
      .setOrigin(0.5)
      .setPadding(14, 8, 14, 8)
      .setInteractive({ useHandCursor: true });

    this.pull1Btn.on("pointerdown", () => this.doPull(1));
    this.pull10Btn.on("pointerdown", () => this.doPull(10));

    this.resultContainer = this.add.container(0, 0);

    this.refreshUI();
  }

  private refreshUI(): void {
    const s = this.mgr.getSave();
    this.crystalText.setText(`💎 ${s.currency.crystals} Crystals`);
    this.pityText.setText(
      `Pity: ${s.currency.pityCount} / ${HARD_PITY}` +
        (s.currency.pityInsuranceActive ? "  ⚡ Insurance active" : ""),
    );
    this.pull1Btn.setAlpha(s.currency.crystals >= SINGLE_PULL_COST ? 1 : 0.4);
    this.pull10Btn.setAlpha(s.currency.crystals >= MULTI_PULL_COST ? 1 : 0.4);
  }

  private doPull(count: 1 | 10): void {
    const s = this.mgr.getSave();
    const needed = count === 1 ? SINGLE_PULL_COST : MULTI_PULL_COST;
    if (s.currency.crystals < needed) return;

    const results = this.mgr.afterSummon(count, new Rng(Date.now()));
    this.showResults(results);
    this.refreshUI();
  }

  private showResults(results: SummonResult[]): void {
    this.resultContainer.removeAll(true);

    const W = this.scale.width;
    const CARD_W = 84;
    const CARD_H = 96;
    const COLS = Math.min(results.length, 5);
    const GAP_X = 96;
    const ROW_H = CARD_H + 18;
    const START_Y = 190;

    results.forEach((r, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = W / 2 - ((COLS - 1) * GAP_X) / 2 + col * GAP_X;
      const y = START_Y + row * ROW_H;

      const def = TOWERS.find((t) => t.id === r.characterId);
      const hexStr = RARITY_HEX[r.rarity] ?? "#888888";
      const colorInt = parseInt(hexStr.replace("#", ""), 16);

      // A framed character card: dark inset, avatar, design-team rarity frame.
      const card = this.add.container(x, y + CARD_H / 2);
      const half = { w: CARD_W / 2, h: CARD_H / 2 };
      const inner = this.add.graphics();
      inner.fillStyle(0x0b0f17, 0.9).fillRoundedRect(-half.w + 5, -half.h + 5, CARD_W - 10, CARD_H - 10, 6);
      card.add(inner);

      const avKey = `tower__${r.characterId}`;
      if (this.textures.exists(avKey)) {
        const img = this.add.image(0, -8, avKey, 0).setOrigin(0.5);
        img.setScale(Math.min((CARD_W - 20) / img.width, (CARD_H - 44) / img.height));
        card.add(img);
      }

      const fKey = frameKey(r.rarity);
      if (this.textures.exists(fKey)) {
        card.add(this.add.image(0, 0, fKey).setDisplaySize(CARD_W, CARD_H));
      } else {
        const g = this.add.graphics();
        g.lineStyle(2, colorInt, 1).strokeRoundedRect(-half.w, -half.h, CARD_W, CARD_H, 8);
        card.add(g);
      }

      card.add(this.add.text(0, -half.h + 6, def?.name ?? r.characterId, { fontSize: "8px", color: hexStr, wordWrap: { width: CARD_W - 14 }, align: "center" }).setOrigin(0.5, 0));
      card.add(this.add.text(0, half.h - 28, r.rarity, { fontSize: "10px", color: hexStr, fontStyle: "bold" }).setOrigin(0.5, 0));
      card.add(this.add.text(0, half.h - 15, "★".repeat(r.newStars), { fontSize: "11px", color: "#ffd700" }).setOrigin(0.5, 0));
      if (r.isNew) {
        card.add(this.add.text(half.w - 4, -half.h + 4, "NEW!", { fontSize: "9px", color: "#ffffff", backgroundColor: "#c0392b" }).setOrigin(1, 0).setPadding(3, 1, 3, 1));
      }

      // Staggered scale-in reveal — the marquee reward moment.
      card.setScale(0.55).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, delay: i * 70, duration: 260, ease: "Back.easeOut" });
      this.resultContainer.add(card);
    });
  }
}
