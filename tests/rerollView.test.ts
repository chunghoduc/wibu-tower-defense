import { describe, expect, it } from "vitest";
import { rerollEligibleItems, rerollAffixRows } from "../src/data/rerollView.ts";
import { createFreshSave } from "../src/core/save.ts";
import { rollItem, ITEM_CATALOG, ITEM_CATALOG_MAP } from "../src/data/items.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";
import { reforgeCost } from "../src/core/reforge.ts";
import { CHAOS_JEWEL } from "../src/data/materials.ts";
import type { Rarity } from "../src/data/schema.ts";

function defOf(rarity: Rarity) {
  const d = ITEM_CATALOG.find((x) => x.rarity === rarity && x.affixPool.length >= 3);
  if (!d) throw new Error(`no ${rarity} item`);
  return d;
}

describe("rerollEligibleItems", () => {
  it("lists only Rare+ items, includes equipped, sorts rarity-desc", () => {
    const save = createFreshSave();
    const common = toItemInstanceSave(
      rollItem(ITEM_CATALOG.find((x) => x.rarity === "Common")!, 5, 1),
    );
    const rare = toItemInstanceSave(rollItem(defOf("Rare"), 10, 2));
    const uniq = toItemInstanceSave(rollItem(defOf("Unique"), 60, 3));
    save.inventory.items.push(common, rare, uniq);
    // equip the unique
    save.inventory.equipped = { Weapon: uniq.id } as typeof save.inventory.equipped;

    const list = rerollEligibleItems(save);
    const ids = list.map((v) => v.id);
    expect(ids).toContain(rare.id);
    expect(ids).toContain(uniq.id);
    expect(ids).not.toContain(common.id); // Common excluded
    // Unique sorts before Rare
    expect(list[0].rarity).toBe("Unique");
    expect(list.find((v) => v.id === uniq.id)!.equipped).toBe(true);
  });

  it("per-item cost reflects that item's own reroll count", () => {
    const save = createFreshSave();
    const def = defOf("Legendary");
    const fresh = toItemInstanceSave(rollItem(def, 30, 1));
    const used = toItemInstanceSave(rollItem(def, 30, 2));
    used.rerollCount = 3;
    save.inventory.items.push(fresh, used);

    const list = rerollEligibleItems(save);
    const vFresh = list.find((v) => v.id === fresh.id)!;
    const vUsed = list.find((v) => v.id === used.id)!;
    expect(vFresh.entropyCost).toBe(reforgeCost("Legendary", 0)!.entropy);
    expect(vUsed.entropyCost).toBe(reforgeCost("Legendary", 3)!.entropy);
    expect(vUsed.entropyCost).toBeGreaterThan(vFresh.entropyCost);
    expect(vUsed.rerollCount).toBe(3);
  });

  it("flags affordability against gold AND entropy", () => {
    const save = createFreshSave();
    const def = defOf("Rare");
    const inst = toItemInstanceSave(rollItem(def, 10, 1));
    save.inventory.items.push(inst);
    const cost = reforgeCost("Rare", 0)!;

    save.currency.gold = cost.gold;
    save.materials[CHAOS_JEWEL] = cost.entropy;
    expect(rerollEligibleItems(save)[0].affordable).toBe(true);

    save.materials[CHAOS_JEWEL] = cost.entropy - 1;
    expect(rerollEligibleItems(save)[0].affordable).toBe(false);

    save.materials[CHAOS_JEWEL] = cost.entropy;
    save.currency.gold = cost.gold - 1;
    expect(rerollEligibleItems(save)[0].affordable).toBe(false);
  });
});

describe("rerollAffixRows", () => {
  it("returns only the affix rows (no base/primary)", () => {
    const def = defOf("Unique");
    const inst = toItemInstanceSave(rollItem(def, 60, 1));
    const rows = rerollAffixRows(inst, ITEM_CATALOG_MAP.get(inst.defId)!);
    expect(rows.length).toBe(inst.rolledAffixes.length);
    expect(rows.every((r) => r.source === "affix")).toBe(true);
  });
});
