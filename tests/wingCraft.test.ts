import { describe, expect, it } from "vitest";
import {
  wingSuccessChance,
  wingOutcomeOdds,
  skywingsDefId,
  MIN_ITEMS,
  MAX_JEWELS,
  SUCCESS_CAP,
} from "../src/core/wingCraft.ts";
import { ITEM_CATALOG_MAP, rollItem } from "../src/data/items.ts";
import type { Rarity } from "../src/data/schema.ts";
import { craftWings } from "../src/core/wingCraft.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";

const five = (r: Rarity): Rarity[] => [r, r, r, r, r];

function saveWith(defIds: string[]) {
  const s = createFreshSave();
  s.hero.level = 30;
  s.materials["jewel-of-chaos"] = 4;
  s.materials["feather"] = 2;
  s.inventory.items = defIds.map((defId, n) =>
    toItemInstanceSave(rollItem(ITEM_CATALOG_MAP.get(defId)!, 30, 100 + n)),
  );
  return s;
}

describe("wingSuccessChance", () => {
  it("base 20% + per-item rarity, 1 jewel adds no bonus", () => {
    // 5× Common = 5×0.01 = 0.05; +0.20 base = 0.25
    expect(wingSuccessChance(five("Common"), 1)).toBeCloseTo(0.25, 5);
  });
  it("extra jewels add 10% each (jewel 4 ⇒ +0.30)", () => {
    expect(wingSuccessChance(five("Common"), 4)).toBeCloseTo(0.55, 5);
  });
  it("per-item rarity ladder (Magic .02 / Leg .07)", () => {
    expect(wingSuccessChance(five("Magic"), 1)).toBeCloseTo(0.3, 5);
    expect(wingSuccessChance(five("Legendary"), 1)).toBeCloseTo(0.55, 5);
  });
  it("clamps at the 80% cap", () => {
    expect(wingSuccessChance(five("Unique"), 4)).toBe(SUCCESS_CAP); // 0.20+0.50+0.30=1.0 → 0.80
  });
});

describe("wingOutcomeOdds", () => {
  const odds = (rs: Rarity[]) =>
    Object.fromEntries(wingOutcomeOdds(rs).map((o) => [o.rarity, o.chance]));

  it("average Magic ⇒ 60% Common · 35% Magic · 5% Rare (the spec example)", () => {
    const o = odds(five("Magic"));
    expect(o.Common).toBeCloseTo(0.6, 5);
    expect(o.Magic).toBeCloseTo(0.35, 5);
    expect(o.Rare).toBeCloseTo(0.05, 5);
  });
  it("average Common folds the below-weight onto Common (95/5)", () => {
    const o = odds(five("Common"));
    expect(o.Common).toBeCloseTo(0.95, 5);
    expect(o.Magic).toBeCloseTo(0.05, 5);
  });
  it("average Unique folds the above-weight onto Unique (60 Leg / 40 Uni)", () => {
    const o = odds(five("Unique"));
    expect(o.Legendary).toBeCloseTo(0.6, 5);
    expect(o.Unique).toBeCloseTo(0.4, 5);
  });
  it("weights always sum to 1", () => {
    for (const r of ["Common", "Magic", "Rare", "Legendary", "Unique"] as Rarity[]) {
      const sum = wingOutcomeOdds(five(r)).reduce((s, o) => s + o.chance, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe("skywingsDefId", () => {
  it("maps every rarity to a real skywings def", () => {
    const expected: Record<Rarity, string> = {
      Common: "worn-skywings",
      Magic: "fine-skywings",
      Rare: "masterwork-skywings",
      Legendary: "heroic-skywings",
      Unique: "mythic-skywings",
    };
    for (const r of Object.keys(expected) as Rarity[]) {
      expect(skywingsDefId(r)).toBe(expected[r]);
      expect(ITEM_CATALOG_MAP.get(skywingsDefId(r))?.slot).toBe("Wing");
    }
  });
});

it("exposes the documented constants", () => {
  expect(MIN_ITEMS).toBe(5);
  expect(MAX_JEWELS).toBe(4);
  expect(SUCCESS_CAP).toBe(0.8);
});

describe("craftWings", () => {
  const magicFive = () => Array<string>(5).fill("fine-skywings");
  const commonFive = () => Array<string>(5).fill("worn-skywings");

  it("rejects fewer than 5 items, mutating nothing", () => {
    const s = saveWith(magicFive());
    const before = s.inventory.items.length;
    const r = craftWings(
      s,
      { itemIds: s.inventory.items.slice(0, 4).map((i) => i.id), jewels: 1 },
      new Rng(1),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("too-few-items");
    expect(s.inventory.items.length).toBe(before);
  });

  it("rejects jewels outside [1,4]", () => {
    const s = saveWith(magicFive());
    const ids = s.inventory.items.map((i) => i.id);
    expect(craftWings(s, { itemIds: ids, jewels: 0 }, new Rng(1)).reason).toBe("bad-jewels");
    expect(craftWings(s, { itemIds: ids, jewels: 5 }, new Rng(1)).reason).toBe("bad-jewels");
  });

  it("rejects when the player lacks a feather", () => {
    const s = saveWith(magicFive());
    s.materials["feather"] = 0;
    const r = craftWings(s, { itemIds: s.inventory.items.map((i) => i.id), jewels: 1 }, new Rng(1));
    expect(r.reason).toBe("no-feather");
  });

  it("consumes items + jewels + 1 feather on SUCCESS and mints a skywings", () => {
    for (const seed of [1, 2, 3, 7, 11, 42, 99, 123] as number[]) {
      const s = saveWith(magicFive());
      const r = craftWings(
        s,
        { itemIds: s.inventory.items.map((i) => i.id), jewels: 4 },
        new Rng(seed),
      );
      if (r.ok && r.success) {
        expect(r.item).toBeDefined();
        expect(["worn-skywings", "fine-skywings", "masterwork-skywings"]).toContain(r.item!.defId);
        expect(s.materials["jewel-of-chaos"]).toBe(0);
        expect(s.materials["feather"]).toBe(1);
        expect(s.inventory.items.length).toBe(1); // 5 consumed, 1 wing minted
        return;
      }
    }
    throw new Error("no success across fixed seeds — broaden the seed list");
  });

  it("consumes inputs but mints nothing on FAILURE", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8] as number[]) {
      const s = saveWith(commonFive());
      const r = craftWings(
        s,
        { itemIds: s.inventory.items.map((i) => i.id), jewels: 1 },
        new Rng(seed),
      );
      if (r.ok && r.success === false) {
        expect(s.inventory.items.length).toBe(0); // 5 consumed, none minted
        expect(s.materials["jewel-of-chaos"]).toBe(3);
        expect(s.materials["feather"]).toBe(1);
        return;
      }
    }
    throw new Error("no failure across fixed seeds — broaden the seed list");
  });
});
