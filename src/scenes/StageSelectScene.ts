import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { STAGES } from "../data/stage.ts";
import { ENEMIES } from "../data/enemies.ts";
import { stageBgKey } from "../data/uiManifest.ts";
import { openEnemyPanel, enemiesForStage } from "./enemyListPanel.ts";
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
    fadeIn(this);
    // Phaser reuses the scene instance across visits, so clear refs from the
    // previous visit — otherwise refreshDiffTabs() would call setBackgroundColor
    // on destroyed Texts whose WebGL texture source is gone (crash on real GPU).
    this.diffBtns = [];
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
      .on("pointerdown", () => fadeToScene(this, "MainMenuScene"));

    // Top-right utility bar (laid out right-to-left): jump to Squad / Skills
    // loadout, or the full enemy compendium — so the player can tune their run
    // before entering a stage.
    let rightX = W - 20;
    const place = (label: string, color: string, onClick: () => void): void => {
      const b = this.add
        .text(rightX, 12, label, { fontSize: "14px", color: "#fff", backgroundColor: color })
        .setOrigin(1, 0).setPadding(10, 5, 10, 5)
        .setInteractive({ useHandCursor: true });
      b.on("pointerover", () => b.setAlpha(0.85));
      b.on("pointerout", () => b.setAlpha(1));
      b.on("pointerdown", onClick);
      rightX -= b.width + 8;
    };
    place("? Enemies", "#2a3a5a", () => this.openCompendium());
    place("✦ Skills", "#3a2a5a", () => this.openLoadout("SkillsScene"));
    place("⚔ Squad", "#2a4a3a", () => this.openLoadout("SquadScene"));

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

    STAGES.forEach((stage, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = START_X + col * GAP_X;
      const y = START_Y + row * GAP_Y;

      const clearRecord = clearMap[stage.id];
      const anyCleared = clearRecord && (clearRecord.Normal || clearRecord.Hard || clearRecord.Nightmare);
      const isLocked = i > 0 && !clearMap[STAGES[i - 1].id]?.Normal;
      const left = x - CARD_W / 2;

      // Per-card layers stacked by insertion order (fill → art → veil → border →
      // text), so each card's painting reads cleanly and text stays legible.
      const bg = isLocked ? 0x222222 : anyCleared ? 0x1a3a2a : 0x1a2a3a;
      this.add.graphics().fillStyle(bg, 1).fillRoundedRect(left, y, CARD_W, CARD_H, 8);

      // The stage's hand-painted backdrop, cover-fit and masked to the rounded
      // card so each stage is recognisable at a glance. Locked stages stay dark.
      const bgkey = stageBgKey(stage.id);
      if (this.textures.exists(bgkey)) {
        const img = this.add.image(x, y + CARD_H / 2, bgkey);
        img.setScale(Math.max(CARD_W / img.width, CARD_H / img.height));
        const maskG = this.make.graphics({}).fillStyle(0xffffff).fillRoundedRect(left, y, CARD_W, CARD_H, 8);
        img.setMask(maskG.createGeometryMask());
        if (isLocked) img.setTint(0x55585f);
        // Dark veil so the card text stays legible over the art.
        this.add.graphics().fillStyle(0x05070c, isLocked ? 0.62 : 0.5).fillRoundedRect(left, y, CARD_W, CARD_H, 8);
      }
      this.add.graphics().lineStyle(2, isLocked ? 0x333333 : 0x4a6a8a, 1).strokeRoundedRect(left, y, CARD_W, CARD_H, 8);

      // Per-stage "Foes" scout button (top-left) — list the enemies & boss this
      // stage fields, so the player can plan a loadout. Available even when the
      // stage is locked, so the road ahead can be scouted.
      const foes = this.add
        .text(left + 6, y + 6, "👁 Foes", { fontSize: "9px", color: "#ffe0a0", backgroundColor: "#00000088" })
        .setOrigin(0, 0).setPadding(4, 2, 4, 2)
        .setInteractive({ useHandCursor: true });
      foes.on("pointerover", () => foes.setColor("#fff2cc"));
      foes.on("pointerout", () => foes.setColor("#ffe0a0"));
      foes.on("pointerdown", () => this.openStageEnemies(stage));

      // Stage number + name (stroked so they read over the painted backdrop)
      const nameColor = isLocked ? "#777777" : "#ffffff";
      this.add
        .text(x, y + 10, `Stage ${i + 1}`, {
          fontSize: "11px",
          color: isLocked ? "#556677" : "#9fd0ff",
          fontStyle: "bold",
          stroke: "#05070c",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0);

      this.add
        .text(x, y + 26, stage.name, {
          fontSize: "9px",
          color: nameColor,
          wordWrap: { width: CARD_W - 12 },
          align: "center",
          stroke: "#05070c",
          strokeThickness: 3,
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

  /**
   * Open the Squad / Skills loadout scene, remembering to return here (rather
   * than the main menu) so the player can adjust a run and come straight back
   * to the stage they were about to play.
   */
  private openLoadout(scene: "SquadScene" | "SkillsScene"): void {
    this.registry.set("loadoutReturnScene", "StageSelectScene");
    fadeToScene(this, scene);
  }

  // ---- Enemy intel (T16) --------------------------------------------------

  /** The full enemy compendium — every foe in the game. */
  private openCompendium(): void {
    const ordered = [...ENEMIES].sort((a, b) => Number(a.archetype === "Boss") - Number(b.archetype === "Boss"));
    openEnemyPanel(this, "Enemy Compendium", "Know your foes — their specialties and immunities. Scroll to see all.", ordered);
  }

  /** Just the foes a specific stage fields, so the player can plan a loadout. */
  private openStageEnemies(stage: StageDef): void {
    const list = enemiesForStage(stage);
    openEnemyPanel(this, `${stage.name} — Foes`, "Enemies and the boss you'll face here. Plan your squad accordingly.", list);
  }
}
