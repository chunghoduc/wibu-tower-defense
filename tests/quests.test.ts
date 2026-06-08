import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { DAILY_QUESTS } from "../src/data/quests.ts";
import {
  rolloverQuests,
  incrementQuestKey,
  claimQuestReward,
  claimAllBonus,
  isQuestClaimable,
  claimableQuestCount,
  ALL_BONUS_DIAMONDS,
} from "../src/core/questTracker.ts";

const TODAY = "2026-06-08";

function freshOnDay(day = TODAY) {
  const save = createFreshSave();
  rolloverQuests(save, day); // sets quests.date so increments stick
  return save;
}

/** Drive a single quest to completion. */
function complete(save: ReturnType<typeof createFreshSave>, questId: string, day = TODAY) {
  const def = DAILY_QUESTS.find((q) => q.id === questId)!;
  incrementQuestKey(save, questId, def.target, day);
}

describe("quest claim flow", () => {
  it("a quest is only claimable once complete and not yet claimed", () => {
    const save = freshOnDay();
    const q = DAILY_QUESTS[0];
    expect(isQuestClaimable(save, q.id)).toBe(false); // 0 progress
    complete(save, q.id);
    expect(isQuestClaimable(save, q.id)).toBe(true);
    expect(claimQuestReward(save, q.id)).toBe(true);
    expect(isQuestClaimable(save, q.id)).toBe(false); // now claimed
  });

  it("claiming credits the reward into the save's currency/materials", () => {
    const save = freshOnDay();
    const goldQuest = DAILY_QUESTS.find((q) => q.reward.gold)!;
    const before = save.currency.gold;
    complete(save, goldQuest.id);
    claimQuestReward(save, goldQuest.id);
    expect(save.currency.gold).toBe(before + goldQuest.reward.gold!);
  });

  it("a reward cannot be claimed twice", () => {
    const save = freshOnDay();
    const q = DAILY_QUESTS[0];
    complete(save, q.id);
    expect(claimQuestReward(save, q.id)).toBe(true);
    expect(claimQuestReward(save, q.id)).toBe(false);
  });

  it("claimableQuestCount counts unclaimed completions plus the ready bonus", () => {
    const save = freshOnDay();
    expect(claimableQuestCount(save)).toBe(0);
    complete(save, DAILY_QUESTS[0].id);
    complete(save, DAILY_QUESTS[1].id);
    expect(claimableQuestCount(save)).toBe(2);

    // Complete + claim every quest → only the all-complete bonus remains claimable.
    for (const q of DAILY_QUESTS) { complete(save, q.id); claimQuestReward(save, q.id); }
    expect(claimableQuestCount(save)).toBe(1);

    const beforeDia = save.currency.diamonds;
    expect(claimAllBonus(save)).toBe(true);
    expect(save.currency.diamonds).toBe(beforeDia + ALL_BONUS_DIAMONDS);
    expect(claimableQuestCount(save)).toBe(0);
  });

  it("the all-complete bonus needs every quest claimed first", () => {
    const save = freshOnDay();
    for (const q of DAILY_QUESTS) complete(save, q.id); // completed but unclaimed
    expect(claimAllBonus(save)).toBe(false);
  });

  it("midnight rollover clears progress and claims for a new day", () => {
    const save = freshOnDay();
    complete(save, DAILY_QUESTS[0].id);
    claimQuestReward(save, DAILY_QUESTS[0].id);
    rolloverQuests(save, "2026-06-09");
    expect(save.quests.progress).toEqual({});
    expect(save.quests.claimed).toEqual([]);
    expect(save.quests.allClaimed).toBe(false);
    expect(claimableQuestCount(save)).toBe(0);
  });
});
