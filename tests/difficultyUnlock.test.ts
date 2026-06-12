import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import {
  chapterStageIds,
  isDifficultyUnlocked,
  prerequisiteTier,
} from "../src/core/difficultyUnlock.ts";
import type { Difficulty } from "../src/data/schema.ts";

function clear(save: ReturnType<typeof createFreshSave>, id: string, diff: Difficulty): void {
  save.progress.stageClearMap[id] = save.progress.stageClearMap[id] ?? {
    Normal: false,
    Hard: false,
    Nightmare: false,
  };
  save.progress.stageClearMap[id][diff] = true;
}

describe("difficulty tier gating", () => {
  it("prerequisiteTier chains Normal → Hard → Nightmare", () => {
    expect(prerequisiteTier("Normal")).toBeNull();
    expect(prerequisiteTier("Hard")).toBe("Normal");
    expect(prerequisiteTier("Nightmare")).toBe("Hard");
  });

  it("chapter 1 groups the first five stages", () => {
    const ids = chapterStageIds("ch1-s1");
    expect(ids).toEqual(["ch1-s1", "ch1-s2", "ch1-s3", "ch1-s4", "ch1-s5"]);
    expect(chapterStageIds("ch1-s6")).toEqual(["ch1-s6", "ch1-s7", "ch1-s8", "ch1-s9", "ch1-s10"]);
  });

  it("Normal is always playable, even on a fresh save", () => {
    const save = createFreshSave();
    expect(isDifficultyUnlocked(save, "ch1-s1", "Normal")).toBe(true);
    expect(isDifficultyUnlocked(save, "ch1-s10", "Normal")).toBe(true);
  });

  it("Hard stays locked until EVERY stage in the chapter is cleared on Normal", () => {
    const save = createFreshSave();
    // Clear 4 of the 5 chapter-1 stages on Normal.
    for (const id of ["ch1-s1", "ch1-s2", "ch1-s3", "ch1-s4"]) clear(save, id, "Normal");
    expect(isDifficultyUnlocked(save, "ch1-s1", "Hard")).toBe(false);
    // Clear the last one — now the whole chapter opens on Hard.
    clear(save, "ch1-s5", "Normal");
    for (const id of chapterStageIds("ch1-s1")) {
      expect(isDifficultyUnlocked(save, id, "Hard")).toBe(true);
    }
  });

  it("clearing chapter 1 on Normal does NOT open Hard for chapter 2", () => {
    const save = createFreshSave();
    for (const id of chapterStageIds("ch1-s1")) clear(save, id, "Normal");
    expect(isDifficultyUnlocked(save, "ch1-s6", "Hard")).toBe(false);
  });

  it("Nightmare requires the whole chapter cleared on Hard", () => {
    const save = createFreshSave();
    const ids = chapterStageIds("ch1-s1");
    for (const id of ids) clear(save, id, "Normal");
    expect(isDifficultyUnlocked(save, "ch1-s1", "Nightmare")).toBe(false);
    for (const id of ids) clear(save, id, "Hard");
    expect(isDifficultyUnlocked(save, "ch1-s1", "Nightmare")).toBe(true);
  });
});
