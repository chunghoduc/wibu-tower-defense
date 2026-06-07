import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { STAGES } from "../data/stage.ts";
import { ENEMIES } from "../data/enemies.ts";
import { enemySpecialty, enemyTags } from "../data/enemyInfo.ts";
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
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

    this.add
      .text(W - 20, 12, "? Enemies", { fontSize: "14px", color: "#fff", backgroundColor: "#2a3a5a" })
      .setOrigin(1, 0).setPadding(10, 5, 10, 5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.openCompendium());

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

  // ---- Enemy compendium (T16) ---------------------------------------------

  private openCompendium(): void {
    const W = this.scale.width, H = this.scale.height;
    const root = this.add.container(0, 0).setDepth(100);

    const overlay = this.add.rectangle(0, 0, W, H, 0x05070c, 0.82).setOrigin(0).setInteractive();
    root.add(overlay);

    const PX = 80, PY = 40, PW = W - 160, PH = H - 80;
    const panel = this.add.graphics();
    panel.fillStyle(0x141a26, 1).fillRoundedRect(PX, PY, PW, PH, 10);
    panel.lineStyle(2, 0x3a4a6a, 1).strokeRoundedRect(PX, PY, PW, PH, 10);
    root.add(panel);
    root.add(this.add.text(PX + 16, PY + 12, "Enemy Compendium", { fontSize: "20px", color: "#ffd700", fontStyle: "bold" }));
    root.add(this.add.text(PX + 16, PY + 38, "Know your foes — their specialties and immunities. Scroll to see all.", { fontSize: "11px", color: "#90a4bb" }));
    const close = this.add.text(PX + PW - 14, PY + 12, "✕", { fontSize: "20px", color: "#ef9a9a" })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => root.destroy(true));
    root.add(close);

    // Scrollable list viewport
    const vpX = PX + 14, vpY = PY + 64, vpW = PW - 28, vpH = PH - 78;
    const list = this.add.container(vpX, vpY);
    root.add(list);
    const maskG = this.make.graphics({}).fillRect(vpX, vpY, vpW, vpH);
    list.setMask(maskG.createGeometryMask());

    const ordered = [...ENEMIES].sort((a, b) => Number(a.archetype === "Boss") - Number(b.archetype === "Boss"));
    const ROW_H = 58;
    ordered.forEach((e, i) => {
      const y = i * ROW_H;
      const boss = e.archetype === "Boss";
      const card = this.add.graphics();
      card.fillStyle(boss ? 0x2a1f2e : 0x1c2433, 1).fillRoundedRect(0, y, vpW, ROW_H - 6, 6);
      list.add(card);
      const key = `${boss ? "boss" : "enemy"}__${e.id}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(28, y + (ROW_H - 6) / 2, key).setOrigin(0.5);
        const s = 40 / Math.max(img.width, img.height);
        img.setScale(s);
        // show first frame only (spritesheet)
        list.add(img);
      }
      list.add(this.add.text(56, y + 6, e.name, { fontSize: "13px", color: boss ? "#ff9a9a" : "#e6edf6", fontStyle: "bold" }));
      list.add(this.add.text(56, y + 23, `${e.archetype}  ·  ${enemySpecialty(e)}`, { fontSize: "10px", color: "#aab8cc", wordWrap: { width: vpW - 220 } }));
      const tags = enemyTags(e);
      if (tags.length) {
        list.add(this.add.text(vpW - 8, y + 8, tags.join("  ·  "), { fontSize: "9px", color: "#7fd0a0", align: "right", wordWrap: { width: 160 } }).setOrigin(1, 0));
      }
    });

    const contentH = ordered.length * ROW_H;
    const minY = vpY - Math.max(0, contentH - vpH);

    let dragging = false, dragStart = 0, listStart = 0;
    overlay.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!root.active) return;
      const inPanel = p.x >= PX && p.x <= PX + PW && p.y >= PY && p.y <= PY + PH;
      if (!inPanel) { root.destroy(true); return; }
      dragging = true; dragStart = p.y; listStart = list.y;
    });
    const wheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (list.active) list.y = Phaser.Math.Clamp(list.y - dy * 0.5, minY, vpY);
    };
    const move = (p: Phaser.Input.Pointer) => {
      if (dragging && list.active) list.y = Phaser.Math.Clamp(listStart + (p.y - dragStart), minY, vpY);
    };
    const up = () => { dragging = false; };
    this.input.on("wheel", wheel);
    this.input.on("pointermove", move);
    this.input.on("pointerup", up);
    root.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.input.off("wheel", wheel);
      this.input.off("pointermove", move);
      this.input.off("pointerup", up);
    });
  }
}
