import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { socketedJewelBags } from "../src/core/jewelStats.ts";
import { collectPassiveMore, heroStatPipeline } from "../src/core/stats.ts";
import { makeStats } from "../src/data/schema.ts";

function saveWithJewel(nodeId: string, defId: string, allocate: boolean) {
  const s = createFreshSave();
  s.hero.jewels = [{ id: "jw1", defId }];
  s.hero.socketedJewels = { [nodeId]: "jw1" };
  if (allocate) s.hero.unlockedNodes = [nodeId];
  return s;
}

describe("socketedJewelBags", () => {
  it("returns a jewel's bag when its socket node is allocated", () => {
    const s = saveWithJewel("brawler-jewel-1", "crimson-shard", true);
    const bags = socketedJewelBags(s);
    expect(bags).toHaveLength(1);
    expect(bags[0].increased?.atk).toBeCloseTo(0.08, 6);
  });

  it("contributes nothing when the socket node is NOT allocated (PoE rule)", () => {
    const s = saveWithJewel("brawler-jewel-1", "crimson-shard", false);
    expect(socketedJewelBags(s)).toEqual([]);
  });

  it("is empty when no jewels are socketed", () => {
    expect(socketedJewelBags(createFreshSave())).toEqual([]);
  });

  it("skips a socket pointing at an unknown jewel instance", () => {
    const s = createFreshSave();
    s.hero.unlockedNodes = ["brawler-jewel-1"];
    s.hero.socketedJewels = { "brawler-jewel-1": "ghost" };
    expect(socketedJewelBags(s)).toEqual([]);
  });
});

describe("jewel bags flow through the hero pipeline", () => {
  it("an increased jewel raises the stat (+8% ATK on 100 → 108)", () => {
    const s = saveWithJewel("brawler-jewel-1", "crimson-shard", true);
    const bags = socketedJewelBags(s);
    const out = heroStatPipeline(makeStats({ atk: 100 }), 1, bags, [], [], collectPassiveMore(bags));
    expect(out.atk).toBeCloseTo(108, 5);
  });

  it("a Unique `more` jewel multiplies (Berserker's Heart +8% more ATK on 100 → 108)", () => {
    const s = saveWithJewel("brawler-jewel-1", "berserkers-heart", true);
    const bags = socketedJewelBags(s);
    const out = heroStatPipeline(makeStats({ atk: 100 }), 1, bags, [], [], collectPassiveMore(bags));
    expect(out.atk).toBeCloseTo(108, 5);
  });
});
