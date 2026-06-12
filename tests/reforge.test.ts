import { describe, expect, it } from "vitest";
import { reforgeItem, reforgeCost, canReforge } from "../src/core/reforge.ts";
import { createFreshSave } from "../src/core/save.ts";
import { rollItem, ITEM_CATALOG, AFFIX_COUNT } from "../src/data/items.ts";
import type { Rarity } from "../src/data/schema.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";
import { CHAOS_JEWEL } from "../src/data/materials.ts";
import { Rng } from "../src/core/rng.ts";

function defOf(rarity: Rarity) {
  const d = ITEM_CATALOG.find((x) => x.rarity === rarity && x.affixPool.length >= 3);
  if (!d) throw new Error(`no ${rarity} item with a deep pool`);
  return d;
}

describe("reforge cost & eligibility", () => {
  it("is available for Rare+ only, costs rising with rarity", () => {
    expect(canReforge("Common")).toBe(false);
    expect(canReforge("Magic")).toBe(false);
    expect(canReforge("Rare")).toBe(true);
    expect(canReforge("Legendary")).toBe(true);
    expect(canReforge("Unique")).toBe(true);
    const rare = reforgeCost("Rare")!,
      leg = reforgeCost("Legendary")!,
      uniq = reforgeCost("Unique")!;
    expect(leg.chaos).toBeGreaterThan(rare.chaos);
    expect(uniq.chaos).toBeGreaterThan(leg.chaos);
    expect(leg.gold).toBeGreaterThan(rare.gold);
    expect(uniq.gold).toBeGreaterThan(leg.gold);
    expect(reforgeCost("Common")).toBeNull();
  });
});

describe("reforge", () => {
  it("re-rolls all affixes, spends gold+chaos, and preserves primary/base/enhance", () => {
    const save = createFreshSave();
    const def = defOf("Legendary");
    const inst = toItemInstanceSave(rollItem(def, 20, 1));
    inst.enhanceLevel = 4;
    save.inventory.items.push(inst);
    const cost = reforgeCost(def.rarity)!;
    save.currency.gold = cost.gold + 100;
    save.materials[CHAOS_JEWEL] = cost.chaos + 1;

    const before = JSON.parse(JSON.stringify(inst.rolledAffixes));
    const primaryBefore = inst.rolledPrimaryAffix,
      statsBefore = JSON.stringify(inst.rolledStats);

    const res = reforgeItem(save, inst.id, new Rng(99));
    expect(res.ok).toBe(true);
    // affix COUNT stays at the rarity's count; values are fresh
    expect(inst.rolledAffixes).toHaveLength(AFFIX_COUNT[def.rarity]);
    expect(inst.rolledAffixes).not.toEqual(before);
    // identity preserved
    expect(inst.rolledPrimaryAffix).toBe(primaryBefore);
    expect(JSON.stringify(inst.rolledStats)).toBe(statsBefore);
    expect(inst.enhanceLevel).toBe(4);
    // economy spent
    expect(save.currency.gold).toBe(100);
    expect(save.materials[CHAOS_JEWEL]).toBe(1);
  });

  it("refuses Common/Magic items, and when gold or chaos is short", () => {
    const save = createFreshSave();
    const common = toItemInstanceSave(
      rollItem(ITEM_CATALOG.find((x) => x.rarity === "Common")!, 5, 2),
    );
    save.inventory.items.push(common);
    save.currency.gold = 99999;
    save.materials[CHAOS_JEWEL] = 99;
    expect(reforgeItem(save, common.id, new Rng(1)).reason).toBe("not-eligible");

    const def = defOf("Rare");
    const inst = toItemInstanceSave(rollItem(def, 10, 3));
    save.inventory.items.push(inst);
    const cost = reforgeCost(def.rarity)!;
    // no gold
    save.currency.gold = cost.gold - 1;
    save.materials[CHAOS_JEWEL] = cost.chaos;
    expect(reforgeItem(save, inst.id, new Rng(2)).reason).toBe("no-gold");
    // no chaos
    save.currency.gold = cost.gold;
    save.materials[CHAOS_JEWEL] = cost.chaos - 1;
    expect(reforgeItem(save, inst.id, new Rng(3)).reason).toBe("no-chaos");
    // missing item
    expect(reforgeItem(save, "nope", new Rng(4)).reason).toBe("no-item");
  });

  it("keeps the Apex +25% bonus on a level-90 item's re-rolled affixes", () => {
    const save = createFreshSave();
    const def = defOf("Unique");
    const apex = toItemInstanceSave(rollItem(def, 90, 7, 90));
    expect(apex.apex).toBe(true);
    save.inventory.items.push(apex);
    const cost = reforgeCost(def.rarity)!;
    save.currency.gold = cost.gold;
    save.materials[CHAOS_JEWEL] = cost.chaos;
    reforgeItem(save, apex.id, new Rng(5));
    expect(apex.apex).toBe(true); // still apex after reforge
  });
});
