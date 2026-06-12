/**
 * ActivitiesScene — the engagement hub for the addictive-features suite. One
 * place to claim the daily login streak (F1), spin the lucky wheel (F4), manage
 * the idle expedition (F2), collect weekly bounties (F3) and tiered milestones
 * (F15), and read the profile / Power Rating (F16). Scrolls vertically.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene, accentPanel, actionChip } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { rewardLabel } from "../core/rewards.ts";
import { rewardBurst, rewardEmojis } from "./rewardBurst.ts";
import { playSpinReel } from "./spinReel.ts";
import { nextStreakReward, streakClaimable, STREAK_CYCLE } from "../core/streak.ts";
import { freeSpinAvailable, PAID_SPIN_COST } from "../core/spin.ts";
import { expeditionActive, expeditionPendingGold } from "../core/expedition.ts";
import { isoWeekKey } from "../core/meta.ts";
import { STAGES } from "../data/stage.ts";
import type { BattleMode } from "./BattleScene.ts";
import type { Difficulty } from "../data/schema.ts";
import {
  PANEL_X,
  PANEL_W,
  drawTrials,
  drawBounties,
  drawMilestones,
  type ActivitiesSectionsCtx,
} from "./activitiesSections.ts";

const W = 960;

export class ActivitiesScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private scrollY = 0;
  private contentH = 0;

  constructor() {
    super("ActivitiesScene");
  }

  create(): void {
    fadeIn(this);
    this.scrollY = 0;
    this.contentH = 0; // reset on scene re-entry (Phaser reuses instances)
    this.mgr = this.registry.get("saveManager");
    const today = new Date().toISOString().slice(0, 10);
    const week = isoWeekKey(new Date());
    this.mgr.refreshBounties(week);
    this.mgr.ensureChallenge(today);

    crispText(this, W / 2, 10, "✦ Activities", {
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
    this.toast = crispText(this, W / 2, 520, "", {
      fontSize: "13px",
      color: "#ffe1a8",
      backgroundColor: "#2a1f14",
    })
      .setOrigin(0.5)
      .setPadding(10, 5, 10, 5)
      .setDepth(60)
      .setVisible(false);

    // Mouse-wheel scroll for the (taller-than-screen) content.
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, -(this.contentH - 460), 0);
      this.layer.y = this.scrollY;
    });

    this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.layer.y = this.scrollY;
    let y = 44;
    y = this.drawProfile(y);
    y = this.drawStreak(y);
    y = this.drawSpin(y);
    y = this.drawExpedition(y);
    const ctx = this.sectionCtx();
    y = drawTrials(ctx, y);
    y = drawBounties(ctx, y);
    y = drawMilestones(ctx, y);
    this.contentH = y + 20;
  }

  /** The callbacks the extracted section renderers (activitiesSections.ts) need. */
  private sectionCtx(): ActivitiesSectionsCtx {
    return {
      scene: this,
      mgr: this.mgr,
      layer: this.layer,
      panel: (y, h, accent, hot) => this.panel(y, h, accent, hot),
      button: (x, y, label, color, enabled, cb) => this.button(x, y, label, color, enabled, cb),
      celebrate: (y, emojis, label, accent) => this.celebrate(y, emojis, label, accent),
      showToast: (msg) => this.showToast(msg),
      redraw: () => this.redraw(),
      launch: (stageId, difficulty, mode) => this.launch(stageId, difficulty, mode),
      latestClearedStage: () => this.latestClearedStage(),
    };
  }

  // ── panels ──────────────────────────────────────────────────────────────────
  private panel(y: number, h: number, accent: number, hot = false): void {
    this.layer.add(accentPanel(this, PANEL_X, y, PANEL_W, h, accent, hot));
  }

  private button(
    x: number,
    y: number,
    label: string,
    color: string,
    enabled: boolean,
    cb: () => void,
  ): void {
    const btn = actionChip(this, x, y, label, color, enabled, cb);
    this.layer.add(btn);
    if (!enabled) return;
    this.tweens.add({
      targets: btn,
      scale: 1.05,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private drawProfile(y: number): number {
    const sum = this.mgr.profileSummary();
    const save = this.mgr.getSave();
    const h = 64;
    this.panel(y, h, 0x33405a);
    const title = sum.title ? `  ·  "${sum.title}"` : "";
    this.layer.add(
      crispText(this, PANEL_X + 16, y + 10, `Hero Lv ${sum.heroLevel}${title}`, {
        fontSize: "16px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(
        this,
        PANEL_X + 16,
        y + 34,
        `⚔ Power ${sum.power}   ·   📚 Codex ${Math.round(sum.collectionPct * 100)}%   ·   🌊 Best Wave ${sum.bestEndlessWave}   ·   💀 ${sum.lifetimeKills} kills`,
        { fontSize: "12px", color: "#9fc0e6" },
      ),
    );
    this.layer.add(
      crispText(
        this,
        PANEL_X + PANEL_W - 16,
        y + 10,
        `🪙 ${save.currency.gold}   💎 ${save.currency.diamonds}`,
        { fontSize: "13px", color: "#ffe07a" },
      ).setOrigin(1, 0),
    );
    return y + h + 12;
  }

  private drawStreak(y: number): number {
    const today = new Date().toISOString().slice(0, 10);
    const save = this.mgr.getSave();
    const ready = streakClaimable(save, today);
    const h = 70;
    this.panel(y, h, 0x33405a, ready);
    this.layer.add(
      crispText(
        this,
        PANEL_X + 16,
        y + 10,
        `🔥 Login Streak — ${save.meta.streak.count} day${save.meta.streak.count === 1 ? "" : "s"} (best ${save.meta.streak.best})`,
        { fontSize: "16px", color: "#ffe9b0", fontStyle: "bold" },
      ),
    );
    const next = nextStreakReward(save, today);
    this.layer.add(
      crispText(
        this,
        PANEL_X + 16,
        y + 34,
        ready
          ? `Today's reward: ${rewardLabel(next)}`
          : "Come back tomorrow to keep the chain alive.",
        { fontSize: "12px", color: ready ? "#ffd56a" : "#9fb0c4" },
      ),
    );
    // 7-day cycle pips.
    const pipY = y + 54;
    STREAK_CYCLE.forEach((_, i) => {
      const on =
        (save.meta.streak.count % 7 || 7) > i && !ready ? true : save.meta.streak.count % 7 > i;
      const px = PANEL_X + 16 + i * 22;
      const g = this.add.graphics();
      g.fillStyle(on ? 0xffc94d : 0x33405a, 1).fillCircle(px, pipY, 6);
      this.layer.add(g);
    });
    this.button(
      PANEL_X + PANEL_W - 16,
      y + h / 2,
      ready ? "Claim" : "Claimed",
      "#1f8f43",
      ready,
      () => {
        const claim = this.mgr.claimStreak(today);
        if (claim) {
          this.celebrate(
            y + h / 2,
            ["🔥", ...rewardEmojis(claim.reward)],
            `Day ${claim.count}!`,
            0xff8a3d,
          );
          this.showToast(`Day ${claim.count}! ${rewardLabel(claim.reward)}`);
          this.redraw();
        }
      },
    );
    return y + h + 12;
  }

  private drawSpin(y: number): number {
    const today = new Date().toISOString().slice(0, 10);
    const save = this.mgr.getSave();
    const free = freeSpinAvailable(save, today);
    const h = 58;
    this.panel(y, h, 0x33405a, free);
    this.layer.add(
      crispText(this, PANEL_X + 16, y + 10, "🎡 Lucky Spin", {
        fontSize: "16px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(
        this,
        PANEL_X + 16,
        y + 32,
        free
          ? "Your free daily spin is ready!"
          : `Free spin used. Extra spin: ${PAID_SPIN_COST} 💎`,
        { fontSize: "12px", color: free ? "#ffd56a" : "#9fb0c4" },
      ),
    );
    this.button(
      PANEL_X + PANEL_W - 16,
      y + h / 2,
      free ? "Free Spin" : `Spin (${PAID_SPIN_COST}💎)`,
      free ? "#1f8f43" : "#7a5a1a",
      free || save.currency.diamonds >= PAID_SPIN_COST,
      () => {
        const res = free ? this.mgr.spinFree(today) : this.mgr.spinPaid(today);
        if (res) {
          const rare = res.prize.rare || res.pityTriggered;
          const accent = rare ? 0xff5bd0 : 0xffd24d;
          // Suspense first: the reel scrolls and lands on the prize, then the
          // celebration bursts from where it landed (screen centre).
          playSpinReel(this, res.prize, rare, () => {
            rewardBurst(this, this.scale.width / 2, this.scale.height / 2, {
              emojis: ["🎉", "✨", ...rewardEmojis(res.prize.reward)],
              label: res.prize.label,
              accent,
            });
            this.showToast(`🎉 ${res.prize.label}${res.pityTriggered ? " (lucky!)" : ""}`);
            this.redraw();
          });
        }
      },
    );
    return y + h + 12;
  }

  private drawExpedition(y: number): number {
    const now = Date.now();
    const save = this.mgr.getSave();
    const active = expeditionActive(save);
    const pending = expeditionPendingGold(save, now);
    const canCollect = this.mgr.expeditionCanCollect(now);
    const rate = this.mgr.expeditionGoldPerHour();
    const h = 72;
    this.panel(y, h, 0x33405a, canCollect && pending > 0);
    this.layer.add(
      crispText(this, PANEL_X + 16, y + 8, "🧭 Expedition", {
        fontSize: "16px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    if (active) {
      this.layer.add(
        crispText(
          this,
          PANEL_X + 16,
          y + 30,
          `Party of ${save.meta.expedition.towerIds.length}  ·  earning ${rate} 🪙/hr (rarity + ★ scaled)`,
          { fontSize: "12px", color: "#9fc0e6" },
        ),
      );
      // Second line: pending haul + collect-readiness (15-min minimum).
      const readyNote = canCollect
        ? `${pending} 🪙 ready to collect`
        : `${pending} 🪙 gathered · collectable in ${this.minutesUntil(this.mgr.expeditionCollectReadyAt(), now)}`;
      this.layer.add(
        crispText(this, PANEL_X + 16, y + 50, `${readyNote}  ·  caps at 8h`, {
          fontSize: "12px",
          color: canCollect ? "#ffd56a" : "#9fb0c4",
        }),
      );
      // Re-party link (left of the Collect button).
      this.linkText(PANEL_X + PANEL_W - 130, y + h / 2, "Re-party ›", () =>
        fadeToScene(this, "ExpeditionScene"),
      );
      this.button(
        PANEL_X + PANEL_W - 16,
        y + h / 2,
        "Collect",
        "#1f8f43",
        canCollect && pending > 0,
        () => {
          const r = this.mgr.collectExpedition();
          const label = rewardLabel(r);
          if (label) this.celebrate(y + h / 2, rewardEmojis(r), label, 0x7fd0ff);
          this.showToast(`Expedition: ${label || "nothing yet"}`);
          this.redraw();
        },
      );
    } else {
      this.layer.add(
        crispText(
          this,
          PANEL_X + 16,
          y + 32,
          "Send up to 3 spare heroes (not in your battle squad) to gather gold while you're away.",
          { fontSize: "12px", color: "#9fb0c4" },
        ),
      );
      this.button(
        PANEL_X + PANEL_W - 16,
        y + h / 2,
        "Choose Heroes ›",
        "#3a6a9a",
        this.mgr.expeditionEligibleTowerIds().length > 0,
        () => fadeToScene(this, "ExpeditionScene"),
      );
    }
    return y + h + 12;
  }

  /** A small inline text link (left-aligned button without a chip background). */
  private linkText(x: number, y: number, label: string, cb: () => void): void {
    const t = crispText(this, x, y, label, { fontSize: "12px", color: "#9fd0ff" })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    t.on("pointerover", () => t.setColor("#cfe9ff"));
    t.on("pointerout", () => t.setColor("#9fd0ff"));
    t.on("pointerup", cb);
    this.layer.add(t);
  }

  /** Human-readable "Nm" / "<1m" until the given epoch ms. */
  private minutesUntil(targetMs: number, now: number): string {
    const m = Math.ceil((targetMs - now) / 60000);
    return m <= 1 ? "<1m" : `${m}m`;
  }

  /** Highest-index stage the player has cleared on any difficulty (null if none). */
  private latestClearedStage(): { id: string; idx: number } | null {
    const save = this.mgr.getSave();
    let best: { id: string; idx: number } | null = null;
    STAGES.forEach((st, i) => {
      const rec = save.progress.stageClearMap[st.id];
      if (rec && (rec.Normal || rec.Hard || rec.Nightmare)) best = { id: st.id, idx: i };
    });
    return best;
  }

  private launch(stageId: string, difficulty: Difficulty, mode: BattleMode): void {
    const stage = STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    this.registry.set("selectedStage", stage);
    this.registry.set("selectedDifficulty", difficulty);
    this.registry.set("battleMode", mode);
    fadeToScene(this, "BattleScene");
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true).setScale(0.7);
    this.tweens.add({ targets: this.toast, scale: 1, duration: 220, ease: "Back.easeOut" });
    this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }

  /**
   * Fire the claim celebration next to a panel's claim button. `localCenterY` is
   * the button's y in layer space; we add scrollY to reach screen space. The
   * burst lives on the scene root, so the immediate redraw() that rebuilds the
   * panel layer leaves it untouched.
   */
  private celebrate(
    localCenterY: number,
    emojis: string[],
    label: string,
    accent = 0xffd24d,
  ): void {
    rewardBurst(this, PANEL_X + PANEL_W - 70, localCenterY + this.scrollY, {
      emojis,
      label,
      accent,
    });
  }
}
