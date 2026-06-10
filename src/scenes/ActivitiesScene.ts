/**
 * ActivitiesScene — the engagement hub for the addictive-features suite. One
 * place to claim the daily login streak (F1), spin the lucky wheel (F4), manage
 * the idle expedition (F2), collect weekly bounties (F3) and tiered milestones
 * (F15), and read the profile / Power Rating (F16). Scrolls vertically.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { rewardLabel } from "../core/rewards.ts";
import { rewardBurst, rewardEmojis } from "./rewardBurst.ts";
import { nextStreakReward, streakClaimable, STREAK_CYCLE } from "../core/streak.ts";
import { freeSpinAvailable, PAID_SPIN_COST } from "../core/spin.ts";
import { expeditionActive, expeditionPendingGold } from "../core/expedition.ts";
import { WEEKLY_BOUNTIES } from "../data/bounties.ts";
import { isBountyClaimable, getBountyProgress } from "../core/bounties.ts";
import { MILESTONES } from "../data/milestones.ts";
import { metricValue, claimedTier, nextClaimableTier } from "../core/milestones.ts";
import { isoWeekKey } from "../core/meta.ts";
import { challengeForDay } from "../core/challenge.ts";
import { endlessEnemyMul } from "../core/endless.ts";
import { STAGES } from "../data/stage.ts";
import type { BattleMode } from "./BattleScene.ts";
import type { Difficulty } from "../data/schema.ts";

const W = 960;
const PANEL_X = 24, PANEL_W = W - 48;

export class ActivitiesScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private scrollY = 0;
  private contentH = 0;

  constructor() { super("ActivitiesScene"); }

  create(): void {
    fadeIn(this);
    this.scrollY = 0; this.contentH = 0; // reset on scene re-entry (Phaser reuses instances)
    this.mgr = this.registry.get("saveManager");
    const today = new Date().toISOString().slice(0, 10);
    const week = isoWeekKey(new Date());
    this.mgr.refreshBounties(week);
    this.mgr.ensureChallenge(today);

    crispText(this, W / 2, 10, "✦ Activities", { fontSize: "24px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0).setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" }).setDepth(50)
      .setInteractive({ useHandCursor: true }).on("pointerup", () => fadeToScene(this, "MainMenuScene"));

    this.layer = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 520, "", { fontSize: "13px", color: "#ffe1a8", backgroundColor: "#2a1f14" })
      .setOrigin(0.5).setPadding(10, 5, 10, 5).setDepth(60).setVisible(false);

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
    y = this.drawTrials(y);
    y = this.drawBounties(y);
    y = this.drawMilestones(y);
    this.contentH = y + 20;
  }

  // ── panels ──────────────────────────────────────────────────────────────────
  private panel(y: number, h: number, accent: number, hot = false): void {
    const g = this.add.graphics();
    g.fillStyle(hot ? 0x22180c : 0x141b26, 1).fillRoundedRect(PANEL_X, y, PANEL_W, h, 12);
    g.lineStyle(2, hot ? 0xffc94d : accent, 1).strokeRoundedRect(PANEL_X, y, PANEL_W, h, 12);
    this.layer.add(g);
  }

  private button(x: number, y: number, label: string, color: string, enabled: boolean, cb: () => void): void {
    if (!enabled) {
      this.layer.add(crispText(this, x, y, label, { fontSize: "13px", color: "#6b7a8d" }).setOrigin(1, 0.5));
      return;
    }
    const btn = crispText(this, x, y, label, { fontSize: "14px", color: "#ffffff", backgroundColor: color, fontStyle: "bold" })
      .setOrigin(1, 0.5).setPadding(14, 6, 14, 6).setInteractive({ useHandCursor: true });
    btn.on("pointerup", cb);
    this.layer.add(btn);
    this.tweens.add({ targets: btn, scale: 1.05, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private drawProfile(y: number): number {
    const sum = this.mgr.profileSummary();
    const save = this.mgr.getSave();
    const h = 64;
    this.panel(y, h, 0x33405a);
    const title = sum.title ? `  ·  "${sum.title}"` : "";
    this.layer.add(crispText(this, PANEL_X + 16, y + 10, `Hero Lv ${sum.heroLevel}${title}`, { fontSize: "16px", color: "#ffe9b0", fontStyle: "bold" }));
    this.layer.add(crispText(this, PANEL_X + 16, y + 34,
      `⚔ Power ${sum.power}   ·   📚 Codex ${Math.round(sum.collectionPct * 100)}%   ·   🌊 Best Wave ${sum.bestEndlessWave}   ·   💀 ${sum.lifetimeKills} kills`,
      { fontSize: "12px", color: "#9fc0e6" }));
    this.layer.add(crispText(this, PANEL_X + PANEL_W - 16, y + 10, `🪙 ${save.currency.gold}   💎 ${save.currency.diamonds}`, { fontSize: "13px", color: "#ffe07a" }).setOrigin(1, 0));
    return y + h + 12;
  }

  private drawStreak(y: number): number {
    const today = new Date().toISOString().slice(0, 10);
    const save = this.mgr.getSave();
    const ready = streakClaimable(save, today);
    const h = 70;
    this.panel(y, h, 0x33405a, ready);
    this.layer.add(crispText(this, PANEL_X + 16, y + 10, `🔥 Login Streak — ${save.meta.streak.count} day${save.meta.streak.count === 1 ? "" : "s"} (best ${save.meta.streak.best})`, { fontSize: "16px", color: "#ffe9b0", fontStyle: "bold" }));
    const next = nextStreakReward(save, today);
    this.layer.add(crispText(this, PANEL_X + 16, y + 34, ready ? `Today's reward: ${rewardLabel(next)}` : "Come back tomorrow to keep the chain alive.", { fontSize: "12px", color: ready ? "#ffd56a" : "#9fb0c4" }));
    // 7-day cycle pips.
    const pipY = y + 54;
    STREAK_CYCLE.forEach((_, i) => {
      const on = (save.meta.streak.count % 7 || 7) > i && !ready ? true : (save.meta.streak.count % 7) > i;
      const px = PANEL_X + 16 + i * 22;
      const g = this.add.graphics();
      g.fillStyle(on ? 0xffc94d : 0x33405a, 1).fillCircle(px, pipY, 6);
      this.layer.add(g);
    });
    this.button(PANEL_X + PANEL_W - 16, y + h / 2, ready ? "Claim" : "Claimed", "#1f8f43", ready, () => {
      const claim = this.mgr.claimStreak(today);
      if (claim) {
        this.celebrate(y + h / 2, ["🔥", ...rewardEmojis(claim.reward)], `Day ${claim.count}!`, 0xff8a3d);
        this.showToast(`Day ${claim.count}! ${rewardLabel(claim.reward)}`); this.redraw();
      }
    });
    return y + h + 12;
  }

  private drawSpin(y: number): number {
    const today = new Date().toISOString().slice(0, 10);
    const save = this.mgr.getSave();
    const free = freeSpinAvailable(save, today);
    const h = 58;
    this.panel(y, h, 0x33405a, free);
    this.layer.add(crispText(this, PANEL_X + 16, y + 10, "🎡 Lucky Spin", { fontSize: "16px", color: "#ffe9b0", fontStyle: "bold" }));
    this.layer.add(crispText(this, PANEL_X + 16, y + 32, free ? "Your free daily spin is ready!" : `Free spin used. Extra spin: ${PAID_SPIN_COST} 💎`, { fontSize: "12px", color: free ? "#ffd56a" : "#9fb0c4" }));
    this.button(PANEL_X + PANEL_W - 16, y + h / 2, free ? "Free Spin" : `Spin (${PAID_SPIN_COST}💎)`, free ? "#1f8f43" : "#7a5a1a",
      free || save.currency.diamonds >= PAID_SPIN_COST, () => {
        const res = free ? this.mgr.spinFree(today) : this.mgr.spinPaid(today);
        if (res) {
          const rare = res.prize.rare || res.pityTriggered;
          this.celebrate(y + h / 2, ["🎉", "✨", ...rewardEmojis(res.prize.reward)], res.prize.label,
            rare ? 0xff5bd0 : 0xffd24d);
          this.showToast(`🎉 ${res.prize.label}${res.pityTriggered ? " (lucky!)" : ""}`); this.redraw();
        }
      });
    return y + h + 12;
  }

  private drawExpedition(y: number): number {
    const save = this.mgr.getSave();
    const active = expeditionActive(save);
    const pending = expeditionPendingGold(save, Date.now());
    const h = 64;
    this.panel(y, h, 0x33405a, active && pending > 0);
    this.layer.add(crispText(this, PANEL_X + 16, y + 10, "🧭 Expedition", { fontSize: "16px", color: "#ffe9b0", fontStyle: "bold" }));
    this.layer.add(crispText(this, PANEL_X + 16, y + 34,
      active ? `Party of ${save.meta.expedition.towerIds.length} · ${pending} 🪙 waiting (caps at 8h)` : "Send up to 3 heroes to gather gold while you're away.",
      { fontSize: "12px", color: active ? "#ffd56a" : "#9fb0c4" }));
    if (active) {
      this.button(PANEL_X + PANEL_W - 16, y + h / 2, "Collect", "#1f8f43", pending > 0, () => {
        const r = this.mgr.collectExpedition();
        const label = rewardLabel(r);
        if (label) this.celebrate(y + h / 2, rewardEmojis(r), label, 0x7fd0ff);
        this.showToast(`Expedition: ${label || "nothing yet"}`); this.redraw();
      });
    } else {
      this.button(PANEL_X + PANEL_W - 16, y + h / 2, "Dispatch", "#3a6a9a", Object.keys(save.collection).length > 0, () => {
        const party = (save.squad?.length ? save.squad : Object.keys(save.collection)).slice(0, 3);
        this.mgr.startExpedition(party);
        this.showToast(`Dispatched ${party.length} heroes!`); this.redraw();
      });
    }
    return y + h + 12;
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

  private drawTrials(y: number): number {
    const save = this.mgr.getSave();
    const today = new Date().toISOString().slice(0, 10);
    const cleared = this.latestClearedStage();
    this.layer.add(crispText(this, PANEL_X + 4, y, "Trials", { fontSize: "15px", color: "#ffd56a", fontStyle: "bold" }));
    y += 24;

    // F5 Daily Challenge.
    const ch = challengeForDay(today);
    const chDone = save.meta.challenge.dayKey === today && save.meta.challenge.cleared;
    {
      const h = 56;
      this.panel(y, h, 0x2c3a4f, !chDone);
      this.layer.add(crispText(this, PANEL_X + 14, y + 8, `⚡ Daily Challenge — ${ch.name}`, { fontSize: "14px", color: chDone ? "#8fc7a0" : "#ffe9b0", fontStyle: "bold" }));
      this.layer.add(crispText(this, PANEL_X + 14, y + 28, `${ch.description}  →  ${rewardLabel(ch.reward)}`, { fontSize: "11px", color: "#aab8cc", wordWrap: { width: PANEL_W - 130 } }));
      const stageId = cleared?.id ?? STAGES[0].id;
      this.button(PANEL_X + PANEL_W - 14, y + h / 2, chDone ? "Cleared" : "Play", "#9a6a1f", !chDone,
        () => this.launch(stageId, "Hard", { kind: "challenge", challenge: ch.effects }));
      y += h + 8;
    }

    // F11 Endless Survival (needs a cleared stage).
    {
      const h = 56;
      const best = cleared ? this.mgr.bestEndlessWave(cleared.id) : 0;
      this.panel(y, h, 0x2c3a4f);
      this.layer.add(crispText(this, PANEL_X + 14, y + 8, "🌊 Endless Survival", { fontSize: "14px", color: "#ffe9b0", fontStyle: "bold" }));
      this.layer.add(crispText(this, PANEL_X + 14, y + 28, cleared ? `Survive escalating waves. Best wave: ${best}.` : "Clear a stage first to unlock.", { fontSize: "11px", color: "#aab8cc" }));
      this.button(PANEL_X + PANEL_W - 14, y + h / 2, "Play", "#3a6a9a", !!cleared,
        () => cleared && this.launch(cleared.id, "Nightmare", { kind: "endless", endlessMul: endlessEnemyMul(best + 1) }));
      y += h + 8;
    }

    // F12 Boss Rush (weekly).
    {
      const h = 56;
      const tier = this.mgr.bestBossRushTier();
      this.panel(y, h, 0x2c3a4f);
      this.layer.add(crispText(this, PANEL_X + 14, y + 8, "👹 Boss Rush — Weekly", { fontSize: "14px", color: "#ffe9b0", fontStyle: "bold" }));
      this.layer.add(crispText(this, PANEL_X + 14, y + 28, cleared ? `Push as deep as you can. Best tier this week: ${tier}.` : "Clear a stage first to unlock.", { fontSize: "11px", color: "#aab8cc" }));
      this.button(PANEL_X + PANEL_W - 14, y + h / 2, "Play", "#8a3a3a", !!cleared,
        () => cleared && this.launch(cleared.id, "Nightmare", { kind: "bossrush", endlessMul: 1.5 }));
      y += h + 8;
    }
    return y + 6;
  }

  private drawBounties(y: number): number {
    const save = this.mgr.getSave();
    this.layer.add(crispText(this, PANEL_X + 4, y, "Weekly Bounties", { fontSize: "15px", color: "#ffd56a", fontStyle: "bold" }));
    y += 24;
    for (const def of WEEKLY_BOUNTIES) {
      const prog = getBountyProgress(save, def.id);
      const claimable = isBountyClaimable(save, def.id);
      const claimed = save.meta.bounties.claimed.includes(def.id);
      const h = 52;
      this.panel(y, h, claimed ? 0x3a6b4a : 0x2c3a4f, claimable);
      this.layer.add(crispText(this, PANEL_X + 14, y + 8, def.label, { fontSize: "14px", color: claimed ? "#8fc7a0" : "#ffe9b0", fontStyle: "bold" }));
      this.layer.add(crispText(this, PANEL_X + 14, y + 28, `${def.description}   (${Math.min(prog, def.target)}/${def.target})  →  ${rewardLabel(def.reward)}`, { fontSize: "11px", color: "#aab8cc" }));
      this.button(PANEL_X + PANEL_W - 14, y + h / 2, claimed ? "✓" : "Claim", "#1f8f43", claimable, () => {
        if (this.mgr.claimBounty(def.id)) {
          this.celebrate(y + h / 2, rewardEmojis(def.reward), rewardLabel(def.reward), 0x6fe08a);
          this.showToast(`Bounty: ${rewardLabel(def.reward)}`); this.redraw();
        }
      });
      y += h + 8;
    }
    return y + 6;
  }

  private drawMilestones(y: number): number {
    const save = this.mgr.getSave();
    this.layer.add(crispText(this, PANEL_X + 4, y, "Milestones", { fontSize: "15px", color: "#ffd56a", fontStyle: "bold" }));
    y += 24;
    for (const def of MILESTONES) {
      const tierIdx = claimedTier(save, def.id);
      const value = metricValue(save, def.metric);
      const nextTier = def.tiers[Math.min(tierIdx, def.tiers.length - 1)];
      const claimable = nextClaimableTier(save, def.id) > 0;
      const maxed = tierIdx >= def.tiers.length;
      const h = 52;
      this.panel(y, h, maxed ? 0x3a6b4a : 0x2c3a4f, claimable);
      this.layer.add(crispText(this, PANEL_X + 14, y + 8, `${def.name}  ${"★".repeat(tierIdx)}${"☆".repeat(def.tiers.length - tierIdx)}`, { fontSize: "14px", color: maxed ? "#8fc7a0" : "#ffe9b0", fontStyle: "bold" }));
      const goalTxt = maxed ? "Fully complete!" : `${def.description}  (${value}/${nextTier.target})  →  ${rewardLabel(nextTier.reward)}${nextTier.title ? `  ·  Title "${nextTier.title}"` : ""}`;
      this.layer.add(crispText(this, PANEL_X + 14, y + 28, goalTxt, { fontSize: "11px", color: "#aab8cc", wordWrap: { width: PANEL_W - 120 } }));
      this.button(PANEL_X + PANEL_W - 14, y + h / 2, maxed ? "✓" : "Claim", "#1f8f43", claimable, () => {
        const r = this.mgr.claimMilestone(def.id);
        if (r) {
          this.celebrate(y + h / 2, ["⭐", "✨", ...rewardEmojis(r)], rewardLabel(r), 0xffd24d);
          this.showToast(`Milestone: ${rewardLabel(r)}`); this.redraw();
        }
      });
      y += h + 8;
    }
    return y + 6;
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
  private celebrate(localCenterY: number, emojis: string[], label: string, accent = 0xffd24d): void {
    rewardBurst(this, PANEL_X + PANEL_W - 70, localCenterY + this.scrollY, { emojis, label, accent });
  }
}
