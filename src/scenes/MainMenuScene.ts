import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { music } from "./audio.ts";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");

    // Start the ambient music bed on the first user gesture (Web Audio needs one).
    const s0 = mgr.getSettings();
    if (s0.musicEnabled && !s0.muted) {
      this.input.once("pointerdown", () => music.start());
    }

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
      { label: "⚔  Hero Loadout", scene: "HeroScene" },
      { label: "👥  Squad & Skill", scene: "SquadScene" },
      { label: "⚙  Settings", scene: "SettingsScene" },
    ];

    // 2-column grid: 3 rows × 2 cols
    const COL_X = [W / 2 - 165, W / 2 + 165];
    const ROW_Y = 270;
    const ROW_H = 78;
    buttons.forEach(({ label, scene }, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = COL_X[col];
      const y = ROW_Y + row * ROW_H;
      const btn = this.add
        .text(x, y, label, {
          fontSize: "20px",
          color: "#ffffff",
          backgroundColor: "#223355",
          fixedWidth: 280,
          align: "center",
        })
        .setOrigin(0.5)
        .setPadding(0, 12, 0, 12)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setBackgroundColor("#335588"));
      btn.on("pointerout", () => btn.setBackgroundColor("#223355"));
      btn.on("pointerdown", () => this.scene.start(scene));
    });
  }
}
