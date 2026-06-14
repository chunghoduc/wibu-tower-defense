/**
 * MetaSave — the persistent state for the "addictive features" suite
 * (see docs/superpowers/specs/2026-06-09-addictive-features-design.md).
 *
 * One block on HeroSave, added in save migration v10. Each sub-object backs one
 * feature; all fields have safe defaults so a partial/old save backfills cleanly.
 * Core logic for each feature lives in its own src/core/<feature>.ts module and
 * mutates the relevant slice here.
 */
import type { QuestInstance } from "../data/expeditionQuests.ts";

/** F1 — Login streak calendar (consecutive-day cycle). */
export interface StreakSave {
  /** Current consecutive-day count (>=0). Resets to 1 on a missed day. */
  count: number;
  /** YYYY-MM-DD of the last day the streak advanced. "" = never. */
  lastClaimDate: string;
  /** Highest streak ever reached (for the 30-day milestone + profile). */
  best: number;
}

/** F2 — Expedition quest board (parallel dispatch quests). */
export interface ExpeditionSave {
  /** Active quests on the board (Available or Running). */
  quests: QuestInstance[];
  /** ISO yyyy-mm-dd of the last daily reroll of Available quests. */
  lastRerollDay: string;
  /** Monotonic counter that sources unique quest ids. */
  nextQuestSeq: number;
  /** Free board rerolls remaining today (0..REROLL_PER_DAY). */
  freeRerollsLeft: number;
  /** UTC yyyy-mm-dd the reroll counter was last reset. "" = never. */
  rerollDay: string;
}

/** F3 — Weekly bounty board. */
export interface BountiesSave {
  /** ISO week key (YYYY-Www) the current bounties belong to. */
  weekKey: string;
  /** bountyId → progress count. */
  progress: Record<string, number>;
  /** bountyIds whose reward was claimed. */
  claimed: string[];
}

/** F4 — Daily lucky spin. */
export interface SpinSave {
  /** YYYY-MM-DD of the last free spin. "" = never. */
  lastSpinDate: string;
  /** Spins since the last rare-tier (jackpot-band) result — drives spin pity. */
  pityCount: number;
}

/** F5 — Daily challenge modifier. */
export interface ChallengeSave {
  /** YYYY-MM-DD this challenge belongs to. */
  dayKey: string;
  /** Rolled modifier id for the day. */
  modifierId: string;
  /** Whether today's challenge bonus was already claimed. */
  cleared: boolean;
}

/** F6 — Tower mastery (per-tower permanent growth). */
export interface MasteryEntry {
  xp: number;
  level: number;
}

/** F10 — Spotlight banner + spark/wishlist pity. */
export interface BannerSave {
  /** Spark points (1 per pull, any source). 200 → free featured Unique pick. */
  sparks: number;
  /** ISO week key the featured rotation belongs to (rotates weekly). */
  weekKey: string;
  /** Featured character id the player wishlisted for the spark guarantee. */
  pickedFeaturedId: string;
}

/** F11 — Endless survival best wave, per stage. */
export interface EndlessSave {
  bestWave: Record<string, number>;
}

/** F12 — Weekly boss rush ranked best. */
export interface BossRushSave {
  weekKey: string;
  /** Furthest boss tier reached this week (0 = none). */
  bestTier: number;
}

/** F16 — Player profile / titles. */
export interface ProfileSave {
  /** Equipped title id ("" = none). */
  titleId: string;
  lifetimeKills: number;
  lifetimeClears: number;
}

export interface MetaSave {
  streak: StreakSave;
  expedition: ExpeditionSave;
  bounties: BountiesSave;
  spin: SpinSave;
  challenge: ChallengeSave;
  /** F6 towerId → mastery. */
  mastery: Record<string, MasteryEntry>;
  /** F7 towerId → awakening rank (0..3). */
  awakening: Record<string, number>;
  /** F9 enemy archetype → lifetime kill count. */
  bestiary: Record<string, number>;
  banner: BannerSave;
  endless: EndlessSave;
  bossRush: BossRushSave;
  /** F15 milestoneId → highest claimed tier (0 = none). */
  milestones: Record<string, number>;
  profile: ProfileSave;
}

export function defaultMeta(): MetaSave {
  return {
    streak: { count: 0, lastClaimDate: "", best: 0 },
    expedition: {
      quests: [],
      lastRerollDay: "",
      nextQuestSeq: 0,
      freeRerollsLeft: 5,
      rerollDay: "",
    },
    bounties: { weekKey: "", progress: {}, claimed: [] },
    spin: { lastSpinDate: "", pityCount: 0 },
    challenge: { dayKey: "", modifierId: "", cleared: false },
    mastery: {},
    awakening: {},
    bestiary: {},
    banner: { sparks: 0, weekKey: "", pickedFeaturedId: "" },
    endless: { bestWave: {} },
    bossRush: { weekKey: "", bestTier: 0 },
    milestones: {},
    profile: { titleId: "", lifetimeKills: 0, lifetimeClears: 0 },
  };
}

/**
 * Ensure every meta field exists on a (possibly partial/old) save object.
 * Idempotent — safe to call on every load. Mirrors defaultMeta's shape so a
 * save persisted mid-development never crashes on a missing sub-object.
 */
export function backfillMeta(meta: Partial<MetaSave> | undefined): MetaSave {
  const d = defaultMeta();
  if (!meta) return d;
  return {
    streak: { ...d.streak, ...meta.streak },
    expedition: {
      quests: meta.expedition?.quests ?? [],
      lastRerollDay: meta.expedition?.lastRerollDay ?? "",
      nextQuestSeq: meta.expedition?.nextQuestSeq ?? 0,
      freeRerollsLeft: meta.expedition?.freeRerollsLeft ?? 5,
      rerollDay: meta.expedition?.rerollDay ?? "",
    },
    bounties: {
      ...d.bounties,
      ...meta.bounties,
      progress: meta.bounties?.progress ?? {},
      claimed: meta.bounties?.claimed ?? [],
    },
    spin: { ...d.spin, ...meta.spin },
    challenge: { ...d.challenge, ...meta.challenge },
    mastery: meta.mastery ?? {},
    awakening: meta.awakening ?? {},
    bestiary: meta.bestiary ?? {},
    banner: { ...d.banner, ...meta.banner },
    endless: { bestWave: meta.endless?.bestWave ?? {} },
    bossRush: { ...d.bossRush, ...meta.bossRush },
    milestones: meta.milestones ?? {},
    profile: { ...d.profile, ...meta.profile },
  };
}

/** ISO week key (YYYY-Www) for a date — used by weekly bounties / banner / boss rush. */
export function isoWeekKey(date: Date): string {
  // Copy date, set to nearest Thursday (ISO weeks belong to the year of their Thursday).
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
