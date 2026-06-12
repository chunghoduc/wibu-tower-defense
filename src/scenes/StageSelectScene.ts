import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { STAGES, stageNumber } from "../data/stage.ts";
import { ENEMIES } from "../data/enemies.ts";
import { stageBgKey } from "../data/uiManifest.ts";
import { openEnemyPanel, enemiesForStage } from "./enemyListPanel.ts";
import { isDifficultyUnlocked, prerequisiteTier } from "../core/difficultyUnlock.ts";
import { CAMPAIGN_CHAPTERS, playerChapterOf, campaignChapterForStage } from "../data/campaign.ts";
import type { HeroSave } from "../core/save.ts";
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
  private selectedChapter = 1;
  private diffBtns: Phaser.GameObjects.Text[] = [];
  private chapterBtns: Phaser.GameObjects.Text[] = [];
  private stageLayer?: Phaser.GameObjects.Container;
  private legend?: Phaser.GameObjects.Text;
  private regionText?: Phaser.GameObjects.Text;

  constructor() {
    super("StageSelectScene");
  }

  create(): void {
    fadeIn(this);
    // Phaser reuses the scene instance across visits, so clear refs from the
    // previous visit — otherwise refreshDiffTabs() would call setBackgroundColor
    // on destroyed Texts whose WebGL texture source is gone (crash on real GPU).
    this.diffBtns = [];
    this.chapterBtns = [];
    this.stageLayer = undefined;
    this.legend = undefined;
    this.regionText = undefined;
    const mgr: SaveManager = this.registry.get("saveManager");
    const save = mgr.getSave();
    // Open on the furthest region the player has reached, so returning players
    // land where they left off rather than back at Chapter 1.
    this.selectedChapter = this.furthestReachedChapter(save);
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
        .setOrigin(1, 0)
        .setPadding(10, 5, 10, 5)
        .setInteractive({ useHandCursor: true });
      b.on("pointerover", () => b.setAlpha(0.85));
      b.on("pointerout", () => b.setAlpha(1));
      b.on("pointerdown", onClick);
      rightX -= b.width + 8;
    };
    place("? Enemies", "#2a3a5a", () => this.openCompendium());
    place("✦ Skills", "#3a2a5a", () => this.openLoadout("SkillsScene"));
    place("⚔ Squad", "#2a4a3a", () => this.openLoadout("SquadScene"));

    // Chapter (region) tabs — only chapters that actually have stages.
    const chapters = CAMPAIGN_CHAPTERS.filter((c) =>
      STAGES.some((s) => playerChapterOf(s.id) === c.chapter),
    );
    const chTabY = 50;
    const chSpan = 150;
    chapters.forEach((c, i) => {
      const x = W / 2 - ((chapters.length - 1) * chSpan) / 2 + i * chSpan;
      const btn = this.add
        .text(x, chTabY, `Ch.${c.chapter}`, {
          fontSize: "15px",
          color: "#ffd9a0",
          backgroundColor: "#241a2e",
        })
        .setOrigin(0.5)
        .setPadding(14, 6, 14, 6)
        .setInteractive({ useHandCursor: true });
      btn.setData("chapter", c.chapter);
      btn.on("pointerdown", () => {
        this.selectedChapter = c.chapter;
        this.refreshChapterTabs();
        this.refreshRegion();
        this.buildStageGrid(save);
      });
      this.chapterBtns.push(btn);
    });
    this.refreshChapterTabs();

    // Region name + lore blurb for the selected chapter.
    this.regionText = this.add
      .text(W / 2, 76, "", {
        fontSize: "11px",
        color: "#c8b8a0",
        align: "center",
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5, 0);
    this.refreshRegion();

    // Difficulty tabs
    const tabY = 110;
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
        this.buildStageGrid(save);
      });
      this.diffBtns.push(btn);
    });
    this.refreshDiffTabs();

    // Stage cards (rebuilt whenever the difficulty tab changes)
    this.buildStageGrid(save);

    // Legend at bottom (its text tracks the selected difficulty's unlock rule)
    this.legend = this.add
      .text(W / 2, H - 14, "", { fontSize: "10px", color: "#555555" })
      .setOrigin(0.5, 1);
    this.refreshLegend();
  }

  /** (Re)paint the stage card grid for the currently selected difficulty. */
  private buildStageGrid(save: HeroSave): void {
    const W = this.scale.width;
    this.stageLayer?.destroy(true);
    const layer = this.add.container(0, 0);
    this.stageLayer = layer;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      layer.add(o);
      return o;
    };

    const clearMap = save.progress.stageClearMap;
    const START_X = (W - (COLS - 1) * GAP_X - CARD_W) / 2 + CARD_W / 2;
    const START_Y = 138;

    // Only the selected chapter's stages, but keep each stage's GLOBAL index so
    // sequential unlocking and the displayed stage number stay continuous across
    // chapters (a chapter's first stage gates behind the prior chapter's last).
    const chapterStages = STAGES.map((stage, gi) => ({ stage, gi })).filter(
      ({ stage }) => playerChapterOf(stage.id) === this.selectedChapter,
    );

    chapterStages.forEach(({ stage, gi }, li) => {
      const col = li % COLS;
      const row = Math.floor(li / COLS);
      const x = START_X + col * GAP_X;
      const y = START_Y + row * GAP_Y;

      const clearRecord = clearMap[stage.id];
      const anyCleared =
        clearRecord && (clearRecord.Normal || clearRecord.Hard || clearRecord.Nightmare);
      // Sequential gate: can't even open a stage until the previous one is
      // cleared on Normal. Tier gate: this stage's chapter must be conquered on
      // the tier below before the selected harder tier can be played.
      const isLocked = gi > 0 && !clearMap[STAGES[gi - 1].id]?.Normal;
      const tierLocked =
        !isLocked && !isDifficultyUnlocked(save, stage.id, this.selectedDifficulty);
      const dimmed = isLocked || tierLocked;
      const left = x - CARD_W / 2;

      // Per-card layers stacked by insertion order (fill → art → veil → border →
      // text), so each card's painting reads cleanly and text stays legible.
      const bg = isLocked ? 0x222222 : tierLocked ? 0x2a2230 : anyCleared ? 0x1a3a2a : 0x1a2a3a;
      add(this.add.graphics().fillStyle(bg, 1).fillRoundedRect(left, y, CARD_W, CARD_H, 8));

      // The stage's hand-painted backdrop, cover-fit and masked to the rounded
      // card so each stage is recognisable at a glance. Stages without bespoke
      // art (the expansion chapters) fall back to their region backdrop. Locked
      // stages stay dark.
      let bgkey = stageBgKey(stage.id);
      if (!this.textures.exists(bgkey)) {
        const ch = campaignChapterForStage(stage.id);
        if (ch) bgkey = ch.bgKey;
      }
      if (this.textures.exists(bgkey)) {
        const img = add(this.add.image(x, y + CARD_H / 2, bgkey));
        img.setScale(Math.max(CARD_W / img.width, CARD_H / img.height));
        // Invisible mask child — destroyed with the layer on rebuild (no leak).
        const maskG = add(
          this.add.graphics().fillStyle(0xffffff).fillRoundedRect(left, y, CARD_W, CARD_H, 8),
        );
        maskG.setVisible(false);
        img.setMask(maskG.createGeometryMask());
        if (dimmed) img.setTint(isLocked ? 0x55585f : 0x8a7fa0);
        // Dark veil so the card text stays legible over the art.
        add(
          this.add
            .graphics()
            .fillStyle(0x05070c, dimmed ? 0.6 : 0.5)
            .fillRoundedRect(left, y, CARD_W, CARD_H, 8),
        );
      }
      add(
        this.add
          .graphics()
          .lineStyle(2, isLocked ? 0x333333 : tierLocked ? 0x5a4a6a : 0x4a6a8a, 1)
          .strokeRoundedRect(left, y, CARD_W, CARD_H, 8),
      );

      // Per-stage "Foes" scout button (top-left) — list the enemies & boss this
      // stage fields, so the player can plan a loadout. Available even when the
      // stage is locked, so the road ahead can be scouted.
      const foes = add(
        this.add
          .text(left + 6, y + 6, "👁 Foes", {
            fontSize: "9px",
            color: "#ffe0a0",
            backgroundColor: "#00000088",
          })
          .setOrigin(0, 0)
          .setPadding(4, 2, 4, 2)
          .setInteractive({ useHandCursor: true }),
      );
      foes.on("pointerover", () => foes.setColor("#fff2cc"));
      foes.on("pointerout", () => foes.setColor("#ffe0a0"));
      foes.on("pointerdown", () => this.openStageEnemies(stage));

      // Stage number + name (stroked so they read over the painted backdrop)
      const nameColor = dimmed ? "#888888" : "#ffffff";
      add(
        this.add
          .text(x, y + 10, `Stage ${stageNumber(stage.id)}`, {
            fontSize: "11px",
            color: isLocked ? "#556677" : "#9fd0ff",
            fontStyle: "bold",
            stroke: "#05070c",
            strokeThickness: 3,
          })
          .setOrigin(0.5, 0),
      );

      add(
        this.add
          .text(x, y + 26, stage.name, {
            fontSize: "9px",
            color: nameColor,
            wordWrap: { width: CARD_W - 12 },
            align: "center",
            stroke: "#05070c",
            strokeThickness: 3,
          })
          .setOrigin(0.5, 0),
      );

      // Clear badges
      if (clearRecord) {
        const badges: string[] = [];
        if (clearRecord.Normal) badges.push("N");
        if (clearRecord.Hard) badges.push("H");
        if (clearRecord.Nightmare) badges.push("NM");
        if (badges.length > 0) {
          add(
            this.add
              .text(x, y + 54, badges.join(" · "), {
                fontSize: "9px",
                color: "#ffd700",
              })
              .setOrigin(0.5, 0),
          );
        }
      }

      if (isLocked) {
        add(this.add.text(x, y + CARD_H / 2, "🔒", { fontSize: "20px" }).setOrigin(0.5, 0.5));
        return;
      }

      // Tier-locked: the stage is reachable, but the selected difficulty is
      // gated behind clearing this chapter on the tier below. Show why instead
      // of a Play button.
      if (tierLocked) {
        const prereq = prerequisiteTier(this.selectedDifficulty);
        add(
          this.add
            .text(x, y + CARD_H - 10, `🔒 Clear chapter on ${prereq}`, {
              fontSize: "9px",
              color: "#caa6e0",
              backgroundColor: "#3a2a4a",
              align: "center",
            })
            .setOrigin(0.5, 1)
            .setPadding(8, 4, 8, 4),
        );
        return;
      }

      // Play button area
      const playBtn = add(
        this.add
          .text(x, y + CARD_H - 10, "▶ Play", {
            fontSize: "12px",
            color: "#ffffff",
            backgroundColor: "#1565c0",
          })
          .setOrigin(0.5, 1)
          .setPadding(10, 4, 10, 4)
          .setInteractive({ useHandCursor: true }),
      );

      playBtn.on("pointerover", () => playBtn.setBackgroundColor("#1e88e5"));
      playBtn.on("pointerout", () => playBtn.setBackgroundColor("#1565c0"));
      playBtn.on("pointerdown", () => this.launchStage(stage));
    });

    this.refreshLegend();
  }

  /** Bottom hint line — explains the unlock rule for the selected tier. */
  private refreshLegend(): void {
    if (!this.legend) return;
    const prereq = prerequisiteTier(this.selectedDifficulty);
    const text = prereq
      ? `${this.selectedDifficulty} unlocks per chapter once every stage is cleared on ${prereq}  ·  N/H/NM = clear badges`
      : "Clear Normal to unlock the next stage  ·  clear a whole chapter to open Hard  ·  N/H/NM = clear badges";
    this.legend.setText(text);
  }

  private refreshDiffTabs(): void {
    DIFFICULTIES.forEach((diff, i) => {
      const btn = this.diffBtns[i];
      const active = diff === this.selectedDifficulty;
      btn.setBackgroundColor(active ? "#2a4a6a" : "#1a2a3a");
      btn.setAlpha(active ? 1 : 0.6);
    });
  }

  private refreshChapterTabs(): void {
    this.chapterBtns.forEach((btn) => {
      const active = btn.getData("chapter") === this.selectedChapter;
      btn.setBackgroundColor(active ? "#4a3622" : "#241a2e");
      btn.setAlpha(active ? 1 : 0.6);
    });
  }

  /** Region title + lore hook for the selected chapter. */
  private refreshRegion(): void {
    if (!this.regionText) return;
    const c = CAMPAIGN_CHAPTERS.find((x) => x.chapter === this.selectedChapter);
    this.regionText.setText(c ? `${c.title} — ${c.blurb}` : "");
  }

  /** The deepest region whose first stage is unlocked, so we open there. */
  private furthestReachedChapter(save: HeroSave): number {
    const clearMap = save.progress.stageClearMap;
    const present = CAMPAIGN_CHAPTERS.map((c) => c.chapter).filter((ch) =>
      STAGES.some((s) => playerChapterOf(s.id) === ch),
    );
    let best = present[0] ?? 1;
    for (const ch of present) {
      const first = STAGES.findIndex((s) => playerChapterOf(s.id) === ch);
      if (first < 0) continue;
      const unlocked = first === 0 || clearMap[STAGES[first - 1].id]?.Normal === true;
      if (unlocked) best = Math.max(best, ch);
    }
    return best;
  }

  private launchStage(stage: StageDef): void {
    // Guard: the Play button is only shown when unlocked, but never trust the
    // view alone to enforce the tier gate.
    const mgr: SaveManager = this.registry.get("saveManager");
    if (!isDifficultyUnlocked(mgr.getSave(), stage.id, this.selectedDifficulty)) return;
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
    const ordered = [...ENEMIES].sort(
      (a, b) => Number(a.archetype === "Boss") - Number(b.archetype === "Boss"),
    );
    openEnemyPanel(
      this,
      "Enemy Compendium",
      "Know your foes — their specialties and immunities. Scroll to see all.",
      ordered,
    );
  }

  /** Just the foes a specific stage fields, so the player can plan a loadout. */
  private openStageEnemies(stage: StageDef): void {
    const list = enemiesForStage(stage);
    openEnemyPanel(
      this,
      `${stage.name} — Foes`,
      "Enemies and the boss you'll face here. Plan your squad accordingly.",
      list,
    );
  }
}
