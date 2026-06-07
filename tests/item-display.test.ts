import { describe, expect, it } from "vitest";
import { itemStatRows, SOURCE_COLOR, QUALITY_COLOR } from "../src/data/itemDisplay.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

const def = ITEM_CATALOG.find((d) => d.id === "masterwork-precision-ring")!;

function inst(over: Partial<{ rolledStats: Record<string, number>; rolledPrimaryAffix: number; rolledAffixes: { type: string; value: number }[] }> = {}) {
  return {
    id: "x", defId: def.id, acquiredLevel: 20,
    rolledStats: { critRate: 0.1 }, rolledPrimaryAffix: 0.05, rolledAffixes: [{ type: "critDamage", value: 0.15 }],
    enhanceLevel: 0, ...over,
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
    expect(SOURCE_COLOR.base).toBe("#ffffff");      // primary/base stat = white
    expect(SOURCE_COLOR.primary).toBe("#5fa8ff");   // primary affix = blue
    expect(SOURCE_COLOR.affix).toBe("#c98bff");     // additional affix = purple
    expect(QUALITY_COLOR.better).toBe("#6ee06e");   // better than base = green
    expect(QUALITY_COLOR.worse).toBe("#ff7a7a");    // worse than base = red
    expect(QUALITY_COLOR.base).toBe("#ffffff");     // on par = white
  });

  it("marks an above-base roll better (green) and below-base worse (red)", () => {
    // primary base value for this def:
    const basePrimary = def.primaryAffix.baseValue;
    const high = itemStatRows(inst({ rolledPrimaryAffix: basePrimary * 1.1 }), def).find((r) => r.source === "primary")!;
    const low = itemStatRows(inst({ rolledPrimaryAffix: basePrimary * 0.9 }), def).find((r) => r.source === "primary")!;
    expect(high.quality).toBe("better");
    expect(low.quality).toBe("worse");
  });

  it("formats fractional stats as percentages", () => {
    const row = itemStatRows(inst({ rolledStats: { critRate: 0.22 } }), def).find((r) => r.source === "base" && r.before === "Crit")!;
    expect(row.value).toBe("22%");
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
