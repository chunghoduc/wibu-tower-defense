import { describe, expect, it } from "vitest";
import { boxRewardEntries } from "../src/data/boxRewardView.ts";
import { BLESS_JEWEL } from "../src/data/materials.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

const baseReward = {
  opened: true as const,
  level: 30,
  crystals: 80,
  diamonds: 0,
  materials: {},
  items: [],
};

describe("boxRewardEntries", () => {
  it("always leads with a gold entry carrying the rolled amount + gold icon", () => {
    const entries = boxRewardEntries({ ...baseReward, crystals: 120 });
    expect(entries[0].kind).toBe("gold");
    expect(entries[0].count).toBe(120);
    expect(entries[0].iconKey).toBe("icon__gold");
  });

  it("emits a diamond entry after gold when diamonds dropped", () => {
    const entries = boxRewardEntries({ ...baseReward, diamonds: 8 });
    const dia = entries.find((e) => e.kind === "diamond")!;
    expect(dia.count).toBe(8);
    expect(dia.iconKey).toBe("icon__gem");
  });

  it("emits no diamond entry when none dropped", () => {
    expect(boxRewardEntries(baseReward).some((e) => e.kind === "diamond")).toBe(false);
  });

  it("emits one entry per material, resolving its display name + icon key", () => {
    const entries = boxRewardEntries({ ...baseReward, materials: { [BLESS_JEWEL]: 2 } });
    const mat = entries.find((e) => e.kind === "material")!;
    expect(mat.count).toBe(2);
    expect(mat.name).toBe("Jewel of Bless");
    expect(mat.iconKey).toBe(`material__${BLESS_JEWEL}`);
  });

  it("emits an item entry with the item's name + icon key when an item drops", () => {
    const def = ITEM_CATALOG[0];
    const entries = boxRewardEntries({
      ...baseReward,
      items: [
        {
          id: "x",
          defId: def.id,
          acquiredLevel: 1,
          rolledStats: {},
          rolledPrimaryAffix: 0,
          rolledAffixes: [],
          enhanceLevel: 0,
        },
      ],
    });
    const item = entries.find((e) => e.kind === "item")!;
    expect(item.name).toBe(def.name);
    expect(item.iconKey).toBe(`item__${def.id}`);
  });

  it("emits no item entry when no item dropped", () => {
    expect(boxRewardEntries(baseReward).some((e) => e.kind === "item")).toBe(false);
  });
});
