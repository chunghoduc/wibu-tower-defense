import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  challengeForDay,
  ensureChallenge,
  claimChallengeClear,
  challengeClaimable,
} from "../src/core/challenge.ts";
import { CHALLENGE_MODIFIERS_MAP } from "../src/data/challengeModifiers.ts";

describe("F5 daily challenge", () => {
  it("is deterministic per day", () => {
    expect(challengeForDay("2026-06-09").id).toBe(challengeForDay("2026-06-09").id);
  });

  it("ensureChallenge rolls a fresh modifier on a new day and clears the flag", () => {
    const s = createFreshSave();
    s.meta.challenge = { dayKey: "2026-06-08", modifierId: "blitz", cleared: true };
    const def = ensureChallenge(s, "2026-06-09");
    expect(s.meta.challenge.dayKey).toBe("2026-06-09");
    expect(s.meta.challenge.cleared).toBe(false);
    expect(CHALLENGE_MODIFIERS_MAP.has(def.id)).toBe(true);
  });

  it("claim grants the modifier reward once per day", () => {
    const s = createFreshSave();
    const def = ensureChallenge(s, "2026-06-09");
    const diamonds0 = s.currency.diamonds;
    const reward = claimChallengeClear(s, "2026-06-09");
    expect(reward).not.toBeNull();
    expect(s.currency.diamonds).toBe(diamonds0 + (def.reward.diamonds ?? 0));
    expect(claimChallengeClear(s, "2026-06-09")).toBeNull(); // already claimed
    expect(challengeClaimable(s, "2026-06-09")).toBe(false);
  });

  it("a new day makes the challenge claimable again", () => {
    const s = createFreshSave();
    ensureChallenge(s, "2026-06-09");
    claimChallengeClear(s, "2026-06-09");
    ensureChallenge(s, "2026-06-10");
    expect(challengeClaimable(s, "2026-06-10")).toBe(true);
  });
});
