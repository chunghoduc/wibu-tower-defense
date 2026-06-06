import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { STAGES } from "../data/stage.ts";
import type { Difficulty, StageDef } from "../data/schema.ts";

const DIFFICULTIES: Difficulty[] = ["Normal", "Hard", "Nightmare"];

const DIFF_COLOR: Record<Difficulty, string> = {
  Normal: "#a5d6a7",
  Hard: "#ffb74d",
  Nightmare: "#ef9a9a",
};

const COLS = 5;
const CARD_W = 160;
const CARD_H = 100;
const GAP_X = 178;
const GAP_Y = 118;

export class StageSelectScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = "Normal";
  private diffBtns: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("StageSelectScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");
    const save = mgr.getSave();
    const W = this.scale.width;
    const H = this.scale.height;

    this.add
      .text(W / 2, 22, "Select Stage", {
        fontSize: "26px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

    // Difficulty tabs
    const tabY = 56;
    DIFFICULTIES.forEach((diff, i) => {
      const x = W / 2 - 140 + i * 140;
      const btn = this.add
        .text(x, tabY, diff, {
          fontSize: "15px",
          color: DIFF_COLOR[diff],
          backgroundColor: "#1a2a3a",
        })
        .setOrigin(0.5)
        .setPadding(14, 6, 14, 6)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.selectedDifficulty = diff;
        this.refreshDiffTabs();
      });
      this.diffBtns.push(btn);
    });
    this.refreshDiffTabs();

    // Stage cards
    const clearMap = save.progress.stageClearMap;
    const START_X = (W - (COLS - 1) * GAP_X - CARD_W) / 2 + CARD_W / 2;
    const START_Y = 90;
    const g = this.add.graphics();

    STAGES.forEach((stage, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = START_X + col * GAP_X;
      const y = START_Y + row * GAP_Y;

      const clearRecord = clearMap[stage.id];
      const anyCleared = clearRecord && (clearRecord.Normal || clearRecord.Hard || clearRecord.Nightmare);
      const isLocked = i > 0 && !clearMap[STAGES[i - 1].id]?.Normal;

      const bg = isLocked ? 0x222222 : anyCleared ? 0x1a3a2a : 0x1a2a3a;
      g.fillStyle(bg, 1).fillRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 8);
      g.lineStyle(2, isLocked ? 0x333333 : 0x4a6a8a, 1).strokeRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 8);

      // Stage number + name
      const nameColor = isLocked ? "#555555" : "#dddddd";
      this.add
        .text(x, y + 10, `Stage ${i + 1}`, {
          fontSize: "11px",
          color: isLocked ? "#444444" : "#90caf9",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0);

      this.add
        .text(x, y + 26, stage.name, {
          fontSize: "9px",
          color: nameColor,
          wordWrap: { width: CARD_W - 12 },
          align: "center",
        })
        .setOrigin(0.5, 0);

      // Clear badges
      if (clearRecord) {
        const badges: string[] = [];
        if (clearRecord.Normal) badges.push("N");
        if (clearRecord.Hard) badges.push("H");
        if (clearRecord.Nightmare) badges.push("NM");
        if (badges.length > 0) {
          this.add
            .text(x, y + 54, badges.join(" · "), {
              fontSize: "9px",
              color: "#ffd700",
            })
            .setOrigin(0.5, 0);
        }
      }

      if (isLocked) {
        this.add
          .text(x, y + CARD_H / 2, "🔒", { fontSize: "20px" })
          .setOrigin(0.5, 0.5);
        return;
      }

      // Play button area
      const playBtn = this.add
        .text(x, y + CARD_H - 10, "▶ Play", {
          fontSize: "12px",
          color: "#ffffff",
          backgroundColor: "#1565c0",
        })
        .setOrigin(0.5, 1)
        .setPadding(10, 4, 10, 4)
        .setInteractive({ useHandCursor: true });

      playBtn.on("pointerover", () => playBtn.setBackgroundColor("#1e88e5"));
      playBtn.on("pointerout", () => playBtn.setBackgroundColor("#1565c0"));
      playBtn.on("pointerdown", () => this.launchStage(stage));
    });

    // Legend at bottom
    this.add
      .text(W / 2, H - 14, "Clear Normal to unlock the next stage  ·  N/H/NM = clear badges", {
        fontSize: "10px",
        color: "#555555",
      })
      .setOrigin(0.5, 1);
  }

  private refreshDiffTabs(): void {
    DIFFICULTIES.forEach((diff, i) => {
      const btn = this.diffBtns[i];
      const active = diff === this.selectedDifficulty;
      btn.setBackgroundColor(active ? "#2a4a6a" : "#1a2a3a");
      btn.setAlpha(active ? 1 : 0.6);
    });
  }

  private launchStage(stage: StageDef): void {
    this.registry.set("selectedStage", stage);
    this.registry.set("selectedDifficulty", this.selectedDifficulty);
    this.scene.start("BattleScene");
  }
}
