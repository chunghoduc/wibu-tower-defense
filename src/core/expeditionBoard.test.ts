import { describe, it, expect } from "vitest";
import {
  rerollBoard,
  ensureBoard,
  startQuest,
  REROLL_PER_DAY,
  DISPATCH_PER_DAY,
  BOARD_SIZE,
} from "./expeditionBoard.ts";
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
    dispatchesLeft: DISPATCH_PER_DAY,
    dispatchDay: "",
  };
  return save;
}

// Real Common tower ids (towerRarity keys off the collection id itself).
const COMMON_TOWERS = [
  "yamo-desert-bandit",
  "pip-powderkeg",
  "tobi-skipstone",
  "bram-thornling",
  "doro-mire-spirit",
  "mochi-morale-sprite",
  "riku-ironhide",
  "aya-dawnshot",
];

/**
 * Stock the collection with `n` Common towers and force every board quest to a
 * single Common slot so any one of those towers is a valid solo dispatch.
 */
function seedSoloCommonQuests(save: HeroSave, n: number): void {
  for (let i = 0; i < n; i++) {
    save.collection[COMMON_TOWERS[i]] = { stars: 1, copies: 0 } as never;
  }
  ensureBoard(save, DAY, new Rng(1));
  for (const q of save.meta.expedition.quests) q.slots = ["Common"];
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

  it("restores the counter to REROLL_PER_DAY on a new day (reroll)", () => {
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

describe("startQuest daily dispatch cap", () => {
  it("decrements the dispatch counter on each successful dispatch", () => {
    const save = seedAndReturn(5);
    const ids = [...save.meta.expedition.quests];
    expect(startQuest(save, ids[0].id, ["yamo-desert-bandit"], DAY)).toBe(true);
    expect(startQuest(save, ids[1].id, ["pip-powderkeg"], DAY)).toBe(true);
    expect(startQuest(save, ids[2].id, ["tobi-skipstone"], DAY)).toBe(true);
    expect(save.meta.expedition.dispatchesLeft).toBe(DISPATCH_PER_DAY - 3);
  });

  it("refuses a valid dispatch once the daily allowance is spent (no-op)", () => {
    const save = seedAndReturn(5);
    save.meta.expedition.dispatchesLeft = 0;
    save.meta.expedition.dispatchDay = "2026-06-14"; // today — no refill
    const q = save.meta.expedition.quests[0];
    expect(startQuest(save, q.id, ["yamo-desert-bandit"], DAY)).toBe(false);
    expect(q.startedAt).toBeLessThanOrEqual(0); // still Available, towers free
    expect(save.meta.expedition.dispatchesLeft).toBe(0);
  });

  it("does not consume an allowance for an invalid assignment", () => {
    const save = seedAndReturn(5);
    const q = save.meta.expedition.quests[0];
    // Wrong tower count for a single-slot quest → invalid.
    expect(startQuest(save, q.id, ["yamo-desert-bandit", "pip-powderkeg"], DAY)).toBe(false);
    expect(save.meta.expedition.dispatchesLeft).toBe(DISPATCH_PER_DAY);
  });

  it("restores the full dispatch allowance on a new UTC day", () => {
    const save = seedAndReturn(5);
    save.meta.expedition.dispatchesLeft = 0;
    save.meta.expedition.dispatchDay = "2026-06-14";
    const NEXT = Date.parse("2026-06-15T08:00:00Z");
    ensureBoard(save, NEXT, new Rng(7));
    expect(save.meta.expedition.dispatchesLeft).toBe(DISPATCH_PER_DAY);
    expect(save.meta.expedition.dispatchDay).toBe("2026-06-15");
  });
});

/** seedSoloCommonQuests + return the save for terse arrange-blocks. */
function seedAndReturn(n: number): HeroSave {
  const save = freshSave();
  seedSoloCommonQuests(save, n);
  return save;
}
