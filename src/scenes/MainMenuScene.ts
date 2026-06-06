import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");

    const today = new Date().toISOString().slice(0, 10);
    const crystalsGranted = mgr.grantDailyLogin(today);

    const save = mgr.getSave();
    const W = this.scale.width;

    this.add
      .text(W / 2, 90, "WIBU TOWER DEFENSE", {
        fontSize: "38px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, 155, `💎 ${save.currency.crystals} Crystals`, {
        fontSize: "20px",
        color: "#90caf9",
      })
      .setOrigin(0.5);

    if (crystalsGranted > 0) {
      this.add
        .text(W / 2, 190, `+${crystalsGranted} daily login bonus!`, {
          fontSize: "14px",
          color: "#a5d6a7",
        })
        .setOrigin(0.5);
    }

    const buttons: { label: string; scene: string }[] = [
      { label: "▶  Play Battle", scene: "StageSelectScene" },
      { label: "✦  Summon Hall", scene: "GachaScene" },
      { label: "◈  Collection", scene: "CollectionScene" },
      { label: "🏪  Shop", scene: "ShopScene" },
      { label: "⬡  Passive Tree", scene: "PassiveGridScene" },
    ];

    buttons.forEach(({ label, scene }, i) => {
      const y = 270 + i * 80;
      const btn = this.add
        .text(W / 2, y, label, {
          fontSize: "22px",
          color: "#ffffff",
          backgroundColor: "#223355",
        })
        .setOrigin(0.5)
        .setPadding(24, 12, 24, 12)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setBackgroundColor("#335588"));
      btn.on("pointerout", () => btn.setBackgroundColor("#223355"));
      btn.on("pointerdown", () => this.scene.start(scene));
    });
  }
}
