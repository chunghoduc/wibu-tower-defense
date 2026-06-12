import { describe, expect, it } from "vitest";
import { compareItems, type ItemRef } from "../src/data/itemCompare.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

// A ring def gives us a concrete primaryAffix.type to anchor affix tests.
const def = ITEM_CATALOG.find((d) => d.id === "masterwork-precision-ring")!;

function ref(
  over: Partial<{
    rolledStats: Record<string, number>;
    rolledPrimaryAffix: number;
    rolledAffixes: { type: string; value: number }[];
    enhanceLevel: number;
  }> = {},
): ItemRef {
  return {
    inst: {
      id: "x",
      defId: def.id,
      acquiredLevel: 20,
      rolledStats: {},
      rolledPrimaryAffix: 0,
      rolledAffixes: [],
      enhanceLevel: 0,
      ...over,
    } as any,
    def,
  };
}

describe("compareItems — base stat diffs", () => {
  it("shows the equipped value and the delta toward the bag item, per the spec example", () => {
    // bag (viewing) item: 100 HP, 50 armor.  equipped item: 52 armor, 50 magic resist.
    const bag = ref({ rolledStats: { maxHp: 100, armor: 50 } });
    const equipped = ref({ rolledStats: { armor: 52, magicResist: 50 } });
    const { stats } = compareItems(bag, equipped);

    const byLabel = (l: string) => stats.find((r) => r.label === l)!;

    // HP: equipped 0, bag 100 → "HP 0 (+100)" upgrade
    expect(byLabel("HP").equipped).toBe("0");
    expect(byLabel("HP").delta).toBe("+100");
    expect(byLabel("HP").dir).toBe(1);

    // Armor: equipped 52, bag 50 → "Armor 52 (-2)" downgrade
    expect(byLabel("Armor").equipped).toBe("52");
    expect(byLabel("Armor").delta).toBe("-2");
    expect(byLabel("Armor").dir).toBe(-1);

    // M.Resist: equipped 50, bag 0 → "M.Resist 50 (-50)" downgrade
    expect(byLabel("M.Resist").equipped).toBe("50");
    expect(byLabel("M.Resist").delta).toBe("-50");
    expect(byLabel("M.Resist").dir).toBe(-1);
  });

  it("an identical stat shows a neutral (dir 0) delta", () => {
    const bag = ref({ rolledStats: { armor: 30 } });
    const equipped = ref({ rolledStats: { armor: 30 } });
    const armor = compareItems(bag, equipped).stats.find((r) => r.label === "Armor")!;
    expect(armor.delta).toBe("0");
    expect(armor.dir).toBe(0);
  });

  it("scales base stats by enhance level on both sides", () => {
    // bag +5 (×1.4): 20 → 28.  equipped +0: 20.  delta +8.
    const bag = ref({ rolledStats: { armor: 20 }, enhanceLevel: 5 });
    const equipped = ref({ rolledStats: { armor: 20 } });
    const armor = compareItems(bag, equipped).stats.find((r) => r.label === "Armor")!;
    expect(armor.equipped).toBe("20");
    expect(armor.delta).toBe("+8");
    expect(armor.dir).toBe(1);
  });

  it("formats fractional base stats as percentages", () => {
    const bag = ref({ rolledStats: { critRate: 0.22 } });
    const equipped = ref({ rolledStats: { critRate: 0.1 } });
    const crit = compareItems(bag, equipped).stats.find((r) => r.label === "Crit")!;
    expect(crit.equipped).toBe("10%");
    expect(crit.delta).toBe("+12%");
    expect(crit.dir).toBe(1);
  });
});

describe("compareItems — selected (bag) value column", () => {
  it("exposes the selected item's formatted value per row", () => {
    const bag = ref({ rolledStats: { maxHp: 100, armor: 50 } });
    const equipped = ref({ rolledStats: { armor: 52, magicResist: 50 } });
    const { stats } = compareItems(bag, equipped);
    const byLabel = (l: string) => stats.find((r) => r.label === l)!;

    expect(byLabel("HP").bag).toBe("100"); // selected has it, equipped doesn't
    expect(byLabel("Armor").bag).toBe("50"); // both have it
    expect(byLabel("M.Resist").bag).toBe("0"); // equipped-only → selected shows 0
  });

  it("scales the selected value by enhance level", () => {
    const bag = ref({ rolledStats: { armor: 20 }, enhanceLevel: 5 }); // ×1.4 → 28
    const equipped = ref({ rolledStats: { armor: 20 } });
    expect(compareItems(bag, equipped).stats.find((r) => r.label === "Armor")!.bag).toBe("28");
  });

  it("formats fractional / affix selected values as percent", () => {
    const bag = ref({ rolledStats: { critRate: 0.22 } });
    const equipped = ref({ rolledStats: { critRate: 0.1 } });
    expect(compareItems(bag, equipped).stats.find((r) => r.label === "Crit")!.bag).toBe("22%");
  });
});

describe("compareItems — affix diffs", () => {
  it("compares affixes as percentage rows, summing same-typed affixes", () => {
    const bag = ref({ rolledAffixes: [{ type: "atk", value: 0.12 }] });
    const equipped = ref({ rolledAffixes: [{ type: "atk", value: 0.05 }] });
    const atk = compareItems(bag, equipped).affixes.find((r) => r.label === "ATK")!;
    expect(atk.equipped).toBe("5%");
    expect(atk.delta).toBe("+7%");
    expect(atk.dir).toBe(1);
  });

  it("includes the primary affix (enhance-scaled) in the affix list", () => {
    const bag = ref({ rolledPrimaryAffix: 0.1 });
    const equipped = ref({ rolledPrimaryAffix: 0.1 });
    // primaryAffix.type for the ring is critRate → label "Crit"
    const aff = compareItems(bag, equipped).affixes.find((r) => r.label === "Crit")!;
    expect(aff.equipped).toBe("10%");
    expect(aff.dir).toBe(0);
  });
});
