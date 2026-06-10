import { describe, expect, it } from "vitest";
import { STAGES, stageNumber, boxTierForStage } from "../src/data/stage.ts";
import { playerChapterOf, campaignChapterForStage, CAMPAIGN_CHAPTERS } from "../src/data/campaign.ts";
import { chapterStageIds } from "../src/core/difficultyUnlock.ts";
import { goldDepthMultiplier, processStageClear, GOLD_REWARD } from "../src/core/drops.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

describe("campaign chapters", () => {
  it("maps a stage id to its player chapter via the chN- prefix", () => {
    expect(playerChapterOf("ch1-s1")).toBe(1);
    expect(playerChapterOf("ch1-s10")).toBe(1);
    expect(playerChapterOf("ch2-s11")).toBe(2);
    expect(playerChapterOf("ch3-s20")).toBe(3);
    expect(playerChapterOf("ch4-s25")).toBe(4);
    expect(playerChapterOf("ch5-s30")).toBe(5);
  });

  it("resolves region metadata for every campaign stage", () => {
    for (const s of STAGES) {
      const ch = campaignChapterForStage(s.id);
      expect(ch, s.id).toBeDefined();
      expect(ch!.bgKey).toMatch(/^bg__chapter-/);
      expect(ch!.title.length).toBeGreaterThan(0);
      expect(ch!.lore.length).toBeGreaterThan(40);
    }
  });

  it("keeps homage descriptors free of real franchise names (legal safety)", () => {
    // Real franchise markers must stay in `// homage:` comments only, never in
    // shipped strings. (Generic words like "dunes" are fine.)
    const banned = /jojo|stardust crusaders|demon slayer|infinity castle|dante's inferno/i;
    for (const c of CAMPAIGN_CHAPTERS) {
      expect(banned.test(c.homage), c.id).toBe(false);
      expect(banned.test(c.lore), c.id).toBe(false);
      expect(banned.test(c.blurb), c.id).toBe(false);
    }
  });
});

describe("stage numbering continuity", () => {
  it("numbers stages 1..30 with the right chapter prefixes", () => {
    expect(STAGES.length).toBe(30);
    STAGES.forEach((s, i) => {
      expect(stageNumber(s.id)).toBe(i + 1);
    });
    expect(STAGES.slice(0, 10).every((s) => s.id.startsWith("ch1-"))).toBe(true);
    expect(STAGES.slice(10, 15).every((s) => s.id.startsWith("ch2-"))).toBe(true);
    expect(STAGES.slice(15, 20).every((s) => s.id.startsWith("ch3-"))).toBe(true);
    expect(STAGES.slice(20, 25).every((s) => s.id.startsWith("ch4-"))).toBe(true);
    expect(STAGES.slice(25, 30).every((s) => s.id.startsWith("ch5-"))).toBe(true);
  });

  it("gives every expansion stage the top loot-box tier", () => {
    for (const s of STAGES.filter((s) => !s.id.startsWith("ch1-"))) {
      expect(boxTierForStage(s.id), s.id).toBe(5);
    }
  });
});

describe("difficulty-unlock bands for the expansion", () => {
  it("groups Chapters 2, 3, 4 and 5 into their own 5-stage bands", () => {
    expect(chapterStageIds("ch2-s11")).toEqual(["ch2-s11", "ch2-s12", "ch2-s13", "ch2-s14", "ch2-s15"]);
    expect(chapterStageIds("ch3-s16")).toEqual(["ch3-s16", "ch3-s17", "ch3-s18", "ch3-s19", "ch3-s20"]);
    expect(chapterStageIds("ch4-s21")).toEqual(["ch4-s21", "ch4-s22", "ch4-s23", "ch4-s24", "ch4-s25"]);
    expect(chapterStageIds("ch5-s26")).toEqual(["ch5-s26", "ch5-s27", "ch5-s28", "ch5-s29", "ch5-s30"]);
  });
});

describe("depth-scaled gold reward", () => {
  it("is monotonically non-decreasing with stage depth", () => {
    let prev = 0;
    for (const s of STAGES) {
      const m = goldDepthMultiplier(s.id);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it("pays strictly more for a deeper stage on the same difficulty", () => {
    const early = processStageClear(createFreshSave(), "ch1-s1", "Normal", new Rng(7));
    const deep = processStageClear(createFreshSave(), "ch5-s30", "Normal", new Rng(7));
    expect(deep.goldAwarded).toBeGreaterThan(early.goldAwarded);
    // Stage 30 ≈ 2.74× the base; both first clears so the bonus cancels in ratio.
    expect(deep.goldAwarded).toBeGreaterThan(GOLD_REWARD.Normal * 2);
  });
});
