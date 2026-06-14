/**
 * AchievementScene — the dedicated achievements board. Shows every achievement
 * grouped by category with a live progress bar, its reward, and an unlocked /
 * in-progress status, plus a header summary (N / M unlocked). Rewards auto-grant
 * elsewhere (core/achievements.ts); this scene is a tracker. Scrolls vertically.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import type { SaveManager } from "../core/saveManager.ts";
import {
  buildAchievementView,
  type AchievementCardVM,
  type AchievementGroupVM,
} from "../core/achievementView.ts";

const W = 960;
const COLS = 2;
const CW = 452;
const CH = 92;
const X0 = 20;
const GAP_X = 16;
const GAP_Y = 10;
const VIEW_H = 460; // visible content height below the header

export class AchievementScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private contentH = 0;

  constructor() {
    super("AchievementScene");
  }

  create(): void {
    fadeIn(this);
    this.scrollY = 0;
    this.contentH = 0; // reset on re-entry (Phaser reuses instances)
    this.mgr = this.registry.get("saveManager");

    crispText(this, W / 2, 10, "🏆 Achievements", {
      fontSize: "24px",
      color: "#ffd700",
      fontStyle: "bold",
    })
      .setOrigin(0.5, 0)
      .setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "MainMenuScene"));

    this.layer = this.add.container(0, 0);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY - dy * 0.5,
        Math.min(0, -(this.contentH - VIEW_H)),
        0,
      );
      this.layer.y = this.scrollY;
    });

    this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.layer.y = this.scrollY;
    const view = buildAchievementView(this.mgr.getSave());

    this.layer.add(
      crispText(this, W / 2, 40, `${view.unlocked} / ${view.total} unlocked`, {
        fontSize: "13px",
        color: view.unlocked > 0 ? "#ffd56a" : "#90a4bb",
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );

    let y = 64;
    for (const group of view.groups) y = this.drawGroup(group, y);
    this.contentH = y + 20;
  }

  private drawGroup(group: AchievementGroupVM, y: number): number {
    const done = group.cards.filter((c) => c.unlocked).length;
    this.layer.add(
      crispText(this, X0, y, `${group.category}   ${done}/${group.cards.length}`, {
        fontSize: "15px",
        color: "#cfe0f5",
        fontStyle: "bold",
      }),
    );
    const rowY = y + 24;
    group.cards.forEach((card, i) => {
      const x = X0 + (i % COLS) * (CW + GAP_X);
      const cy = rowY + Math.floor(i / COLS) * (CH + GAP_Y);
      this.drawCard(card, x, cy);
    });
    const rows = Math.ceil(group.cards.length / COLS);
    return rowY + rows * (CH + GAP_Y) + 8;
  }

  private drawCard(card: AchievementCardVM, x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(card.unlocked ? 0x1f2a18 : 0x161d28, 1).fillRoundedRect(x, y, CW, CH, 10);
    g.lineStyle(2, card.unlocked ? 0xffc94d : 0x2c3a4f, 1).strokeRoundedRect(x, y, CW, CH, 10);
    this.layer.add(g);

    this.layer.add(
      crispText(this, x + 14, y + 10, card.name, {
        fontSize: "16px",
        color: card.unlocked ? "#ffe9b0" : "#cdd6e6",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(this, x + CW - 14, y + 12, card.rewardLabel, {
        fontSize: "12px",
        color: "#ffe07a",
      }).setOrigin(1, 0),
    );
    this.layer.add(
      crispText(this, x + 14, y + 32, card.description, {
        fontSize: "11px",
        color: "#aab8cc",
        wordWrap: { width: CW - 140 },
      }),
    );

    // Progress bar.
    const bx = x + 14;
    const by = y + CH - 22;
    const bw = CW - 150;
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.5).fillRoundedRect(bx, by, bw, 12, 4);
    bar
      .fillStyle(card.unlocked ? 0x53c46a : 0x4a8cff, 1)
      .fillRoundedRect(bx, by, Math.max(2, bw * card.frac), 12, 4);
    this.layer.add(bar);
    this.layer.add(
      crispText(this, bx + bw + 6, by - 1, `${Math.min(card.current, card.target)}/${card.target}`, {
        fontSize: "11px",
        color: "#cdd6e6",
      }),
    );

    // Status badge.
    this.layer.add(
      crispText(this, x + CW - 14, y + CH - 24, card.unlocked ? "✓ Unlocked" : "In progress", {
        fontSize: "12px",
        color: card.unlocked ? "#9fe0b0" : "#6b7a8d",
        fontStyle: card.unlocked ? "bold" : "normal",
      }).setOrigin(1, 0),
    );
  }
}
