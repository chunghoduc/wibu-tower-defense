import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { claimStreak, streakClaimable, STREAK_CYCLE, STREAK_MILESTONE_DAYS } from "../src/core/streak.ts";

describe("F1 login streak", () => {
  it("first claim starts the chain at 1 and grants day-1 reward", () => {
    const s = createFreshSave();
    const gold0 = s.currency.gold;
    const claim = claimStreak(s, "2026-06-09");
    expect(claim).not.toBeNull();
    expect(claim!.count).toBe(1);
    expect(claim!.cycleDay).toBe(1);
    expect(s.currency.gold).toBe(gold0 + (STREAK_CYCLE[0].gold ?? 0));
  });

  it("returns null when already claimed today (idempotent per day)", () => {
    const s = createFreshSave();
    claimStreak(s, "2026-06-09");
    expect(claimStreak(s, "2026-06-09")).toBeNull();
    expect(streakClaimable(s, "2026-06-09")).toBe(false);
  });

  it("consecutive days advance the count and cycle through 7 days", () => {
    const s = createFreshSave();
    const days = ["2026-06-09", "2026-06-10", "2026-06-11"];
    days.forEach((d, i) => expect(claimStreak(s, d)!.count).toBe(i + 1));
    expect(s.meta.streak.count).toBe(3);
  });

  it("a missed day resets the streak to 1", () => {
    const s = createFreshSave();
    claimStreak(s, "2026-06-09");
    claimStreak(s, "2026-06-10");
    const after = claimStreak(s, "2026-06-13"); // gap > 1
    expect(after!.count).toBe(1);
  });

  it("tracks best streak", () => {
    const s = createFreshSave();
    claimStreak(s, "2026-06-09");
    claimStreak(s, "2026-06-10");
    claimStreak(s, "2026-06-13"); // reset to 1
    expect(s.meta.streak.best).toBe(2);
  });

  it("grants a milestone bonus on the 30th consecutive day", () => {
    const s = createFreshSave();
    // Force the count to 29 with a valid lastClaimDate, then claim the next day.
    s.meta.streak.count = 29;
    s.meta.streak.lastClaimDate = "2026-06-08";
    const claim = claimStreak(s, "2026-06-09");
    expect(claim!.count).toBe(STREAK_MILESTONE_DAYS);
    expect(claim!.milestone).toBe(true);
    expect(s.materials["awakening-crystal"]).toBeGreaterThanOrEqual(1);
  });
});
