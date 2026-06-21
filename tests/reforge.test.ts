import { describe, expect, it } from "vitest";
import { reforgeItem, reforgeCost, canReforge, REROLL_RAMP_CAP } from "../src/core/reforge.ts";
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
    expect(leg.entropy).toBeGreaterThan(rare.entropy);
    expect(uniq.entropy).toBeGreaterThan(leg.entropy);
    expect(leg.gold).toBeGreaterThan(rare.gold);
    expect(uniq.gold).toBeGreaterThan(leg.gold);
    expect(reforgeCost("Common")).toBeNull();
  });

  it("escalates with the item's reroll count (entropy AND gold rise per reroll)", () => {
    const c0 = reforgeCost("Legendary", 0)!;
    const c1 = reforgeCost("Legendary", 1)!;
    const c2 = reforgeCost("Legendary", 2)!;
    expect(c1.entropy).toBeGreaterThan(c0.entropy);
    expect(c2.entropy).toBeGreaterThan(c1.entropy);
    expect(c1.gold).toBeGreaterThan(c0.gold);
    // entropy step is linear & constant
    expect(c2.entropy - c1.entropy).toBe(c1.entropy - c0.entropy);
  });

  it("a fresh item (count 0) costs exactly the rarity baseline", () => {
    expect(reforgeCost("Rare", 0)).toEqual(reforgeCost("Rare"));
  });

  it("caps the escalation at REROLL_RAMP_CAP so it never runs away", () => {
    const atCap = reforgeCost("Unique", REROLL_RAMP_CAP)!;
    const past = reforgeCost("Unique", REROLL_RAMP_CAP + 5)!;
    expect(past.entropy).toBe(atCap.entropy);
    expect(past.gold).toBe(atCap.gold);
  });
});

describe("reforge", () => {
  it("re-rolls all affixes, spends gold+entropy, bumps rerollCount, preserves identity", () => {
    const save = createFreshSave();
    const def = defOf("Legendary");
    const inst = toItemInstanceSave(rollItem(def, 20, 1));
    inst.enhanceLevel = 4;
    save.inventory.items.push(inst);
    const cost = reforgeCost(def.rarity, 0)!;
    save.currency.gold = cost.gold + 100;
    save.materials[CHAOS_JEWEL] = cost.entropy + 1;

    const before = JSON.parse(JSON.stringify(inst.rolledAffixes));
    const primaryBefore = inst.rolledPrimaryAffix,
      statsBefore = JSON.stringify(inst.rolledStats);

    const res = reforgeItem(save, inst.id, new Rng(99));
    expect(res.ok).toBe(true);
    expect(inst.rolledAffixes).toHaveLength(AFFIX_COUNT[def.rarity]);
    expect(inst.rolledAffixes).not.toEqual(before);
    expect(inst.rolledPrimaryAffix).toBe(primaryBefore);
    expect(JSON.stringify(inst.rolledStats)).toBe(statsBefore);
    expect(inst.enhanceLevel).toBe(4);
    expect(inst.rerollCount).toBe(1);
    expect(save.currency.gold).toBe(100);
    expect(save.materials[CHAOS_JEWEL]).toBe(1);
  });

  it("charges MORE on the second reroll than the first (escalation is live)", () => {
    const save = createFreshSave();
    const def = defOf("Unique");
    const inst = toItemInstanceSave(rollItem(def, 60, 1));
    save.inventory.items.push(inst);
    save.currency.gold = 1_000_000;
    save.materials[CHAOS_JEWEL] = 1000;

    const e0 = reforgeCost(def.rarity, 0)!.entropy;
    reforgeItem(save, inst.id, new Rng(11));
    const spentFirst = 1000 - save.materials[CHAOS_JEWEL];
    expect(spentFirst).toBe(e0);

    const e1 = reforgeCost(def.rarity, 1)!.entropy;
    const beforeSecond = save.materials[CHAOS_JEWEL];
    reforgeItem(save, inst.id, new Rng(12));
    const spentSecond = beforeSecond - save.materials[CHAOS_JEWEL];
    expect(spentSecond).toBe(e1);
    expect(spentSecond).toBeGreaterThan(spentFirst);
    expect(inst.rerollCount).toBe(2);
  });

  it("treats an undefined rerollCount (legacy saved item) as 0", () => {
    const save = createFreshSave();
    const def = defOf("Rare");
    const inst = toItemInstanceSave(rollItem(def, 10, 3));
    delete (inst as { rerollCount?: number }).rerollCount; // legacy item
    save.inventory.items.push(inst);
    const cost = reforgeCost(def.rarity, 0)!;
    save.currency.gold = cost.gold;
    save.materials[CHAOS_JEWEL] = cost.entropy;
    expect(reforgeItem(save, inst.id, new Rng(7)).ok).toBe(true);
    expect(inst.rerollCount).toBe(1);
  });

  it("refuses Common/Magic items, and when gold or entropy is short", () => {
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
    const cost = reforgeCost(def.rarity, 0)!;
    save.currency.gold = cost.gold - 1;
    save.materials[CHAOS_JEWEL] = cost.entropy;
    expect(reforgeItem(save, inst.id, new Rng(2)).reason).toBe("no-gold");
    save.currency.gold = cost.gold;
    save.materials[CHAOS_JEWEL] = cost.entropy - 1;
    expect(reforgeItem(save, inst.id, new Rng(3)).reason).toBe("no-entropy");
    expect(reforgeItem(save, "nope", new Rng(4)).reason).toBe("no-item");
  });

  it("keeps the Apex +25% bonus on a level-90 item's re-rolled affixes", () => {
    const save = createFreshSave();
    const def = defOf("Unique");
    const apex = toItemInstanceSave(rollItem(def, 90, 7, 90));
    expect(apex.apex).toBe(true);
    save.inventory.items.push(apex);
    const cost = reforgeCost(def.rarity, 0)!;
    save.currency.gold = cost.gold;
    save.materials[CHAOS_JEWEL] = cost.entropy;
    reforgeItem(save, apex.id, new Rng(5));
    expect(apex.apex).toBe(true);
  });
});
