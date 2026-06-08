import { describe, expect, it } from "vitest";
import { rewardTileSpecs, battleLootTiles, buildLootSummary } from "../src/data/rewardTiles.ts";
import type { DropResult } from "../src/core/drops.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { JEWEL_CATALOG } from "../src/data/jewels.ts";
import { boxIdForTier } from "../src/data/materials.ts";

function mkItem(defId: string, id = "x") {
  return { id, defId, acquiredLevel: 1, rolledStats: {}, rolledPrimaryAffix: 0, rolledAffixes: [], enhanceLevel: 0 };
}

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

describe("battleLootTiles", () => {
  const summary = {
    outcome: "won" as const, isFirstClear: false, xp: 0, gold: 0, diamonds: 0,
    items: [], jewels: [], skills: [], characters: [], materials: {},
  };

  it("renders an XP tile (emoji fallback, +amount label) when xp > 0", () => {
    const tiles = battleLootTiles({ ...summary, xp: 1500 });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].iconKey).toBe("icon__xp");
    expect(tiles[0].label).toBe("+1500");
  });

  it("renders one tile per dropped item", () => {
    const a = ITEM_CATALOG[0], b = ITEM_CATALOG[1];
    const tiles = battleLootTiles({ ...summary, items: [mkItem(a.id, "1"), mkItem(b.id, "2")] });
    expect(tiles.map((t) => t.iconKey)).toEqual([`item__${a.id}`, `item__${b.id}`]);
  });

  it("renders a loot box with its box__ texture (not material__)", () => {
    const boxId = boxIdForTier(3);
    const tiles = battleLootTiles({ ...summary, materials: { [boxId]: 2 } });
    expect(tiles[0].iconKey).toBe(`box__${boxId}`);
    expect(tiles[0].label).toBe("×2");
  });

  it("box tooltip lists the opening odds (gold/bless/soul/gear rates)", () => {
    const boxId = boxIdForTier(3);
    const tiles = battleLootTiles({ ...summary, materials: { [boxId]: 1 } });
    const tip = tiles[0].tooltip;
    expect(tip.kind).toBe("info");
    if (tip.kind === "info") {
      expect(tip.data.subtitle).toContain("Tier 3 Boss Chest");
      const body = tip.data.body ?? "";
      expect(body).toContain("Opening odds:");
      expect(body).toContain("Bless Jewel");
      expect(body).toMatch(/% Soul Jewel/);
      expect(body).toMatch(/% gear drop/);
    }
  });
});

describe("buildLootSummary", () => {
  const drop: DropResult = {
    goldAwarded: 300, diamondsAwarded: 0, itemDropped: mkItem(ITEM_CATALOG[0].id, "clear"),
    skillDropped: null, characterDropped: null, jewelDropped: null, isFirstClear: true,
    materialsDropped: { [boxIdForTier(5)]: 1 },
  };
  const eliteBox = boxIdForTier(1);

  it("on a win, merges in-battle loot with the stage-clear drop", () => {
    const s = buildLootSummary("won", { items: [mkItem(ITEM_CATALOG[1].id, "kill")], boxes: { [eliteBox]: 2 }, xp: 800 }, drop);
    expect(s.gold).toBe(300);
    expect(s.xp).toBe(800);
    expect(s.items).toHaveLength(2); // one kill drop + one stage-clear item
    expect(s.materials[eliteBox]).toBe(2);
    expect(s.materials[boxIdForTier(5)]).toBe(1);
    expect(s.isFirstClear).toBe(true);
  });

  it("on a loss, keeps in-battle loot but awards no gold/clear drops", () => {
    const s = buildLootSummary("lost", { items: [mkItem(ITEM_CATALOG[0].id, "kill")], boxes: { [eliteBox]: 1 }, xp: 200 }, null);
    expect(s.gold).toBe(0);
    expect(s.items).toHaveLength(1);
    expect(s.materials[eliteBox]).toBe(1);
    expect(s.xp).toBe(200);
    const tiles = battleLootTiles(s);
    expect(tiles.some((t) => t.iconKey === `box__${eliteBox}`)).toBe(true);
  });
});
