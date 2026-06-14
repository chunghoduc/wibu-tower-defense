import { describe, it, expect } from "vitest";
import { Rng } from "../src/core/rng.ts";
import { createFreshSave } from "../src/core/save.ts";
import type { HeroSave } from "../src/core/save.ts";
import {
  BOARD_SIZE,
  ensureBoard,
  questState,
  questRemainingMs,
  questAssignedTowerIds,
  eligibleTowersForSlot,
  assignmentMeetsSlots,
  startQuest,
  claimableQuestCount,
  claimQuest,
} from "../src/core/expeditionBoard.ts";
import { QUEST_TIERS, type QuestInstance } from "../src/data/expeditionQuests.ts";
import { TOWERS } from "../src/data/towers.ts";

function ownerOf(rarity: string): string {
  const t = TOWERS.find((t) => t.rarity === rarity);
  if (!t) throw new Error(`no tower of rarity ${rarity}`);
  return t.id;
}

function saveOwning(ids: string[]): HeroSave {
  const save = createFreshSave();
  for (const id of ids) save.collection[id] = { copies: 0, stars: 1 };
  return save;
}

describe("expedition board", () => {
  it("ensureBoard fills to BOARD_SIZE and is idempotent within a day", () => {
    const save = createFreshSave();
    ensureBoard(save, Date.parse("2026-06-14T10:00:00Z"), new Rng(1));
    expect(save.meta.expedition.quests.length).toBe(BOARD_SIZE);
    const ids = save.meta.expedition.quests.map((q) => q.id);
    ensureBoard(save, Date.parse("2026-06-14T18:00:00Z"), new Rng(2));
    expect(save.meta.expedition.quests.map((q) => q.id)).toEqual(ids); // same day → unchanged
  });

  it("daily reroll replaces Available quests but preserves Running ones", () => {
    const save = saveOwning([ownerOf("Common")]);
    ensureBoard(save, Date.parse("2026-06-14T10:00:00Z"), new Rng(1));
    const q = save.meta.expedition.quests[0];
    q.rarity = "Common";
    q.slots = ["Common"];
    q.durationMs = QUEST_TIERS.Common.durationMs;
    startQuest(save, q.id, [ownerOf("Common")], Date.parse("2026-06-14T10:05:00Z"));
    expect(questState(save.meta.expedition.quests[0], Date.parse("2026-06-14T10:06:00Z"))).toBe(
      "running",
    );
    ensureBoard(save, Date.parse("2026-06-15T09:00:00Z"), new Rng(9)); // next day
    const stillThere = save.meta.expedition.quests.find((x) => x.id === q.id);
    expect(stillThere).toBeTruthy(); // running quest preserved across reroll
    expect(save.meta.expedition.quests.length).toBe(BOARD_SIZE);
  });

  it("eligibility excludes squad + cross-quest-locked + under-rarity towers", () => {
    const rare = ownerOf("Rare");
    const common = ownerOf("Common");
    const save = saveOwning([rare, common]);
    save.squad = [common];
    const forRare = eligibleTowersForSlot(save, "Rare", []);
    expect(forRare).toContain(rare);
    expect(forRare).not.toContain(common); // in squad
    const forCommon = eligibleTowersForSlot(save, "Common", []);
    expect(forCommon).toContain(rare); // Rare satisfies a Common floor
    expect(forCommon).not.toContain(common); // squad
  });

  it("assignmentMeetsSlots accepts a valid matching, rejects wrong count / under-rarity", () => {
    const rare = ownerOf("Rare");
    const magic = ownerOf("Magic");
    const save = saveOwning([rare, magic]);
    const q: QuestInstance = {
      id: "x",
      rarity: "Rare",
      slots: ["Magic", "Rare"],
      durationMs: 1,
      startedAt: 0,
      assigned: [],
    };
    expect(assignmentMeetsSlots(save, q, [magic, rare])).toBe(true);
    expect(assignmentMeetsSlots(save, q, [rare])).toBe(false); // wrong count
    expect(assignmentMeetsSlots(save, q, [magic, magic])).toBe(false); // 2nd slot needs Rare
  });

  it("startQuest locks towers; quest is ready exactly at startedAt+duration", () => {
    const common = ownerOf("Common");
    const save = saveOwning([common]);
    ensureBoard(save, 0, new Rng(1));
    const q = save.meta.expedition.quests[0];
    q.rarity = "Common";
    q.slots = ["Common"];
    q.durationMs = 1000;
    startQuest(save, q.id, [common], 5000);
    expect(questAssignedTowerIds(save).has(common)).toBe(true);
    expect(questState(q, 5999)).toBe("running");
    expect(questRemainingMs(q, 5999)).toBe(1);
    expect(questState(q, 6000)).toBe("ready");
    expect(claimableQuestCount(save, 6000)).toBe(1);
  });

  it("claimQuest grants the reward, frees towers, and refills the slot; no-op before ready", () => {
    const common = ownerOf("Common");
    const save = saveOwning([common]);
    ensureBoard(save, 0, new Rng(1));
    const q = save.meta.expedition.quests[0];
    q.rarity = "Common";
    q.slots = ["Common"];
    q.durationMs = 1000;
    startQuest(save, q.id, [common], 1000);
    const goldBefore = save.currency.gold;
    expect(claimQuest(save, q.id, 1500, new Rng(3))).toEqual({}); // not ready yet
    const reward = claimQuest(save, q.id, 3000, new Rng(3));
    expect(reward.gold ?? 0).toBeGreaterThan(0);
    expect(save.currency.gold).toBe(goldBefore + (reward.gold ?? 0));
    expect(questAssignedTowerIds(save).has(common)).toBe(false); // freed
    expect(save.meta.expedition.quests.length).toBe(BOARD_SIZE); // refilled
    expect(save.meta.expedition.quests.some((x) => x.id === q.id)).toBe(false); // replaced
  });
});
