import { describe, it, expect } from "vitest";
import { itemInstanceIcon, towerIcon, skillIcon, RARITY_INT } from "../src/data/rewardIcon.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { TOWERS } from "../src/data/towers.ts";

describe("entity icon resolvers", () => {
  it("resolves an owned item instance to item__<defId> + rarity color", () => {
    const def = ITEM_CATALOG[0];
    const inst = {
      id: "inst-1",
      defId: def.id,
      acquiredLevel: 1,
      rolledStats: {},
      rolledPrimaryAffix: 0,
      rolledAffixes: [],
      enhanceLevel: 0,
    };
    const v = itemInstanceIcon(inst);
    expect(v.iconKey).toBe(`item__${def.id}`);
    expect(v.color).toBe(RARITY_INT[def.rarity]);
    expect(v.emoji).toBe("📦");
  });
  it("resolves a tower id to tower__<id> + rarity color", () => {
    const t = TOWERS[0];
    const v = towerIcon(t.id);
    expect(v.iconKey).toBe(`tower__${t.id}`);
    expect(v.color).toBe(RARITY_INT[t.rarity]);
  });
  it("resolves a skill id to skill__<id>", () => {
    const v = skillIcon("fireball");
    expect(v.iconKey).toBe("skill__fireball");
    expect(v.emoji).toBe("⚡");
  });
  it("defaults to Common color when the def is unknown", () => {
    expect(towerIcon("does-not-exist").color).toBe(RARITY_INT.Common);
  });
});
