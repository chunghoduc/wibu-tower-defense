import { Rng } from "./rng.ts";
import type { Reward } from "./rewards.ts";
import { SaveManagerCore, RESPEC_DIAMOND_COST } from "./saveManagerCore.ts";
import { getMasteryLevel, getMasteryXp } from "./mastery.ts";
import { getAwakening, canAwaken, awaken } from "./awakening.ts";
import { ensureWishlist, setWishlist, canClaimSpark, claimSpark } from "./banner.ts";
import { craftAlchemy, exchangeCopies } from "./alchemy.ts";
import {
  expeditionActive, expeditionPendingGold, startExpedition, collectExpedition,
  expeditionGoldPerHour, expeditionGoldPerHourFor, expeditionCanCollect,
  expeditionCollectReadyAt, expeditionEligibleTowerIds,
} from "./expedition.ts";
import { bestEndlessWave, recordEndlessWave, claimEndlessRun } from "./endless.ts";
import { rolloverBossRush, recordBossRushTier } from "./bossRush.ts";
import { claimableMilestoneCount, nextClaimableTier, claimMilestone, unlockedTitles } from "./milestones.ts";
import { powerRating, profileSummary, setTitle } from "./profile.ts";
import { claimStreak, streakClaimable, type StreakClaim } from "./streak.ts";
import { spin, freeSpinAvailable, PAID_SPIN_COST, type SpinResult } from "./spin.ts";
import { rolloverBounties, claimBounty, claimableBountyCount } from "./bounties.ts";
import { ensureChallenge, claimChallengeClear } from "./challenge.ts";
import type { ChallengeModifierDef } from "../data/challengeModifiers.ts";

export { RESPEC_DIAMOND_COST };

/**
 * SaveManager — the full save API. Extends SaveManagerCore (battle/summon/loadout/
 * shop/quest surface) with the "addictive features" meta methods (streak, spin,
 * bounties, challenge, mastery, awakening, banner, alchemy, expedition, endless,
 * boss rush, milestones, profile). Split across two files to keep each focused.
 */
export class SaveManager extends SaveManagerCore {
  // ── F6 Tower mastery (read-only; XP is earned in battle) ───────────────────
  masteryLevel(towerId: string): number { return getMasteryLevel(this.save, towerId); }
  masteryXp(towerId: string): number { return getMasteryXp(this.save, towerId); }

  // ── F7 Awakening ───────────────────────────────────────────────────────────
  awakeningRank(towerId: string): number { return getAwakening(this.save, towerId); }
  canAwaken(towerId: string): ReturnType<typeof canAwaken> { return canAwaken(this.save, towerId); }
  /** Awaken a 5★ tower one rank (spends Awakening Crystals). Returns new rank or -1. */
  awaken(towerId: string): number {
    const rank = awaken(this.save, towerId);
    if (rank >= 0) this.persist();
    return rank;
  }

  // ── F10 Spotlight banner + spark ────────────────────────────────────────────
  sparks(): number { return this.save.meta.banner.sparks; }
  /** Roll the featured rotation forward + default the wishlist for the week. */
  ensureBanner(weekKey: string): void { ensureWishlist(this.save, weekKey); this.persist(); }
  /** Choose which featured Unique the spark guarantee targets. */
  setWishlist(towerId: string): boolean {
    const ok = setWishlist(this.save, towerId);
    if (ok) this.persist();
    return ok;
  }
  canClaimSpark(): boolean { return canClaimSpark(this.save); }
  /** Claim the spark guarantee — grant the wishlisted Unique. Returns its id or null. */
  claimSpark(): string | null {
    const id = claimSpark(this.save);
    if (id) this.persist();
    return id;
  }

  // ── F18 Alchemy / surplus exchange ──────────────────────────────────────────
  /** Craft a material recipe `times` times. Returns crafts performed. */
  craftAlchemy(recipeId: string, times = 1): number {
    const n = craftAlchemy(this.save, recipeId, times);
    if (n > 0) this.persist();
    return n;
  }
  /** Convert banked dupe copies of a tower into Awakening Crystals. Returns crystals minted. */
  exchangeCopies(towerId: string, crystals = 1): number {
    const n = exchangeCopies(this.save, towerId, crystals);
    if (n > 0) this.persist();
    return n;
  }

  // ── F15 Milestones ──────────────────────────────────────────────────────────
  claimableMilestoneCount(): number { return claimableMilestoneCount(this.save); }
  nextClaimableTier(milestoneId: string): number { return nextClaimableTier(this.save, milestoneId); }
  /** Claim the next available milestone tier. Returns the reward or null. */
  claimMilestone(milestoneId: string): Reward | null {
    const r = claimMilestone(this.save, milestoneId);
    if (r) this.persist();
    return r;
  }

  /** Total "ready to collect" badge count for the Activities hub (streak + free
   *  spin + claimable bounties + claimable milestones + collectable expedition). */
  activityBadgeCount(nowMs = Date.now()): number {
    const today = new Date(nowMs).toISOString().slice(0, 10);
    let n = 0;
    if (streakClaimable(this.save, today)) n++;
    if (freeSpinAvailable(this.save, today)) n++;
    n += claimableBountyCount(this.save);
    n += claimableMilestoneCount(this.save);
    if (expeditionCanCollect(this.save, nowMs) && expeditionPendingGold(this.save, nowMs) > 0) n++;
    return n;
  }

  // ── F16 Profile / power / titles ─────────────────────────────────────────────
  powerRating(): number { return powerRating(this.save); }
  profileSummary(): ReturnType<typeof profileSummary> { return profileSummary(this.save); }
  unlockedTitles(): string[] { return unlockedTitles(this.save); }
  /** Equip an unlocked title (or "" to clear). Returns false if locked. */
  setTitle(titleId: string): boolean {
    const ok = setTitle(this.save, titleId);
    if (ok) this.persist();
    return ok;
  }

  // ── F2 Idle expedition ──────────────────────────────────────────────────────
  expeditionActive(): boolean { return expeditionActive(this.save); }
  expeditionPendingGold(nowMs = Date.now()): number { return expeditionPendingGold(this.save, nowMs); }
  expeditionGoldPerHour(): number { return expeditionGoldPerHour(this.save); }
  expeditionGoldPerHourFor(towerIds: string[]): number { return expeditionGoldPerHourFor(this.save, towerIds); }
  expeditionCanCollect(nowMs = Date.now()): boolean { return expeditionCanCollect(this.save, nowMs); }
  expeditionCollectReadyAt(): number { return expeditionCollectReadyAt(this.save); }
  expeditionEligibleTowerIds(): string[] { return expeditionEligibleTowerIds(this.save); }
  startExpedition(towerIds: string[], nowMs = Date.now()): void {
    startExpedition(this.save, towerIds, nowMs);
    this.persist();
  }
  collectExpedition(nowMs = Date.now(), rng: Rng = new Rng((Math.random() * 1e9) | 0)): Reward {
    const r = collectExpedition(this.save, nowMs, rng);
    this.persist();
    return r;
  }

  // ── F11 Endless survival ────────────────────────────────────────────────────
  bestEndlessWave(stageId: string): number { return bestEndlessWave(this.save, stageId); }
  /** Record an endless run result; returns true on a new personal best. Persists. */
  recordEndlessWave(stageId: string, wave: number): boolean {
    const pb = recordEndlessWave(this.save, stageId, wave);
    this.persist();
    return pb;
  }
  /** Settle an endless run: grant rewards for newly-reached depth, record best. Persists. */
  claimEndlessRun(stageId: string, wavesReached: number): { reward: Reward; isBest: boolean } {
    const out = claimEndlessRun(this.save, stageId, wavesReached);
    this.persist();
    return out;
  }

  // ── F12 Boss rush (weekly) ──────────────────────────────────────────────────
  bestBossRushTier(): number { return this.save.meta.bossRush.bestTier; }
  refreshBossRush(weekKey: string): void {
    if (this.save.meta.bossRush.weekKey === weekKey) return;
    rolloverBossRush(this.save, weekKey);
    this.persist();
  }
  /** Record a boss-rush result; grants + returns any newly-earned reward. Persists. */
  recordBossRushTier(weekKey: string, tier: number): Reward {
    const r = recordBossRushTier(this.save, weekKey, tier);
    this.persist();
    return r;
  }

  // ── F1 Login streak ───────────────────────────────────────────────────────
  /** Claim today's streak reward (advances/continues/resets the chain). Null if
   *  already claimed today. */
  claimStreak(todayIso: string): StreakClaim | null {
    const claim = claimStreak(this.save, todayIso);
    if (claim) this.persist();
    return claim;
  }
  streakClaimable(todayIso: string): boolean { return streakClaimable(this.save, todayIso); }

  // ── F4 Lucky spin ─────────────────────────────────────────────────────────
  freeSpinAvailable(todayIso: string): boolean { return freeSpinAvailable(this.save, todayIso); }
  /** Spin the daily free wheel. Null if today's free spin is already used. */
  spinFree(todayIso: string, rng: Rng = new Rng((Math.random() * 1e9) | 0)): SpinResult | null {
    if (!freeSpinAvailable(this.save, todayIso)) return null;
    const r = spin(this.save, todayIso, rng, true);
    this.persist();
    return r;
  }
  /** Spin a paid wheel (costs PAID_SPIN_COST diamonds). Null if too poor. */
  spinPaid(todayIso: string, rng: Rng = new Rng((Math.random() * 1e9) | 0)): SpinResult | null {
    if (this.save.currency.diamonds < PAID_SPIN_COST) return null;
    this.save.currency.diamonds -= PAID_SPIN_COST;
    const r = spin(this.save, todayIso, rng, false);
    this.persist();
    return r;
  }

  // ── F3 Weekly bounties ────────────────────────────────────────────────────
  /** Roll bounties to the current ISO week if needed, then persist. */
  refreshBounties(weekKey: string): void {
    if (this.save.meta.bounties.weekKey === weekKey) return;
    rolloverBounties(this.save, weekKey);
    this.persist();
  }
  /** Claim one completed weekly bounty. */
  claimBounty(bountyId: string): boolean {
    const ok = claimBounty(this.save, bountyId);
    if (ok) this.persist();
    return ok;
  }

  // ── F5 Daily challenge ────────────────────────────────────────────────────
  /** Ensure today's challenge modifier is rolled; returns it. Persists on change. */
  ensureChallenge(todayIso: string): ChallengeModifierDef {
    const before = this.save.meta.challenge.dayKey;
    const def = ensureChallenge(this.save, todayIso);
    if (before !== todayIso) this.persist();
    return def;
  }
  /** Claim the daily-challenge clear bonus. Null if already claimed today. */
  claimChallengeClear(todayIso: string): Reward | null {
    const r = claimChallengeClear(this.save, todayIso);
    if (r) this.persist();
    return r;
  }
}
