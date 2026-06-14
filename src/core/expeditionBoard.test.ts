import { describe, it, expect } from "vitest";
import { rerollBoard, ensureBoard, REROLL_PER_DAY, BOARD_SIZE } from "./expeditionBoard.ts";
import { createFreshSave } from "./save.ts";
import { Rng } from "./rng.ts";
import type { HeroSave } from "./save.ts";

const DAY = Date.parse("2026-06-14T08:00:00Z");

function freshSave(): HeroSave {
  const save = createFreshSave();
  // start from an empty board on the test day
  save.meta.expedition = {
    quests: [],
    lastRerollDay: "",
    nextQuestSeq: 0,
    freeRerollsLeft: REROLL_PER_DAY,
    rerollDay: "",
  };
  return save;
}

describe("rerollBoard", () => {
  it("rerolls Available, keeps Running, decrements the free counter", () => {
    const save = freshSave();
    ensureBoard(save, DAY, new Rng(1));
    const q = save.meta.expedition.quests[0];
    q.startedAt = DAY;
    q.assigned = ["t1"];
    const runningId = q.id;
    const before = save.meta.expedition.freeRerollsLeft;

    expect(rerollBoard(save, DAY, new Rng(2))).toBe(true);
    expect(save.meta.expedition.freeRerollsLeft).toBe(before - 1);
    expect(save.meta.expedition.quests).toHaveLength(BOARD_SIZE);
    expect(save.meta.expedition.quests.some((x) => x.id === runningId)).toBe(true);
  });

  it("is a no-op returning false when no free rerolls remain", () => {
    const save = freshSave();
    ensureBoard(save, DAY, new Rng(1));
    save.meta.expedition.freeRerollsLeft = 0;
    save.meta.expedition.rerollDay = "2026-06-14";
    const snapshot = save.meta.expedition.quests.map((x) => x.id);
    expect(rerollBoard(save, DAY, new Rng(3))).toBe(false);
    expect(save.meta.expedition.quests.map((x) => x.id)).toEqual(snapshot);
  });

  it("restores the counter to REROLL_PER_DAY on a new day", () => {
    const save = freshSave();
    ensureBoard(save, DAY, new Rng(1));
    save.meta.expedition.freeRerollsLeft = 0;
    save.meta.expedition.rerollDay = "2026-06-14";
    const NEXT = Date.parse("2026-06-15T08:00:00Z");
    expect(rerollBoard(save, NEXT, new Rng(4))).toBe(true);
    expect(save.meta.expedition.freeRerollsLeft).toBe(REROLL_PER_DAY - 1);
    expect(save.meta.expedition.rerollDay).toBe("2026-06-15");
  });
});
