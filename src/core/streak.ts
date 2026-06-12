/**
 * F1 — Login Streak Calendar.
 *
 * Consecutive calendar-day logins advance a looping 7-day reward cycle; every
 * 30 streak-days grants a milestone bonus. Missing a day resets the streak to 1.
 * Loop: Meta. Bartle: Achiever. Feeling: "don't break the chain."
 *
 * Numbers (control points): the day-7 reward ≈ one summon's worth (160💎); a
 * perfect 28-day month ≈ ~4 pulls + an Awakening Crystal. Escalating within the
 * week (guaranteed spine) so each day feels like a step up.
 */
import type { HeroSave } from "./save.ts";
import { grantReward, type Reward } from "./rewards.ts";
import { BLESS_JEWEL, SOUL_JEWEL, SUMMON_SCROLL, AWAKENING_CRYSTAL } from "../data/materials.ts";

/** The 7-day cycle, escalating to a pull-worth payout on day 7. */
export const STREAK_CYCLE: Reward[] = [
  { gold: 300 },
  { diamonds: 20 },
  { materials: { [SUMMON_SCROLL]: 1 } },
  { materials: { [BLESS_JEWEL]: 3 } },
  { diamonds: 40 },
  { materials: { [SOUL_JEWEL]: 2 } },
  { diamonds: 160 }, // day 7 ≈ one summon
];

/** Every STREAK_MILESTONE_DAYS of streak grants this on top of the cycle reward. */
export const STREAK_MILESTONE_DAYS = 30;
export const STREAK_MILESTONE_REWARD: Reward = {
  materials: { [AWAKENING_CRYSTAL]: 1 },
  diamonds: 100,
};

export interface StreakClaim {
  /** New streak count after this claim. */
  count: number;
  /** 1-based day within the 7-day cycle. */
  cycleDay: number;
  reward: Reward;
  /** True when this claim also crossed a 30-day milestone. */
  milestone: boolean;
}

/** Parse a YYYY-MM-DD string to a UTC-midnight epoch day number. */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86400000);
}

/** Whether today's streak reward is still claimable (not yet claimed today). */
export function streakClaimable(save: HeroSave, today: string): boolean {
  return save.meta.streak.lastClaimDate !== today;
}

/** Reward preview for the next claim's cycle day (without mutating). */
export function nextStreakReward(save: HeroSave, today: string): Reward {
  const s = save.meta.streak;
  let count: number;
  if (s.lastClaimDate === "") count = 1;
  else {
    const gap = dayNumber(today) - dayNumber(s.lastClaimDate);
    count = gap === 1 ? s.count + 1 : 1;
  }
  return STREAK_CYCLE[(count - 1) % 7];
}

/**
 * Advance + claim today's streak reward. Returns null if already claimed today.
 * - first ever, or exactly the next calendar day → continue (count+1)
 * - a gap > 1 day (or same-day already handled) → reset to 1
 */
export function claimStreak(save: HeroSave, today: string): StreakClaim | null {
  const s = save.meta.streak;
  if (s.lastClaimDate === today) return null;

  if (s.lastClaimDate === "") s.count = 1;
  else {
    const gap = dayNumber(today) - dayNumber(s.lastClaimDate);
    s.count = gap === 1 ? s.count + 1 : 1;
  }
  s.lastClaimDate = today;
  s.best = Math.max(s.best, s.count);

  const cycleDay = ((s.count - 1) % 7) + 1;
  const cycleReward = STREAK_CYCLE[cycleDay - 1];
  grantReward(save, cycleReward);

  const milestone = s.count % STREAK_MILESTONE_DAYS === 0;
  let reward: Reward = cycleReward;
  if (milestone) {
    grantReward(save, STREAK_MILESTONE_REWARD);
    reward = mergeReward(cycleReward, STREAK_MILESTONE_REWARD);
  }
  return { count: s.count, cycleDay, reward, milestone };
}

function mergeReward(a: Reward, b: Reward): Reward {
  const materials = { ...(a.materials ?? {}) };
  for (const [id, n] of Object.entries(b.materials ?? {})) materials[id] = (materials[id] ?? 0) + n;
  return {
    gold: (a.gold ?? 0) + (b.gold ?? 0) || undefined,
    diamonds: (a.diamonds ?? 0) + (b.diamonds ?? 0) || undefined,
    materials: Object.keys(materials).length ? materials : undefined,
  };
}
