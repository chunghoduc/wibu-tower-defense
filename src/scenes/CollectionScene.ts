import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";

const RARITY_INT: Record<string, number> = {
  Common: 0x9e9e9e,
  Magic: 0x2196f3,
  Rare: 0x9c27b0,
  Legendary: 0xff9800,
  Unique: 0xf44336,
};

const RARITY_HEX: Record<string, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

const COLS = 8;
const CARD_W = 100;
const CARD_H = 72;
const GAP_X = 114;
const GAP_Y = 88;

export class CollectionScene extends Phaser.Scene {
  constructor() {
    super("CollectionScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");
    const save = mgr.getSave();
    const W = this.scale.width;

    this.add
      .text(W / 2, 18, "◈ Collection", {
        fontSize: "26px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const ownedCount = Object.keys(save.collection).length;
    this.add
      .text(W / 2, 52, `${ownedCount} / ${TOWERS.length} collected`, {
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    this.add
      .text(20, 6, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

    const START_X = (W - (COLS - 1) * GAP_X - CARD_W) / 2 + CARD_W / 2;
    const START_Y = 78;

    const g = this.add.graphics();

    TOWERS.forEach((tower, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = START_X + col * GAP_X;
      const y = START_Y + row * GAP_Y;
      const isOwned = tower.id in save.collection;
      const stars = getTowerStars(save, tower.id);
      const colorInt = isOwned ? (RARITY_INT[tower.rarity] ?? 0x888888) : 0x333333;
      const hexColor = isOwned ? (RARITY_HEX[tower.rarity] ?? "#888888") : "#555555";
      const alpha = isOwned ? 1.0 : 0.4;

      g.fillStyle(colorInt, 0.12 * (isOwned ? 1 : 0.5));
      g.fillRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 6);
      g.lineStyle(1.5, colorInt, alpha);
      g.strokeRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 6);

      this.add
        .text(x, y + 7, tower.name, {
          fontSize: "8px",
          color: hexColor,
          wordWrap: { width: CARD_W - 8 },
          align: "center",
        })
        .setOrigin(0.5, 0);

      this.add
        .text(x, y + 38, tower.rarity, {
          fontSize: "9px",
          color: isOwned ? "#cccccc" : "#555555",
        })
        .setOrigin(0.5, 0);

      if (isOwned && stars > 0) {
        this.add
          .text(x, y + 54, "★".repeat(stars), {
            fontSize: "11px",
            color: "#ffd700",
          })
          .setOrigin(0.5, 0);
      }
    });
  }
}
