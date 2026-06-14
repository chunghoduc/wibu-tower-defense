import { describe, it, expect } from "vitest";
import { raritySlotRow, GEM, GAP } from "./raritySlotRow.ts";
import type { Rarity } from "../data/schemaEnums.ts";

describe("raritySlotRow", () => {
  it("returns one gem per slot, left-to-right, fixed size", () => {
    const slots: Rarity[] = ["Common", "Magic", "Rare"];
    const row = raritySlotRow(slots, 100, 50);
    expect(row).toHaveLength(3);
    expect(row.map((g) => g.rarity)).toEqual(slots);
    expect(row.every((g) => g.size === GEM)).toBe(true);
    expect(row[0].cy).toBe(50);
    expect(row[1].cx - row[0].cx).toBe(GEM + GAP);
    expect(row[2].cx - row[1].cx).toBe(GEM + GAP);
    expect(row[0].cx).toBe(100 + GEM / 2);
  });

  it("empty slots → empty row", () => {
    expect(raritySlotRow([], 0, 0)).toEqual([]);
  });
});
