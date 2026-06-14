import { describe, it, expect } from "vitest";
import { RARITIES } from "../src/data/schemaEnums.ts";
import { Rng } from "../src/core/rng.ts";
import { QUEST_TIERS, generateQuest, rarityRank } from "../src/data/expeditionQuests.ts";

describe("expedition quest tiers", () => {
  it("defines a tier for every rarity", () => {
    for (const r of RARITIES) expect(QUEST_TIERS[r]).toBeTruthy();
  });

  it("durations strictly increase with rarity", () => {
    const ds = RARITIES.map((r) => QUEST_TIERS[r].durationMs);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]);
  });

  it("every slot floor is a valid rarity and slot count is non-empty", () => {
    for (const r of RARITIES) {
      const t = QUEST_TIERS[r];
      expect(t.slots.length).toBeGreaterThan(0);
      for (const s of t.slots) expect(RARITIES).toContain(s);
    }
  });

  it("reward rolls always grant something and never go negative", () => {
    const rng = new Rng(7);
    for (const r of RARITIES) {
      for (let i = 0; i < 50; i++) {
        const reward = QUEST_TIERS[r].rewardRoll(rng);
        expect(reward.gold ?? 0).toBeGreaterThan(0);
        expect(reward.diamonds ?? 0).toBeGreaterThanOrEqual(0);
        for (const n of Object.values(reward.materials ?? {})) expect(n).toBeGreaterThan(0);
      }
    }
  });

  it("higher tiers have a strictly higher minimum gold floor", () => {
    const floors = RARITIES.map((r) => QUEST_TIERS[r].goldRange[0]);
    for (let i = 1; i < floors.length; i++) expect(floors[i]).toBeGreaterThan(floors[i - 1]);
  });

  it("generateQuest is deterministic per seed and well-formed", () => {
    const a = generateQuest(new Rng(123), "q1");
    const b = generateQuest(new Rng(123), "q1");
    expect(a).toEqual(b);
    expect(a.id).toBe("q1");
    expect(a.startedAt).toBe(0);
    expect(a.assigned).toEqual([]);
    expect(a.slots).toEqual(QUEST_TIERS[a.rarity].slots);
    expect(a.durationMs).toBe(QUEST_TIERS[a.rarity].durationMs);
  });

  it("rarityRank orders Common<…<Unique", () => {
    expect(rarityRank("Common")).toBeLessThan(rarityRank("Unique"));
  });
});
