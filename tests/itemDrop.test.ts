import { describe, expect, it } from "vitest";
import { rollItemDrop } from "../src/core/itemDrop.ts";
import { ITEM_CATALOG_MAP } from "../src/data/items.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

const rarityOf = (defId: string) => ITEM_CATALOG_MAP.get(defId)!.rarity;

describe("item drop rarity gating (enemy vs boss)", () => {
  it("regular-enemy drops never include Legendary or Unique", () => {
    const rng = new Rng(11);
    for (let i = 0; i < 500; i++) {
      const inst = rollItemDrop(createFreshSave(), 100, rng, false); // high lvl → all req levels eligible
      if (!inst) continue;
      const r = rarityOf(inst.defId);
      expect(r === "Legendary" || r === "Unique", `enemy dropped ${r}`).toBe(false);
    }
  });

  it("boss drops can include Legendary + Unique, but Unique is super rare", () => {
    const rng = new Rng(7);
    const counts: Record<string, number> = {};
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const inst = rollItemDrop(createFreshSave(), 100, rng, true);
      if (inst) counts[rarityOf(inst.defId)] = (counts[rarityOf(inst.defId)] ?? 0) + 1;
    }
    expect(counts.Common).toBeGreaterThan(counts.Rare ?? 0); // commons dominate
    expect(counts.Legendary ?? 0).toBeGreaterThan(0); // legendaries obtainable from bosses
    expect(counts.Unique ?? 0).toBeGreaterThan(0); // uniques obtainable…
    expect(counts.Unique ?? 0).toBeLessThan(N * 0.03); // …but super rare (<3%)
  });

  it("a rarity below its required item level never drops (eligibility still applies)", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 300; i++) {
      const inst = rollItemDrop(createFreshSave(), 1, rng, true); // only req<=1 items eligible
      if (inst) expect(ITEM_CATALOG_MAP.get(inst.defId)!.requiredLevel).toBeLessThanOrEqual(1);
    }
  });

  it("Wings never drop as loot (battle, stage clear, or boss)", () => {
    const rng = new Rng(99);
    for (let i = 0; i < 4000; i++) {
      const inst = rollItemDrop(createFreshSave(), 100, rng, i % 2 === 0); // mix enemy + boss
      if (inst) expect(ITEM_CATALOG_MAP.get(inst.defId)!.slot, "a Wing dropped").not.toBe("Wing");
    }
  });
});
