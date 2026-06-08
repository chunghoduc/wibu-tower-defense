import { describe, expect, it } from "vitest";
import { DAILY_QUESTS } from "../src/data/quests.ts";
import { createFreshSave } from "../src/core/save.ts";
import {
  rolloverQuests, getQuestProgress, claimQuestReward, claimAllBonus,
  incrementQuestKey,
} from "../src/core/questTracker.ts";
import { SUMMON_SCROLL } from "../src/data/materials.ts";

const TODAY = "2026-06-09";
const TOMORROW = "2026-06-10";

describe("DAILY_QUESTS catalog", () => {
  it("has exactly 7 quests", () => {
    expect(DAILY_QUESTS).toHaveLength(7);
  });

  it("all quests have unique ids", () => {
    const ids = DAILY_QUESTS.map((q) => q.id);
    expect(new Set(ids).size).toBe(7);
  });

  it("one quest rewards a Summon Scroll (kill_bosses)", () => {
    const bossQuest = DAILY_QUESTS.find((q) => q.id === "kill_bosses");
    expect(bossQuest).toBeDefined();
    expect(bossQuest!.reward.scroll).toBe(1);
  });

  it("every quest has a positive target", () => {
    for (const q of DAILY_QUESTS) expect(q.target, q.id).toBeGreaterThan(0);
  });
});

describe("rolloverQuests", () => {
  it("initialises a fresh save with empty quests for today", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    expect(s.quests.date).toBe(TODAY);
    expect(s.quests.progress).toEqual({});
    expect(s.quests.claimed).toEqual([]);
    expect(s.quests.allClaimed).toBe(false);
  });

  it("resets progress when the date changes", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    s.quests.progress["kill_enemies"] = 28;
    s.quests.claimed = ["kill_enemies"];
    rolloverQuests(s, TOMORROW);
    expect(s.quests.progress).toEqual({});
    expect(s.quests.claimed).toEqual([]);
    expect(s.quests.allClaimed).toBe(false);
  });

  it("leaves progress untouched on the same day", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    s.quests.progress["kill_enemies"] = 15;
    rolloverQuests(s, TODAY);
    expect(s.quests.progress["kill_enemies"]).toBe(15);
  });
});

describe("incrementQuestKey", () => {
  it("increments the count for a tracked quest key", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    incrementQuestKey(s, "kill_enemies", 5, TODAY);
    expect(getQuestProgress(s, "kill_enemies")).toBe(5);
  });

  it("does not exceed the quest target (no over-counting)", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    const bossQ = DAILY_QUESTS.find((q) => q.id === "kill_bosses")!;
    incrementQuestKey(s, "kill_bosses", bossQ.target + 10, TODAY);
    expect(getQuestProgress(s, "kill_bosses")).toBe(bossQ.target);
  });

  it("does nothing after a date rollover", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    incrementQuestKey(s, "kill_enemies", 5, TOMORROW); // wrong day → no-op
    expect(getQuestProgress(s, "kill_enemies")).toBe(0);
  });
});

describe("claimQuestReward", () => {
  it("grants the reward, marks quest claimed, persists", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    const q = DAILY_QUESTS.find((q) => q.id === "clear_stages")!;
    s.quests.progress["clear_stages"] = q.target;
    const goldBefore = s.currency.gold;
    const ok = claimQuestReward(s, "clear_stages");
    expect(ok).toBe(true);
    expect(s.quests.claimed).toContain("clear_stages");
    expect(s.currency.gold).toBeGreaterThan(goldBefore);
  });

  it("returns false if quest is not complete", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    expect(claimQuestReward(s, "clear_stages")).toBe(false);
  });

  it("returns false if already claimed", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    const q = DAILY_QUESTS.find((q) => q.id === "clear_stages")!;
    s.quests.progress["clear_stages"] = q.target;
    claimQuestReward(s, "clear_stages");
    expect(claimQuestReward(s, "clear_stages")).toBe(false);
  });

  it("kill_bosses quest reward grants 1 Summon Scroll", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    const q = DAILY_QUESTS.find((q) => q.id === "kill_bosses")!;
    s.quests.progress["kill_bosses"] = q.target;
    claimQuestReward(s, "kill_bosses");
    expect(s.materials[SUMMON_SCROLL]).toBe(1);
  });
});

describe("claimAllBonus (50 diamonds)", () => {
  it("grants 50 diamonds when all 7 quests are complete and claimed", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    for (const q of DAILY_QUESTS) {
      s.quests.progress[q.id] = q.target;
      claimQuestReward(s, q.id);
    }
    const dBefore = s.currency.diamonds;
    const ok = claimAllBonus(s);
    expect(ok).toBe(true);
    expect(s.currency.diamonds).toBe(dBefore + 50);
    expect(s.quests.allClaimed).toBe(true);
  });

  it("returns false if not all quests are claimed", () => {
    const s = createFreshSave();
    rolloverQuests(s, TODAY);
    expect(claimAllBonus(s)).toBe(false);
  });
});
