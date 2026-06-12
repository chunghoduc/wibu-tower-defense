/**
 * QuestScene — the daily-quest board. Shows every daily quest with its progress
 * bar, reward and a Claim button that becomes active once the quest is complete.
 * Rewards must be collected here (claiming credits gold/diamonds/scrolls into the
 * save). A full-width banner at the bottom grants the all-complete diamond bonus.
 * Quests reset at midnight (handled by SaveManager.refreshQuests on entry).
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { DAILY_QUESTS, questRewardLabel, type QuestDef } from "../data/quests.ts";
import {
  getQuestProgress,
  isQuestClaimable,
  claimableQuestCount,
  ALL_BONUS_DIAMONDS,
} from "../core/questTracker.ts";

const COLS = 2,
  CW = 452,
  CH = 96,
  X0 = 20,
  Y0 = 60,
  GAP_X = 16,
  GAP_Y = 10;

export class QuestScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;

  constructor() {
    super("QuestScene");
  }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    const today = new Date().toISOString().slice(0, 10);
    this.mgr.refreshQuests(today); // midnight rollover before drawing

    const W = this.scale.width;
    crispText(this, W / 2, 10, "📜 Daily Quests", {
      fontSize: "24px",
      color: "#ffd700",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "MainMenuScene"));

    this.layer = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 516, "", {
      fontSize: "13px",
      color: "#ffe1a8",
      backgroundColor: "#2a1f14",
    })
      .setOrigin(0.5)
      .setPadding(10, 5, 10, 5)
      .setDepth(60)
      .setVisible(false);
    this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    const save = this.mgr.getSave();
    const W = this.scale.width;

    // Header line: how many rewards are waiting + reset note.
    const claimable = claimableQuestCount(save);
    const claimed = DAILY_QUESTS.filter((q) => save.quests.claimed.includes(q.id)).length;
    this.layer.add(
      crispText(
        this,
        W / 2,
        40,
        `${claimed}/${DAILY_QUESTS.length} claimed` +
          (claimable > 0
            ? `  ·  ${claimable} reward${claimable > 1 ? "s" : ""} ready!`
            : "  ·  resets at midnight"),
        { fontSize: "12px", color: claimable > 0 ? "#ffd56a" : "#90a4bb" },
      ).setOrigin(0.5, 0),
    );

    DAILY_QUESTS.forEach((def, i) => {
      const x = X0 + (i % COLS) * (CW + GAP_X);
      const y = Y0 + Math.floor(i / COLS) * (CH + GAP_Y);
      this.drawCard(def, x, y, save);
    });

    this.drawBonusBanner(save);
  }

  private drawCard(
    def: QuestDef,
    x: number,
    y: number,
    save: ReturnType<SaveManager["getSave"]>,
  ): void {
    const progress = getQuestProgress(save, def.id);
    const done = progress >= def.target;
    const claimed = save.quests.claimed.includes(def.id);
    const claimable = isQuestClaimable(save, def.id);

    const g = this.add.graphics();
    g.fillStyle(claimed ? 0x16221a : done ? 0x1f2a18 : 0x161d28, 1).fillRoundedRect(
      x,
      y,
      CW,
      CH,
      10,
    );
    g.lineStyle(2, claimable ? 0xffc94d : claimed ? 0x3a6b4a : 0x2c3a4f, 1).strokeRoundedRect(
      x,
      y,
      CW,
      CH,
      10,
    );
    this.layer.add(g);

    // Title + reward.
    this.layer.add(
      crispText(this, x + 14, y + 10, def.label, {
        fontSize: "16px",
        color: claimed ? "#8fc7a0" : "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(this, x + CW - 14, y + 12, questRewardLabel(def.reward), {
        fontSize: "12px",
        color: "#ffe07a",
      }).setOrigin(1, 0),
    );
    this.layer.add(
      crispText(this, x + 14, y + 32, def.description, {
        fontSize: "11px",
        color: "#aab8cc",
        wordWrap: { width: CW - 130 },
      }),
    );

    // Progress bar.
    const bx = x + 14,
      by = y + CH - 22,
      bw = CW - 150,
      frac = Phaser.Math.Clamp(progress / def.target, 0, 1);
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.5).fillRoundedRect(bx, by, bw, 12, 4);
    bar
      .fillStyle(done ? 0x53c46a : 0x4a8cff, 1)
      .fillRoundedRect(bx, by, Math.max(2, bw * frac), 12, 4);
    this.layer.add(bar);
    this.layer.add(
      crispText(this, bx + bw + 6, by - 1, `${Math.min(progress, def.target)}/${def.target}`, {
        fontSize: "11px",
        color: "#cdd6e6",
      }),
    );

    // Claim button / status badge (bottom-right).
    const cbx = x + CW - 14,
      cby = y + CH - 24;
    if (claimed) {
      this.layer.add(
        crispText(this, cbx, cby, "✓ Claimed", {
          fontSize: "12px",
          color: "#9fe0b0",
          fontStyle: "bold",
        }).setOrigin(1, 0),
      );
    } else if (claimable) {
      const btn = crispText(this, cbx, cby, "Claim", {
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#1f8f43",
        fontStyle: "bold",
      })
        .setOrigin(1, 0)
        .setPadding(12, 5, 12, 5)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setBackgroundColor("#27a851"));
      btn.on("pointerout", () => btn.setBackgroundColor("#1f8f43"));
      btn.on("pointerup", () => this.claim(def));
      this.layer.add(btn);
      this.tweens.add({
        targets: btn,
        scale: 1.06,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.layer.add(
        crispText(this, cbx, cby, "In progress", { fontSize: "12px", color: "#6b7a8d" }).setOrigin(
          1,
          0,
        ),
      );
    }
  }

  private drawBonusBanner(save: ReturnType<SaveManager["getSave"]>): void {
    const allClaimed = DAILY_QUESTS.every((q) => save.quests.claimed.includes(q.id));
    const collected = save.quests.allClaimed;
    const ready = allClaimed && !collected;
    const rows = Math.ceil(DAILY_QUESTS.length / COLS); // banner sits below ALL quest rows
    const x = X0,
      y = Y0 + rows * (CH + GAP_Y),
      w = CW * 2 + GAP_X,
      h = 50;

    const g = this.add.graphics();
    g.fillStyle(ready ? 0x2a2410 : 0x14181f, 1).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, ready ? 0xffd24d : collected ? 0x3a6b4a : 0x33405a, 1).strokeRoundedRect(
      x,
      y,
      w,
      h,
      10,
    );
    this.layer.add(g);

    this.layer.add(
      crispText(this, x + 16, y + 8, "🏆 Complete all daily quests", {
        fontSize: "15px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(this, x + 16, y + 29, `Reward: +${ALL_BONUS_DIAMONDS} 💎`, {
        fontSize: "12px",
        color: "#ffe07a",
      }),
    );

    const cbx = x + w - 16,
      cby = y + h / 2;
    if (collected) {
      this.layer.add(
        crispText(this, cbx, cby, "✓ Collected", {
          fontSize: "13px",
          color: "#9fe0b0",
          fontStyle: "bold",
        }).setOrigin(1, 0.5),
      );
    } else if (ready) {
      const btn = crispText(this, cbx, cby, "Claim Bonus", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#9a6a1f",
        fontStyle: "bold",
      })
        .setOrigin(1, 0.5)
        .setPadding(14, 6, 14, 6)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setBackgroundColor("#bd8528"));
      btn.on("pointerout", () => btn.setBackgroundColor("#9a6a1f"));
      btn.on("pointerup", () => this.claimBonus());
      this.layer.add(btn);
      this.tweens.add({
        targets: btn,
        scale: 1.05,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.layer.add(
        crispText(this, cbx, cby, "Claim every quest first", {
          fontSize: "12px",
          color: "#6b7a8d",
        }).setOrigin(1, 0.5),
      );
    }
  }

  private claim(def: QuestDef): void {
    if (this.mgr.claimQuest(def.id)) {
      this.showToast(`Claimed: ${questRewardLabel(def.reward)}`);
      this.redraw();
    }
  }

  private claimBonus(): void {
    if (this.mgr.claimQuestBonus()) {
      this.showToast(`All quests complete!  +${ALL_BONUS_DIAMONDS} 💎`);
      this.redraw();
    }
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1600, () => this.toast.setVisible(false));
  }
}
