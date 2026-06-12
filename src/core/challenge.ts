/**
 * F5 — Daily Challenge core. Selects the day's modifier deterministically from
 * the date string (so every player on a given day faces the same challenge), and
 * pays a once-per-day clear bonus. The battle sim reads the modifier's effects.
 */
import {
  CHALLENGE_MODIFIERS,
  CHALLENGE_MODIFIERS_MAP,
  type ChallengeModifierDef,
} from "../data/challengeModifiers.ts";
import { grantReward, type Reward } from "./rewards.ts";
import type { HeroSave } from "./save.ts";

/** Stable string hash → non-negative int (FNV-1a). */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The modifier for a given day (deterministic). */
export function challengeForDay(dayKey: string): ChallengeModifierDef {
  const idx = hashStr(dayKey) % CHALLENGE_MODIFIERS.length;
  return CHALLENGE_MODIFIERS[idx];
}

/**
 * Ensure the save's challenge matches `today`, rolling a fresh modifier + clearing
 * the claimed flag when the day changes. Returns the active modifier.
 */
export function ensureChallenge(save: HeroSave, today: string): ChallengeModifierDef {
  const c = save.meta.challenge;
  if (c.dayKey !== today) {
    const def = challengeForDay(today);
    c.dayKey = today;
    c.modifierId = def.id;
    c.cleared = false;
    return def;
  }
  return CHALLENGE_MODIFIERS_MAP.get(c.modifierId) ?? challengeForDay(today);
}

export function challengeClaimable(save: HeroSave, today: string): boolean {
  return save.meta.challenge.dayKey === today && !save.meta.challenge.cleared;
}

/**
 * Award the daily challenge clear bonus. Returns the reward, or null if already
 * claimed today / the day's challenge isn't active. Caller verifies the player
 * actually cleared the challenge stage.
 */
export function claimChallengeClear(save: HeroSave, today: string): Reward | null {
  ensureChallenge(save, today);
  if (save.meta.challenge.cleared) return null;
  const def = CHALLENGE_MODIFIERS_MAP.get(save.meta.challenge.modifierId);
  if (!def) return null;
  save.meta.challenge.cleared = true;
  grantReward(save, def.reward);
  return def.reward;
}
