import { describe, expect, it } from "vitest";
import { rewardTileSpecs } from "../src/data/rewardTiles.ts";
import type { DropResult } from "../src/core/drops.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { JEWEL_CATALOG } from "../src/data/jewels.ts";

const base: DropResult = {
  goldAwarded: 0, diamondsAwarded: 0, itemDropped: null, skillDropped: null,
  characterDropped: null, jewelDropped: null, isFirstClear: false, materialsDropped: {},
};

describe("rewardTileSpecs", () => {
  it("renders gold as a single tile with the gold icon and +amount label", () => {
    const tiles = rewardTileSpecs({ ...base, goldAwarded: 200 });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].iconKey).toBe("icon__gold");
    expect(tiles[0].label).toBe("+200");
    expect(tiles[0].tooltip.kind).toBe("info");
  });

  it("renders diamonds with the gem icon (not gold)", () => {
    const tiles = rewardTileSpecs({ ...base, diamondsAwarded: 10 });
    expect(tiles[0].iconKey).toBe("icon__gem");
    expect(tiles[0].label).toBe("+10");
  });

  it("renders a dropped item with its texture key and an item tooltip", () => {
    const def = ITEM_CATALOG[0];
    const inst = { id: "x", defId: def.id, acquiredLevel: 1, rolledStats: {}, rolledPrimaryAffix: 0, rolledAffixes: [], enhanceLevel: 0 };
    const tiles = rewardTileSpecs({ ...base, itemDropped: inst });
    expect(tiles[0].iconKey).toBe(`item__${def.id}`);
    expect(tiles[0].label).toBe(def.rarity);
    expect(tiles[0].tooltip).toEqual({ kind: "item", inst });
  });

  it("renders a dropped jewel with its jewel icon and a detail tooltip from the catalog", () => {
    const def = JEWEL_CATALOG[0];
    const tiles = rewardTileSpecs({ ...base, jewelDropped: { id: "j1", defId: def.id } });
    expect(tiles[0].iconKey).toBe(`jewel__${def.id}`);
    expect(tiles[0].tooltip.kind).toBe("info");
    if (tiles[0].tooltip.kind === "info") {
      expect(tiles[0].tooltip.data.title).toBe(def.name);
      expect(tiles[0].tooltip.data.body).toBe(def.description);
    }
  });

  it("renders one material tile per dropped material with ×count and its material icon", () => {
    const tiles = rewardTileSpecs({ ...base, materialsDropped: { "bless-jewel": 3 } });
    expect(tiles[0].iconKey).toBe("material__bless-jewel");
    expect(tiles[0].label).toBe("×3");
  });

  it("orders every reward kind together and skips empty ones", () => {
    const def = ITEM_CATALOG[0];
    const tiles = rewardTileSpecs({
      ...base, goldAwarded: 50, diamondsAwarded: 5,
      itemDropped: { id: "x", defId: def.id, acquiredLevel: 1, rolledStats: {}, rolledPrimaryAffix: 0, rolledAffixes: [], enhanceLevel: 0 },
      materialsDropped: { "bless-jewel": 1 },
    });
    expect(tiles.map((t) => t.iconKey)).toEqual([
      "icon__gold", "icon__gem", `item__${def.id}`, "material__bless-jewel",
    ]);
  });
});
