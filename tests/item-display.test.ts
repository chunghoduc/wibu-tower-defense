import { describe, expect, it } from "vitest";
import { itemStatRows, SOURCE_COLOR, QUALITY_COLOR } from "../src/data/itemDisplay.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

const def = ITEM_CATALOG.find((d) => d.id === "masterwork-precision-ring")!;

function inst(
  over: Partial<{
    rolledStats: Record<string, number>;
    rolledPrimaryAffix: number;
    rolledAffixes: { type: string; value: number }[];
  }> = {},
) {
  return {
    id: "x",
    defId: def.id,
    acquiredLevel: 20,
    rolledStats: { critRate: 0.1 },
    rolledPrimaryAffix: 0.05,
    rolledAffixes: [{ type: "critDamage", value: 0.15 }],
    enhanceLevel: 0,
    ...over,
  } as any;
}

describe("itemStatRows colouring", () => {
  it("tags base / primary / additional affix sources", () => {
    const rows = itemStatRows(inst(), def);
    expect(rows.find((r) => r.source === "base")).toBeDefined();
    expect(rows.find((r) => r.source === "primary")).toBeDefined();
    expect(rows.find((r) => r.source === "affix")).toBeDefined();
  });

  it("colour maps follow the requested scheme", () => {
    expect(SOURCE_COLOR.base).toBe("#ffffff"); // primary/base stat = white
    expect(SOURCE_COLOR.primary).toBe("#5fa8ff"); // primary affix = blue
    expect(SOURCE_COLOR.affix).toBe("#c98bff"); // additional affix = purple
    expect(QUALITY_COLOR.better).toBe("#6ee06e"); // better than base = green
    expect(QUALITY_COLOR.worse).toBe("#ff7a7a"); // worse than base = red
    expect(QUALITY_COLOR.base).toBe("#ffffff"); // on par = white
  });

  it("marks an above-base roll better (green) and below-base worse (red)", () => {
    // primary base value for this def:
    const basePrimary = def.primaryAffix.baseValue;
    const high = itemStatRows(inst({ rolledPrimaryAffix: basePrimary * 1.1 }), def).find(
      (r) => r.source === "primary",
    )!;
    const low = itemStatRows(inst({ rolledPrimaryAffix: basePrimary * 0.9 }), def).find(
      (r) => r.source === "primary",
    )!;
    expect(high.quality).toBe("better");
    expect(low.quality).toBe("worse");
  });

  it("shows enhance-scaled total + bonus on base stats (e.g. Armor 24 (+4))", () => {
    const plus0 = itemStatRows(inst({ rolledStats: { armor: 20 } }), def).find(
      (r) => r.source === "base",
    )!;
    expect(plus0.value).toBe("20");
    expect(plus0.bonus).toBeUndefined();

    const enh = itemStatRows(
      { ...inst({ rolledStats: { armor: 20 } }), enhanceLevel: 5 } as any,
      def,
    ).find((r) => r.source === "base")!;
    // enhanceBonus(5) = 1.4 → total 28, bonus +8
    expect(enh.value).toBe("28");
    expect(enh.bonus).toBe("(+8)");
  });

  it("affixes are not enhance-scaled (matches battle)", () => {
    const enh = itemStatRows(
      { ...inst({ rolledAffixes: [{ type: "critRate", value: 0.1 }] }), enhanceLevel: 5 } as any,
      def,
    ).find((r) => r.source === "affix")!;
    expect(enh.value).toBe("10%");
    expect(enh.bonus).toBeUndefined();
  });

  it("formats fractional stats as percentages", () => {
    const row = itemStatRows(inst({ rolledStats: { critRate: 0.22 } }), def).find(
      (r) => r.source === "base" && r.before === "Crit",
    )!;
    expect(row.value).toBe("22%");
  });

  it("never shows a beneficial affix as 0 — scalar affixes render as a percentage", () => {
    // A scalar-stat affix (atk) is a % increase; it must not round to a flat "+0".
    const rows = itemStatRows(inst({ rolledAffixes: [{ type: "atk", value: 0.12 }] }), def);
    const a = rows.find((r) => r.source === "affix")!;
    expect(a.value).toBe("12%");
    expect(a.value).not.toBe("0");
    // primary affix value is always a non-zero percentage too
    const p = rows.find((r) => r.source === "primary")!;
    expect(p.value).toMatch(/%$/);
    expect(p.value).not.toMatch(/^0%$/);
  });

  it("renders affixes as full sentences with the value embedded", () => {
    const rows = itemStatRows(inst({ rolledAffixes: [{ type: "armorPen", value: 0.07 }] }), def);
    const a = rows.find((r) => r.source === "affix")!;
    expect(a.before).toBe("Ignores ");
    expect(a.value).toBe("7%");
    expect(a.after).toBe(" of enemy Armor");
    // primary affix (critRate on this ring) reads as a sentence too
    const p = rows.find((r) => r.source === "primary")!;
    expect(`${p.before}${p.value}${p.after}`).toMatch(/Critical Chance/);
  });
});
