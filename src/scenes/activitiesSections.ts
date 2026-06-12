/**
 * activitiesSections — the Trials (daily challenge / endless / boss rush),
 * Weekly Bounties, and Milestones sections of the Activities hub. Pure
 * presenters: each draws into the scene's scroll layer via the ctx callbacks
 * (panel/button/celebrate/…) owned by ActivitiesScene and returns the next y.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { rewardLabel } from "../core/rewards.ts";
import { rewardEmojis } from "./rewardBurst.ts";
import { WEEKLY_BOUNTIES } from "../data/bounties.ts";
import { isBountyClaimable, getBountyProgress } from "../core/bounties.ts";
import { MILESTONES } from "../data/milestones.ts";
import { metricValue, claimedTier, nextClaimableTier } from "../core/milestones.ts";
import { challengeForDay } from "../core/challenge.ts";
import { STAGES } from "../data/stage.ts";
import type { BattleMode } from "./BattleScene.ts";
import type { Difficulty } from "../data/schema.ts";

export const PANEL_X = 24;
export const PANEL_W = 960 - 48;

/** Everything the section renderers need from ActivitiesScene. */
export interface ActivitiesSectionsCtx {
  scene: Phaser.Scene;
  mgr: SaveManager;
  layer: Phaser.GameObjects.Container;
  panel(y: number, h: number, accent: number, hot?: boolean): void;
  button(
    x: number,
    y: number,
    label: string,
    color: string,
    enabled: boolean,
    cb: () => void,
  ): void;
  celebrate(localCenterY: number, emojis: string[], label: string, accent?: number): void;
  showToast(msg: string): void;
  redraw(): void;
  launch(stageId: string, difficulty: Difficulty, mode: BattleMode): void;
  latestClearedStage(): { id: string; idx: number } | null;
}

export function drawTrials(ctx: ActivitiesSectionsCtx, y: number): number {
  const save = ctx.mgr.getSave();
  const today = new Date().toISOString().slice(0, 10);
  const cleared = ctx.latestClearedStage();
  ctx.layer.add(
    crispText(ctx.scene, PANEL_X + 4, y, "Trials", {
      fontSize: "15px",
      color: "#ffd56a",
      fontStyle: "bold",
    }),
  );
  y += 24;

  // F5 Daily Challenge.
  const ch = challengeForDay(today);
  const chDone = save.meta.challenge.dayKey === today && save.meta.challenge.cleared;
  {
    const h = 56;
    ctx.panel(y, h, 0x2c3a4f, !chDone);
    ctx.layer.add(
      crispText(ctx.scene, PANEL_X + 14, y + 8, `⚡ Daily Challenge — ${ch.name}`, {
        fontSize: "14px",
        color: chDone ? "#8fc7a0" : "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    ctx.layer.add(
      crispText(
        ctx.scene,
        PANEL_X + 14,
        y + 28,
        `${ch.description}  →  ${rewardLabel(ch.reward)}`,
        {
          fontSize: "11px",
          color: "#aab8cc",
          wordWrap: { width: PANEL_W - 130 },
        },
      ),
    );
    const stageId = cleared?.id ?? STAGES[0].id;
    ctx.button(
      PANEL_X + PANEL_W - 14,
      y + h / 2,
      chDone ? "Cleared" : "Play",
      "#9a6a1f",
      !chDone,
      () => ctx.launch(stageId, "Hard", { kind: "challenge", challenge: ch.effects }),
    );
    y += h + 8;
  }

  // F11 Endless Survival (needs a cleared stage).
  {
    const h = 56;
    const best = cleared ? ctx.mgr.bestEndlessWave(cleared.id) : 0;
    const cost = cleared ? ctx.mgr.endlessEntryCost(cleared.id) : 0;
    const canPay = !!cleared && save.currency.gold >= cost;
    ctx.panel(y, h, 0x2c3a4f);
    ctx.layer.add(
      crispText(ctx.scene, PANEL_X + 14, y + 8, "🌊 Endless Survival", {
        fontSize: "14px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    ctx.layer.add(
      crispText(
        ctx.scene,
        PANEL_X + 14,
        y + 28,
        cleared
          ? `Waves never stop — boss every 10. Best wave: ${best}. · Entry 🪙${cost}`
          : "Clear a stage first to unlock.",
        { fontSize: "11px", color: "#aab8cc" },
      ),
    );
    ctx.button(
      PANEL_X + PANEL_W - 14,
      y + h / 2,
      cleared ? `Play 🪙${cost}` : "Play",
      "#3a6a9a",
      canPay,
      () => {
        if (!cleared) return;
        const paid = ctx.mgr.payEndlessEntry(cleared.id);
        if (paid < 0) {
          ctx.showToast(`Need 🪙${cost} gold to enter`);
          return;
        }
        ctx.launch(cleared.id, "Nightmare", { kind: "endless" });
      },
    );
    y += h + 8;
  }

  // F12 Boss Rush (weekly).
  {
    const h = 56;
    const tier = ctx.mgr.bestBossRushTier();
    ctx.panel(y, h, 0x2c3a4f);
    ctx.layer.add(
      crispText(ctx.scene, PANEL_X + 14, y + 8, "👹 Boss Rush — Weekly", {
        fontSize: "14px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    ctx.layer.add(
      crispText(
        ctx.scene,
        PANEL_X + 14,
        y + 28,
        cleared
          ? `Push as deep as you can. Best tier this week: ${tier}.`
          : "Clear a stage first to unlock.",
        { fontSize: "11px", color: "#aab8cc" },
      ),
    );
    ctx.button(
      PANEL_X + PANEL_W - 14,
      y + h / 2,
      "Play",
      "#8a3a3a",
      !!cleared,
      () => cleared && ctx.launch(cleared.id, "Nightmare", { kind: "bossrush", endlessMul: 1.5 }),
    );
    y += h + 8;
  }
  return y + 6;
}

export function drawBounties(ctx: ActivitiesSectionsCtx, y: number): number {
  const save = ctx.mgr.getSave();
  ctx.layer.add(
    crispText(ctx.scene, PANEL_X + 4, y, "Weekly Bounties", {
      fontSize: "15px",
      color: "#ffd56a",
      fontStyle: "bold",
    }),
  );
  y += 24;
  for (const def of WEEKLY_BOUNTIES) {
    const prog = getBountyProgress(save, def.id);
    const claimable = isBountyClaimable(save, def.id);
    const claimed = save.meta.bounties.claimed.includes(def.id);
    const h = 52;
    ctx.panel(y, h, claimed ? 0x3a6b4a : 0x2c3a4f, claimable);
    ctx.layer.add(
      crispText(ctx.scene, PANEL_X + 14, y + 8, def.label, {
        fontSize: "14px",
        color: claimed ? "#8fc7a0" : "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    ctx.layer.add(
      crispText(
        ctx.scene,
        PANEL_X + 14,
        y + 28,
        `${def.description}   (${Math.min(prog, def.target)}/${def.target})  →  ${rewardLabel(def.reward)}`,
        { fontSize: "11px", color: "#aab8cc" },
      ),
    );
    ctx.button(
      PANEL_X + PANEL_W - 14,
      y + h / 2,
      claimed ? "✓" : "Claim",
      "#1f8f43",
      claimable,
      () => {
        if (ctx.mgr.claimBounty(def.id)) {
          ctx.celebrate(y + h / 2, rewardEmojis(def.reward), rewardLabel(def.reward), 0x6fe08a);
          ctx.showToast(`Bounty: ${rewardLabel(def.reward)}`);
          ctx.redraw();
        }
      },
    );
    y += h + 8;
  }
  return y + 6;
}

export function drawMilestones(ctx: ActivitiesSectionsCtx, y: number): number {
  const save = ctx.mgr.getSave();
  ctx.layer.add(
    crispText(ctx.scene, PANEL_X + 4, y, "Milestones", {
      fontSize: "15px",
      color: "#ffd56a",
      fontStyle: "bold",
    }),
  );
  y += 24;
  for (const def of MILESTONES) {
    const tierIdx = claimedTier(save, def.id);
    const value = metricValue(save, def.metric);
    const nextTier = def.tiers[Math.min(tierIdx, def.tiers.length - 1)];
    const claimable = nextClaimableTier(save, def.id) > 0;
    const maxed = tierIdx >= def.tiers.length;
    const h = 52;
    ctx.panel(y, h, maxed ? 0x3a6b4a : 0x2c3a4f, claimable);
    ctx.layer.add(
      crispText(
        ctx.scene,
        PANEL_X + 14,
        y + 8,
        `${def.name}  ${"★".repeat(tierIdx)}${"☆".repeat(def.tiers.length - tierIdx)}`,
        { fontSize: "14px", color: maxed ? "#8fc7a0" : "#ffe9b0", fontStyle: "bold" },
      ),
    );
    const goalTxt = maxed
      ? "Fully complete!"
      : `${def.description}  (${value}/${nextTier.target})  →  ${rewardLabel(nextTier.reward)}${nextTier.title ? `  ·  Title "${nextTier.title}"` : ""}`;
    ctx.layer.add(
      crispText(ctx.scene, PANEL_X + 14, y + 28, goalTxt, {
        fontSize: "11px",
        color: "#aab8cc",
        wordWrap: { width: PANEL_W - 120 },
      }),
    );
    ctx.button(
      PANEL_X + PANEL_W - 14,
      y + h / 2,
      maxed ? "✓" : "Claim",
      "#1f8f43",
      claimable,
      () => {
        const r = ctx.mgr.claimMilestone(def.id);
        if (r) {
          ctx.celebrate(y + h / 2, ["⭐", "✨", ...rewardEmojis(r)], rewardLabel(r), 0xffd24d);
          ctx.showToast(`Milestone: ${rewardLabel(r)}`);
          ctx.redraw();
        }
      },
    );
    y += h + 8;
  }
  return y + 6;
}
