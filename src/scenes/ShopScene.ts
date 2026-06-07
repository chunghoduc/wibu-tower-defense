import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { SHOP_CATALOG } from "../core/shop.ts";
import { TOWERS } from "../data/towers.ts";

const RARITY_HEX: Record<string, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

export class ShopScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private crystalText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private itemRows: { btn: Phaser.GameObjects.Text; entryId: string }[] = [];

  constructor() {
    super("ShopScene");
  }

  create(): void {
    // Clear refs from a previous visit (Phaser reuses the scene instance) so
    // refreshUI() never touches destroyed Texts from the last time.
    this.itemRows = [];
    this.mgr = this.registry.get("saveManager");
    const W = this.scale.width;

    this.add
      .text(W / 2, 22, "🏪 Shop", {
        fontSize: "28px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(20, 8, "← Back", { fontSize: "16px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

    this.crystalText = this.add
      .text(W / 2, 60, "", { fontSize: "18px", color: "#90caf9" })
      .setOrigin(0.5);

    this.feedbackText = this.add
      .text(W / 2, 88, "", { fontSize: "13px", color: "#a5d6a7" })
      .setOrigin(0.5);

    this.buildItemList();
    this.refreshUI();
  }

  private buildItemList(): void {
    const save = this.mgr.getSave();
    const W = this.scale.width;
    const START_Y = 120;
    const ROW_H = 78;

    SHOP_CATALOG.forEach((entry, i) => {
      const y = START_Y + i * ROW_H;

      // Card background
      const bg = this.add.graphics();
      bg.fillStyle(0x1a2a3a, 1).fillRoundedRect(60, y, W - 120, 68, 8);
      bg.lineStyle(1.5, 0x3a5a7a, 1).strokeRoundedRect(60, y, W - 120, 68, 8);

      // Entry details
      if (entry.rewardType === "character") {
        const def = TOWERS.find((t) => t.id === entry.rewardRef);
        const rarity = def?.rarity ?? "Magic";
        const hexColor = RARITY_HEX[rarity] ?? "#2196f3";

        this.add.text(80, y + 10, entry.name, {
          fontSize: "16px",
          color: hexColor,
          fontStyle: "bold",
        });

        this.add.text(80, y + 34, `${rarity} · ${def?.role ?? ""}  ·  ${def?.description?.slice(0, 60) ?? ""}…`, {
          fontSize: "10px",
          color: "#aaaaaa",
          wordWrap: { width: W - 240 },
        });

        const isOwned = entry.rewardRef in save.collection;
        if (isOwned) {
          this.add
            .text(W - 130, y + 34, "OWNED ✓", {
              fontSize: "12px",
              color: "#a5d6a7",
              fontStyle: "bold",
            })
            .setOrigin(1, 0.5);
        }
      } else {
        this.add.text(80, y + 10, entry.name, {
          fontSize: "14px",
          color: "#ffd700",
          fontStyle: "bold",
        });
        this.add.text(80, y + 34, "Guarantees your next summon draws from the Legendary/Unique pool.", {
          fontSize: "10px",
          color: "#aaaaaa",
          wordWrap: { width: W - 240 },
        });
      }

      // Buy button
      const btn = this.add
        .text(W - 88, y + 34, `${entry.cost} 💎`, {
          fontSize: "15px",
          color: "#ffffff",
          backgroundColor: "#1a4a7a",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0.5)
        .setPadding(12, 6, 12, 6)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setBackgroundColor("#1e88e5"));
      btn.on("pointerout", () => btn.setBackgroundColor("#1a4a7a"));
      btn.on("pointerdown", () => this.buyItem(entry.id));

      this.itemRows.push({ btn, entryId: entry.id });
    });
  }

  private buyItem(entryId: string): void {
    const result = this.mgr.afterShopPurchase(entryId);
    this.feedbackText.setText(result.message).setColor(result.success ? "#a5d6a7" : "#ef9a9a");
    this.refreshUI();

    // Clear feedback after 2.5 s
    this.time.delayedCall(2500, () => {
      if (this.feedbackText.active) this.feedbackText.setText("");
    });
  }

  private refreshUI(): void {
    const save = this.mgr.getSave();
    this.crystalText.setText(`💎 ${save.currency.crystals} Crystals`);

    this.itemRows.forEach(({ btn, entryId }) => {
      const entry = SHOP_CATALOG.find((e) => e.id === entryId);
      if (!entry) return;
      const canAfford = save.currency.crystals >= entry.cost;
      btn.setAlpha(canAfford ? 1 : 0.4);
    });
  }
}
