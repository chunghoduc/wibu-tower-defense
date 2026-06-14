/**
 * ExpeditionScene — the quest board. Renders up to BOARD_SIZE quest cards, each
 * Available (Assign → tower-picker dialog), Running (live countdown + assigned
 * tower icons), or Ready (Claim → rolled, rarity-scaled reward). The board is
 * filled/rerolled on entry; countdowns tick on a 1s timer that only re-renders
 * when a quest crosses into Ready. Reward rolls + persistence live in the core.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import { rewardEmojis } from "./rewardBurst.ts";
import { rewardLabel } from "../core/rewards.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { QuestAssignDialog } from "./questAssignDialog.ts";
import {
  QUEST_TIERS,
  tierRewardPreview,
  type QuestInstance,
} from "../data/expeditionQuests.ts";
import { questState, questRemainingMs } from "../core/expeditionBoard.ts";
import { towerTex, rarityTex } from "../data/assetKeys.ts";
import { RARITY_HEX, RARITY_INT } from "../data/rarityColors.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { raritySlotRow } from "./raritySlotRow.ts";
import type { Rarity } from "../data/schemaEnums.ts";

const W = 960;
const CARD_X = 24;
const CARD_W = W - 48;
const CARD_H = 84;
const CARD_GAP = 10;
const TOP = 56;

/** Human "5h 02m" / "3m 20s" / "ready" countdown. */
function fmt(ms: number): string {
  if (ms <= 0) return "ready";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** "15m" / "2h" / "12h" duration label from ms. */
function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  return min >= 60 ? `${Math.round(min / 60)}h` : `${min}m`;
}

export class ExpeditionScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  /** Per-card live countdown labels, keyed by quest id (Running only). */
  private timerLabels = new Map<string, Phaser.GameObjects.Text>();

  constructor() {
    super("ExpeditionScene");
  }

  create(): void {
    fadeIn(this);
    this.timerLabels.clear();
    this.mgr = this.registry.get("saveManager");
    this.mgr.ensureExpeditionBoard();

    crispText(this, W / 2, 10, "🧭 Expedition Board", {
      fontSize: "22px",
      color: "#ffd700",
      fontStyle: "bold",
    })
      .setOrigin(0.5, 0)
      .setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "ActivitiesScene"));

    this.layer = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 520, "", {
      fontSize: "13px",
      color: "#ffe1a8",
      backgroundColor: "#2a1f14",
    })
      .setOrigin(0.5)
      .setPadding(10, 5, 10, 5)
      .setDepth(60)
      .setVisible(false);

    this.redraw();
    // Tick countdowns once a second; flip to Ready (full redraw) when due.
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
  }

  private tick(): void {
    const now = Date.now();
    let needsRedraw = false;
    for (const q of this.mgr.expeditionQuests()) {
      const label = this.timerLabels.get(q.id);
      if (!label) continue;
      if (questState(q, now) === "ready") {
        needsRedraw = true;
        break;
      }
      label.setText(fmt(questRemainingMs(q, now)));
    }
    if (needsRedraw) this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.timerLabels.clear();
    const quests = this.mgr.expeditionQuests();
    const ready = this.mgr.expeditionClaimable();
    this.layer.add(
      crispText(this, W / 2, 36, `${quests.length} quests · ${ready} ready to claim`, {
        fontSize: "13px",
        color: ready > 0 ? "#ffd56a" : "#90a4bb",
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );
    quests.forEach((q, i) => this.drawCard(q, TOP + i * (CARD_H + CARD_GAP)));

    // Free daily reroll button (rotates Available quests; Running ones survive).
    const left = this.mgr.expeditionRerollsLeft();
    const btn = crispText(this, W - 24, 30, `🎲 Reroll (${left}/5)`, {
      fontSize: "14px",
      color: left > 0 ? "#ffffff" : "#7a8699",
      backgroundColor: left > 0 ? "#5a3a7a" : "#2a3340",
      fontStyle: "bold",
    })
      .setOrigin(1, 0)
      .setPadding(12, 6, 12, 6);
    if (left > 0) {
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerup", () => {
        if (this.mgr.rerollExpeditionBoard()) {
          this.showToast("Board rerolled!");
          this.redraw();
        }
      });
    }
    this.layer.add(btn);
  }

  private drawCard(q: QuestInstance, y: number): void {
    const now = Date.now();
    const state = questState(q, now);
    const accent = RARITY_INT[q.rarity];
    const g = this.add.graphics();
    g.fillStyle(state === "ready" ? 0x1f2a18 : 0x161d28, 1).fillRoundedRect(
      CARD_X,
      y,
      CARD_W,
      CARD_H,
      10,
    );
    g.lineStyle(2, state === "ready" ? 0xffc94d : accent, 1).strokeRoundedRect(
      CARD_X,
      y,
      CARD_W,
      CARD_H,
      10,
    );
    this.layer.add(g);

    this.layer.add(
      crispText(this, CARD_X + 14, y + 10, `${q.rarity} Expedition`, {
        fontSize: "16px",
        color: RARITY_HEX[q.rarity],
        fontStyle: "bold",
      }),
    );
    const tier = QUEST_TIERS[q.rarity];
    // "Needs" caption + rarity gem row (replaces the text "Needs ≥Common + …").
    this.layer.add(
      crispText(this, CARD_X + 14, y + 33, "Needs", { fontSize: "11px", color: "#aab8cc" }),
    );
    this.drawRarityGems(q.slots, CARD_X + 58, y + 39);
    // Reward: a "could-drop" icon row (the pool — exact roll stays a surprise).
    this.layer.add(
      crispText(this, CARD_X + 14, y + 54, `${tier.rewardHint} · ${fmtDuration(q.durationMs)}`, {
        fontSize: "11px",
        color: "#ffe07a",
      }),
    );
    tierRewardPreview(q.rarity).forEach((view, i) => {
      this.layer.add(makeFitIcon(this, CARD_X + 250 + i * 26, y + 58, view.iconKey, 22, view.emoji));
    });

    if (state === "available") this.drawAvailable(q, y);
    else this.drawRunningOrReady(q, state, y, now);
  }

  /** Draw the required-rarity gem row; texture per gem, procedural faceted fallback. */
  private drawRarityGems(slots: Rarity[], x: number, y: number): void {
    for (const gem of raritySlotRow(slots, x, y)) {
      const key = rarityTex(gem.rarity);
      if (this.textures.exists(key)) {
        const img = this.add.image(gem.cx, gem.cy, key).setOrigin(0.5);
        img.setScale(gem.size / Math.max(img.width, img.height));
        this.layer.add(img);
        continue;
      }
      const g = this.add.graphics();
      const r = gem.size / 2;
      const col = RARITY_INT[gem.rarity];
      g.fillStyle(col, 1).fillPoints(
        [
          { x: gem.cx, y: gem.cy - r },
          { x: gem.cx + r, y: gem.cy },
          { x: gem.cx, y: gem.cy + r },
          { x: gem.cx - r, y: gem.cy },
        ],
        true,
      );
      g.fillStyle(0xffffff, 0.35).fillPoints(
        [
          { x: gem.cx, y: gem.cy - r },
          { x: gem.cx + r * 0.5, y: gem.cy - r * 0.2 },
          { x: gem.cx, y: gem.cy },
          { x: gem.cx - r * 0.5, y: gem.cy - r * 0.2 },
        ],
        true,
      );
      this.layer.add(g);
    }
  }

  private drawAvailable(q: QuestInstance, y: number): void {
    this.button(CARD_X + CARD_W - 16, y + CARD_H / 2, "Assign", "#3a6a9a", true, () => {
      new QuestAssignDialog(this, this.mgr, q, (towerIds) => {
        if (this.mgr.startExpeditionQuest(q.id, towerIds)) {
          this.showToast(
            `Dispatched ${towerIds.length} hero${towerIds.length === 1 ? "" : "es"}!`,
          );
          this.redraw();
        }
      });
    });
  }

  private drawRunningOrReady(
    q: QuestInstance,
    state: "running" | "ready",
    y: number,
    now: number,
  ): void {
    // Assigned tower icons (small).
    q.assigned.forEach((id, i) => {
      const key = towerTex(id);
      if (!this.textures.exists(key)) return;
      const img = this.add.image(CARD_X + CARD_W - 220 + i * 34, y + CARD_H / 2, key).setOrigin(0.5);
      img.setScale(30 / img.height);
      this.layer.add(img);
    });
    if (state === "ready") {
      this.button(CARD_X + CARD_W - 16, y + CARD_H / 2, "Claim", "#1f8f43", true, () => {
        const reward = this.mgr.claimExpeditionQuest(q.id);
        const label = rewardLabel(reward);
        if (label) this.celebrate(y + CARD_H / 2, rewardEmojis(reward));
        this.showToast(`Expedition: ${label || "claimed"}`);
        this.redraw();
      });
    } else {
      const label = crispText(
        this,
        CARD_X + CARD_W - 16,
        y + CARD_H / 2,
        fmt(questRemainingMs(q, now)),
        { fontSize: "16px", color: "#9fd0ff", fontStyle: "bold" },
      ).setOrigin(1, 0.5);
      this.layer.add(label);
      this.timerLabels.set(q.id, label);
    }
  }

  private button(
    x: number,
    y: number,
    label: string,
    color: string,
    enabled: boolean,
    cb: () => void,
  ): void {
    const t = crispText(this, x, y, label, {
      fontSize: "15px",
      color: enabled ? "#ffffff" : "#7a8699",
      backgroundColor: enabled ? color : "#2a3340",
      fontStyle: "bold",
    })
      .setOrigin(1, 0.5)
      .setPadding(16, 7, 16, 7);
    if (enabled) {
      t.setInteractive({ useHandCursor: true });
      t.on("pointerup", cb);
    }
    this.layer.add(t);
  }

  /** One-shot emoji burst on the scene root (survives the redraw of `layer`). */
  private celebrate(centerY: number, emojis: string[]): void {
    emojis.slice(0, 5).forEach((e, i) => {
      const t = crispText(this, CARD_X + CARD_W - 60 + i * 6, centerY, e, {
        fontSize: "20px",
      }).setDepth(120);
      this.tweens.add({
        targets: t,
        y: centerY - 40,
        alpha: 0,
        duration: 900,
        delay: i * 60,
        onComplete: () => t.destroy(),
      });
    });
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }
}
